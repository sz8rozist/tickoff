package io.tickoff.auth;

import io.tickoff.domain.UserRepository;
import io.tickoff.domain.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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

    public record UserDto(Long id, String email, String name) {
        static UserDto of(User u) {
            return new UserDto(u.getId(), u.getEmail(), u.getName());
        }
    }

    public record AuthResponse(String token, UserDto user) {
    }

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final TokenService tokens;
    // Nem létező felhasználónál is ezzel számolunk, így a válaszidő nem árulja el, hogy létezik-e az e-mail.
    private final String dummyHash;

    public AuthController(UserRepository users, PasswordEncoder encoder, TokenService tokens) {
        this.users = users;
        this.encoder = encoder;
        this.tokens = tokens;
        this.dummyHash = encoder.encode("tickoff-dummy-password");
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest req) {
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

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static ResponseStatusException emailTaken() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "Ezzel az e-mail címmel már van fiók");
    }
}
