package io.tickoff.auth;

import io.tickoff.domain.User;
import io.tickoff.domain.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PasswordChangedValidatorTest {

    private static final Instant CHANGED = Instant.parse("2026-11-20T12:00:00.600Z");

    private final UserRepository users = mock(UserRepository.class);
    private final User user = mock(User.class);
    private PasswordChangedValidator validator;

    @BeforeEach
    void setUp() {
        when(users.findById(7L)).thenReturn(Optional.of(user));
        validator = new PasswordChangedValidator(users);
    }

    private static Jwt token(String subject, Instant issuedAt) {
        Jwt.Builder b = Jwt.withTokenValue("t").header("alg", "HS256").subject(subject);
        if (issuedAt != null) b.issuedAt(issuedAt).expiresAt(issuedAt.plusSeconds(3600));
        else b.claim("x", "y");
        return b.build();
    }

    @Test
    void tokenOfAnUnchangedPasswordIsValid() {
        when(user.getPasswordChangedAt()).thenReturn(null);
        assertThat(validator.validate(token("7", Instant.parse("2026-11-20T10:00:00Z"))).hasErrors()).isFalse();
    }

    @Test
    void tokenIssuedBeforeThePasswordChangeIsInvalid() {
        when(user.getPasswordChangedAt()).thenReturn(CHANGED);
        assertThat(validator.validate(token("7", Instant.parse("2026-11-20T11:59:59Z"))).hasErrors()).isTrue();
    }

    @Test
    void tokenIssuedInTheSameSecondAsTheChangeIsStillValid() {
        // A token kiadási ideje másodperc pontosságú: a csere (12:00:00.600) másodpercében kiadott új token érvényes
        when(user.getPasswordChangedAt()).thenReturn(CHANGED);
        assertThat(validator.validate(token("7", Instant.parse("2026-11-20T12:00:00Z"))).hasErrors()).isFalse();
        assertThat(validator.validate(token("7", Instant.parse("2026-11-20T12:05:00Z"))).hasErrors()).isFalse();
    }

    @Test
    void tokenWithoutIssueTimeIsInvalidOnceThePasswordWasChanged() {
        when(user.getPasswordChangedAt()).thenReturn(CHANGED);
        assertThat(validator.validate(token("7", null)).hasErrors()).isTrue();
    }

    @Test
    void tokenOfADeletedOrMalformedSubjectIsInvalid() {
        assertThat(validator.validate(token("99", Instant.now())).hasErrors()).isTrue();
        assertThat(validator.validate(token("nem-szam", Instant.now())).hasErrors()).isTrue();
    }
}
