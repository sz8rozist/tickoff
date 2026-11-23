package io.tickoff.auth;

import io.tickoff.domain.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import javax.crypto.SecretKey;
import java.util.Optional;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

@Service
public class TokenService {

    /** A kétlépcsős belépés első lépése után kiadott, rövid életű "kihívás" célja: ez a token API-hívásra nem jó. */
    public static final String CHALLENGE_PURPOSE = "two-factor";
    private static final Duration CHALLENGE_TTL = Duration.ofMinutes(5);

    private final JwtEncoder encoder;
    private final Duration ttl;
    private final NimbusJwtDecoder challengeDecoder;

    public TokenService(JwtEncoder encoder, SecretKey jwtSecretKey, @Value("${tickoff.jwt.ttl}") Duration ttl) {
        this.encoder = encoder;
        this.ttl = ttl;
        // Külön dekóder a kihívásokhoz: az általános dekóder éppen az ilyen (purpose) tokeneket utasítja el
        this.challengeDecoder = NimbusJwtDecoder.withSecretKey(jwtSecretKey).macAlgorithm(MacAlgorithm.HS256).build();
        this.challengeDecoder.setJwtValidator(JwtValidators.createDefault());
    }

    /** A jelszó ellenőrzése után kiadott kihívás a második lépéshez (5 percig érvényes, API-hívásra nem használható). */
    public String issueChallenge(User user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer("tickoff")
            .subject(String.valueOf(user.getId()))
            .claim("purpose", CHALLENGE_PURPOSE)
            .issuedAt(now)
            .expiresAt(now.plus(CHALLENGE_TTL))
            .build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }

    /** A kihívásból a felhasználó azonosítója, ha érvényes és lejáratlan. */
    public Optional<Long> verifyChallenge(String token) {
        try {
            var jwt = challengeDecoder.decode(token);
            if (!CHALLENGE_PURPOSE.equals(jwt.getClaimAsString("purpose"))) return Optional.empty();
            return Optional.of(Long.valueOf(jwt.getSubject()));
        } catch (RuntimeException e) {
            return Optional.empty();
        }
    }

    public String issue(User user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer("tickoff")
            .subject(String.valueOf(user.getId()))
            .issuedAt(now)
            .expiresAt(now.plus(ttl))
            .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
}
