package io.tickoff.auth;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import io.tickoff.domain.UserRepository;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

@Configuration
public class JwtConfig {

    private static final int MIN_SECRET_BYTES = 32;

    /** A fejlesztői alapérték (application.yml) töredéke: élesben ilyen titokkal nem indulunk el. */
    private static final String DEV_SECRET_MARKER = "dev-only-secret";

    @Bean
    SecretKey jwtSecretKey(@Value("${tickoff.jwt.secret}") String secret, Environment env) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                "tickoff.jwt.secret legalább " + MIN_SECRET_BYTES + " bájt hosszú kell legyen (HS256)");
        }
        if (env.acceptsProfiles(Profiles.of("prod")) && secret.contains(DEV_SECRET_MARKER)) {
            throw new IllegalStateException(
                "A fejlesztői JWT-titok nem használható a prod profillal: állíts be egy saját TICKOFF_JWT_SECRET-et");
        }
        return new SecretKeySpec(bytes, "HmacSHA256");
    }

    @Bean
    JwtEncoder jwtEncoder(SecretKey jwtSecretKey) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(jwtSecretKey));
    }

    @Bean
    JwtDecoder jwtDecoder(SecretKey jwtSecretKey, UserRepository users) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(jwtSecretKey).macAlgorithm(MacAlgorithm.HS256).build();
        // Az alap ellenőrzések (lejárat) mellett: a token érvénytelen, ha a felhasználó törlődött, vagy a jelszava
        // a token kiadása után változott (jelszó-visszaállítás).
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
            JwtValidators.createDefault(), new PasswordChangedValidator(users)));
        return decoder;
    }
}
