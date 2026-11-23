package io.tickoff.auth;

import io.tickoff.domain.UserRepository;
import io.tickoff.domain.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record RegisterRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Size(min = 8, max = 72) String password,
        @NotBlank @Size(max = 120) String name) {
    }

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {
    }

    public record ForgotPasswordRequest(@NotBlank @Email @Size(max = 255) String email) {
    }

    public record ResetPasswordRequest(
        @NotBlank @Size(max = 200) String token,
        @NotBlank @Size(min = 8, max = 72) String password) {
    }

    public record VerifyEmailRequest(@NotBlank @Size(max = 200) String token) {
    }

    public record UserDto(Long id, String email, String name, boolean notifyEmail, boolean emailVerified,
                          String digestFrequency, boolean twoFactorEnabled) {
        static UserDto of(User u) {
            return new UserDto(u.getId(), u.getEmail(), u.getName(), u.isNotifyEmail(), u.isEmailVerified(),
                u.getDigestFrequency(), u.isTotpEnabled());
        }
    }

    public record AuthResponse(String token, UserDto user) {
    }

    /**
     * A belépés válasza: vagy kész munkamenet (token + felhasználó), vagy — bekapcsolt kétlépcsős belépésnél —
     * {@code twoFactorRequired} egy rövid életű kihívással, amit a kóddal együtt kell beküldeni.
     */
    public record LoginResponse(String token, UserDto user, boolean twoFactorRequired, String challenge) {
    }

    public record TwoFactorLoginRequest(@NotBlank @Size(max = 2000) String challenge, @NotBlank @Size(max = 40) String code) {
    }

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final TokenService tokens;
    // Nem létező felhasználónál is ezzel számolunk, így a válaszidő nem árulja el, hogy létezik-e az e-mail.
    private final String dummyHash;

    private final PasswordResetService passwordReset;
    private final EmailVerificationService verification;
    private final TwoFactorService twoFactor;
    private final boolean registrationEnabled;

    public AuthController(UserRepository users, PasswordEncoder encoder, TokenService tokens,
                          PasswordResetService passwordReset, EmailVerificationService verification,
                          TwoFactorService twoFactor,
                          @Value("${tickoff.registration.enabled:true}") boolean registrationEnabled) {
        this.users = users;
        this.encoder = encoder;
        this.tokens = tokens;
        this.passwordReset = passwordReset;
        this.verification = verification;
        this.twoFactor = twoFactor;
        this.registrationEnabled = registrationEnabled;
        this.dummyHash = encoder.encode("tickoff-dummy-password");
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest req) {
        if (!registrationEnabled) {
            // Éles üzemben a saját fiók(ok) létrehozása után lezárható a nyilvános regisztráció.
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "A regisztráció le van tiltva");
        }
        String email = normalize(req.email());
        if (users.findByEmail(email).isPresent()) {
            throw emailTaken();
        }
        User user;
        try {
            user = users.saveAndFlush(new User(email, encoder.encode(req.password()), req.name().trim()));
        } catch (DataIntegrityViolationException e) {
            // Párhuzamos regisztráció ugyanarra az e-mailre: az egyedi index elkapja.
            throw emailTaken();
        }
        // Megerősítő levél (ha nincs e-mail-küldés, a fiók azonnal megbízható lesz)
        verification.sendVerification(user.getId());
        return new AuthResponse(tokens.issue(user), UserDto.of(users.findById(user.getId()).orElse(user)));
    }

    /** A regisztrációkor kapott linkkel megerősíti az e-mail-címet. Érvénytelen vagy lejárt tokenre 400. */
    @PostMapping("/verify-email")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verifyEmail(@Valid @RequestBody VerifyEmailRequest req) {
        if (!verification.verify(req.token().trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Érvénytelen vagy lejárt link");
        }
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest req) {
        User user = users.findByEmail(normalize(req.email())).orElse(null);
        boolean ok = encoder.matches(req.password(), user != null ? user.getPasswordHash() : dummyHash);
        if (user == null || !ok) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Hibás e-mail vagy jelszó");
        }
        if (user.isTotpEnabled()) {
            // A jelszó helyes, de kell a második lépés: kihívást adunk, munkamenetet még nem
            return new LoginResponse(null, null, true, tokens.issueChallenge(user));
        }
        return new LoginResponse(tokens.issue(user), UserDto.of(user), false, null);
    }

    /** A belépés második lépése: a kihívás és a hitelesítő alkalmazás (vagy helyreállító) kódja. Hibás kódra 401. */
    @PostMapping("/login/2fa")
    public AuthResponse loginSecondFactor(@Valid @RequestBody TwoFactorLoginRequest req) {
        Long userId = tokens.verifyChallenge(req.challenge())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Érvénytelen vagy lejárt kihívás"));
        User user = users.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Érvénytelen vagy lejárt kihívás"));
        boolean ok;
        try {
            ok = twoFactor.verifyLogin(user.getId(), req.code());
        } catch (TwoFactorService.TooManyAttempts e) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Túl sok próbálkozás");
        }
        if (!ok) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Hibás kód");
        }
        return new AuthResponse(tokens.issue(user), UserDto.of(user));
    }

    /**
     * Visszaállító link kérése. A válasz mindig ugyanaz (204), akár van ilyen fiók, akár nincs, és akár működik az
     * e-mail-küldés, akár nem: a végpontból így nem derül ki, kinek van fiókja.
     */
    @PostMapping("/forgot-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void forgotPassword(@Valid @RequestBody ForgotPasswordRequest req) {
        passwordReset.requestReset(req.email());
    }

    /** Új jelszó beállítása az e-mailben kapott tokennel. Érvénytelen, lejárt vagy már használt tokenre 400. */
    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@Valid @RequestBody ResetPasswordRequest req) {
        if (!passwordReset.reset(req.token().trim(), req.password())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Érvénytelen vagy lejárt link");
        }
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static ResponseStatusException emailTaken() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "Ezzel az e-mail címmel már van fiók");
    }
}
