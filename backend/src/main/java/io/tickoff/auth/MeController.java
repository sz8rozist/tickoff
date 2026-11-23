package io.tickoff.auth;

import java.util.List;
import java.util.Map;
import io.tickoff.auth.AuthController.UserDto;
import io.tickoff.domain.User;
import io.tickoff.domain.UserRepository;
import io.tickoff.widget.ScreenshotStorage;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class MeController {

    public record DeleteAccountRequest(@NotBlank String password) {
    }

    public record SettingsRequest(@NotNull Boolean notifyEmail) {
    }

    public record TwoFactorCodeRequest(@NotBlank @jakarta.validation.constraints.Size(max = 40) String code) {
    }

    public record TwoFactorDisableRequest(@NotBlank String password,
                                          @NotBlank @jakarta.validation.constraints.Size(max = 40) String code) {
    }

    public record DigestRequest(@jakarta.validation.constraints.Pattern(regexp = "^(OFF|DAILY|WEEKLY)$") String frequency) {
    }

    private final UserRepository users;
    private final AccountService accounts;
    private final PasswordEncoder encoder;
    private final ScreenshotStorage storage;
    private final EmailVerificationService verification;
    private final TwoFactorService twoFactor;

    public MeController(UserRepository users, AccountService accounts, PasswordEncoder encoder,
                        ScreenshotStorage storage, EmailVerificationService verification,
                        TwoFactorService twoFactor) {
        this.users = users;
        this.accounts = accounts;
        this.encoder = encoder;
        this.storage = storage;
        this.verification = verification;
        this.twoFactor = twoFactor;
    }

    @GetMapping("/api/me")
    public UserDto me(@AuthenticationPrincipal Jwt jwt) {
        return current(jwt).map(UserDto::of)
            // A token érvényes, de a felhasználó közben törlődött.
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    /** A kétlépcsős belépés beállítása: új titok és a hitelesítő alkalmazásba olvasható cím (QR-hoz). */
    @org.springframework.web.bind.annotation.PostMapping("/api/me/2fa/setup")
    public TwoFactorService.Setup twoFactorSetup(@AuthenticationPrincipal Jwt jwt) {
        User user = current(jwt).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        try {
            return twoFactor.setup(user.getId());
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
    }

    /** Bekapcsolás a hitelesítő alkalmazás első kódjával; a válasz az egyszeri helyreállító kódokat tartalmazza. */
    @org.springframework.web.bind.annotation.PostMapping("/api/me/2fa/enable")
    public Map<String, List<String>> twoFactorEnable(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody TwoFactorCodeRequest req) {
        User user = current(jwt).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        try {
            List<String> codes = twoFactor.enable(user.getId(), req.code().trim());
            if (codes == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hibás kód");
            return Map.of("recoveryCodes", codes);
        } catch (TwoFactorService.TooManyAttempts e) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Túl sok próbálkozás");
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
    }

    /** Kikapcsolás a jelszóval és egy érvényes kóddal (hitelesítő vagy helyreállító). */
    @org.springframework.web.bind.annotation.PostMapping("/api/me/2fa/disable")
    @org.springframework.web.bind.annotation.ResponseStatus(HttpStatus.NO_CONTENT)
    public void twoFactorDisable(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody TwoFactorDisableRequest req) {
        User user = current(jwt).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!encoder.matches(req.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Hibás jelszó");
        }
        try {
            if (!twoFactor.disable(user.getId(), req.code())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hibás kód");
            }
        } catch (TwoFactorService.TooManyAttempts e) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Túl sok próbálkozás");
        }
    }

    /** Az összefoglaló e-mail gyakorisága: OFF, DAILY (naponta reggel 8-kor) vagy WEEKLY (hétfőn). */
    @org.springframework.web.bind.annotation.PatchMapping("/api/me/digest")
    public UserDto updateDigest(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody DigestRequest req) {
        User user = current(jwt).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        user.setDigestFrequency(req.frequency());
        return UserDto.of(users.save(user));
    }

    /** Beállítások: az e-mail értesítések be- és kikapcsolása. */
    /** Új megerősítő levél kérése (percenként legfeljebb egy megy el; megerősített fióknál nem történik semmi). */
    @org.springframework.web.bind.annotation.PostMapping("/api/me/verification")
    @org.springframework.web.bind.annotation.ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void resendVerification(@AuthenticationPrincipal Jwt jwt) {
        verification.sendVerification(Long.valueOf(jwt.getSubject()));
    }

    @PatchMapping("/api/me")
    public UserDto updateSettings(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SettingsRequest req) {
        User user = current(jwt).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        user.setNotifyEmail(req.notifyEmail());
        return UserDto.of(users.save(user));
    }

    /**
     * Fiók törlése a jelszó megadásával. A felhasználó saját projektjei is törlődnek, a körökkel, kommentekkel és
     * képernyőképekkel együtt. Nem visszavonható. Hibás jelszóra 403-at adunk (nem 401-et), hogy a kliens
     * ne tekintse lejárt munkamenetnek.
     */
    @DeleteMapping("/api/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMe(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody DeleteAccountRequest req) {
        User user = current(jwt).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!encoder.matches(req.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Hibás jelszó");
        }
        accounts.deleteAccount(user).forEach(storage::deleteProject);
    }

    private java.util.Optional<User> current(Jwt jwt) {
        return users.findById(Long.valueOf(jwt.getSubject()));
    }
}
