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

    public record UserDto(Long id, String email, String name, boolean notifyEmail) {
        static UserDto of(User u) {
            return new UserDto(u.getId(), u.getEmail(), u.getName(), u.isNotifyEmail());
        }
    }

    public record AuthResponse(String token, UserDto user) {
    }

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final TokenService tokens;
    // Nem létező felhasználónál is ezzel számolunk, így a válaszidő nem árulja el, hogy létezik-e az e-mail.
    private final String dummyHash;

    private final PasswordResetService passwordReset;
    private final boolean registrationEnabled;

    public AuthController(UserRepository users, PasswordEncoder encoder, TokenService tokens,
                          PasswordResetService passwordReset,
                          @Value("${tickoff.registration.enabled:true}") boolean registrationEnabled) {
        this.users = users;
        this.encoder = encoder;
        this.tokens = tokens;
        this.passwordReset = passwordReset;
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
        return new AuthResponse(tokens.issue(user), UserDto.of(user));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        User user = users.findByEmail(normalize(req.email())).orElse(null);
        boolean ok = encoder.matches(req.password(), user != null ? user.getPasswordHash() : dummyHash);
        if (user == null || !ok) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Hibás e-mail vagy jelszó");
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
