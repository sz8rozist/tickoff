package io.tickoff.auth;

import io.tickoff.domain.User;
import io.tickoff.domain.UserRepository;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

/**
 * Érvénytelenít minden bejelentkezési tokent, ha a felhasználó nem létezik, vagy a token a jelszó legutóbbi
 * megváltoztatása előtt készült. Így egy jelszó-visszaállítás után a (talán ellopott) régi munkamenetek is megszűnnek.
 */
public class PasswordChangedValidator implements OAuth2TokenValidator<Jwt> {

    private static final OAuth2Error INVALID = new OAuth2Error("invalid_token", "A bejelentkezés már nem érvényes", null);

    private final UserRepository users;

    public PasswordChangedValidator(UserRepository users) {
        this.users = users;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        Optional<User> user = parseId(jwt.getSubject()).flatMap(users::findById);
        if (user.isEmpty()) {
            return OAuth2TokenValidatorResult.failure(INVALID);
        }
        Instant changedAt = user.get().getPasswordChangedAt();
        Instant issuedAt = jwt.getIssuedAt();
        // A token kiadási ideje másodperc pontosságú, ezért a jelszócsere idejét is másodpercre vágjuk: az ugyanabban a
        // másodpercben, a csere után kiadott új token nem lehet érvénytelen.
        if (changedAt != null && (issuedAt == null || issuedAt.isBefore(changedAt.truncatedTo(ChronoUnit.SECONDS)))) {
            return OAuth2TokenValidatorResult.failure(INVALID);
        }
        return OAuth2TokenValidatorResult.success();
    }

    private static Optional<Long> parseId(String subject) {
        try {
            return Optional.of(Long.valueOf(subject));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }
}
