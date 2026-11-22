package io.tickoff.auth;

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

    private final UserRepository users;
    private final AccountService accounts;
    private final PasswordEncoder encoder;
    private final ScreenshotStorage storage;
    private final EmailVerificationService verification;

    public MeController(UserRepository users, AccountService accounts, PasswordEncoder encoder,
                        ScreenshotStorage storage, EmailVerificationService verification) {
        this.users = users;
        this.accounts = accounts;
        this.encoder = encoder;
        this.storage = storage;
        this.verification = verification;
    }

    @GetMapping("/api/me")
    public UserDto me(@AuthenticationPrincipal Jwt jwt) {
        return current(jwt).map(UserDto::of)
            // A token érvényes, de a felhasználó közben törlődött.
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
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
