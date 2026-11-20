package io.tickoff.auth;

import io.tickoff.auth.AuthController.UserDto;
import io.tickoff.domain.User;
import io.tickoff.domain.UserRepository;
import io.tickoff.widget.ScreenshotStorage;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class MeController {

    public record DeleteAccountRequest(@NotBlank String password) {
    }

    private final UserRepository users;
    private final AccountService accounts;
    private final PasswordEncoder encoder;
    private final ScreenshotStorage storage;

    public MeController(UserRepository users, AccountService accounts, PasswordEncoder encoder,
                        ScreenshotStorage storage) {
        this.users = users;
        this.accounts = accounts;
        this.encoder = encoder;
        this.storage = storage;
    }

    @GetMapping("/api/me")
    public UserDto me(@AuthenticationPrincipal Jwt jwt) {
        return current(jwt).map(UserDto::of)
            // A token érvényes, de a felhasználó közben törlődött.
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
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
