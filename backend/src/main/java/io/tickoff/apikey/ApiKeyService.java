package io.tickoff.apikey;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

/**
 * API-kulcsok kiadása és ellenőrzése. A kulcs 256 bit véletlen ({@code tk_} előtaggal), a teljes értékét csak
 * a létrehozáskor látja a felhasználó; az adatbázisban az SHA-256 hash-e van (a kulcs nagy entrópiája miatt a
 * gyors hash elég). Felhasználónként legfeljebb {@value #MAX_KEYS} kulcs lehet.
 */
@Service
public class ApiKeyService {

    public static final String PREFIX = "tk_";
    static final int MAX_KEYS = 10;
    /** A "legutóbb használva" időt legfeljebb ilyen sűrűn írjuk (ne legyen írás minden kérésnél). */
    private static final Duration TOUCH_INTERVAL = Duration.ofMinutes(1);
    private static final SecureRandom RANDOM = new SecureRandom();

    /** A létrehozás eredménye: a nyers kulcs (csak most látható) és a tárolt adatai. */
    public record Created(String key, ApiKey entity) {
    }

    private final ApiKeyRepository keys;
    private final Clock clock;

    public ApiKeyService(ApiKeyRepository keys, Clock clock) {
        this.keys = keys;
        this.clock = clock;
    }

    /** @throws IllegalStateException ha a felhasználónak már van {@value #MAX_KEYS} kulcsa */
    @Transactional
    public Created create(Long userId, String name) {
        if (keys.countByUserId(userId) >= MAX_KEYS) {
            throw new IllegalStateException("Legfeljebb " + MAX_KEYS + " API-kulcs lehet");
        }
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String key = PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        ApiKey saved = keys.save(new ApiKey(userId, name.trim(), key.substring(0, 8), hash(key)));
        return new Created(key, saved);
    }

    /** A kulcshoz tartozó felhasználó azonosítója, ha a kulcs érvényes. */
    @Transactional
    public Optional<Long> authenticate(String rawKey) {
        if (rawKey == null || !rawKey.startsWith(PREFIX) || rawKey.length() > 100) return Optional.empty();
        Optional<ApiKey> found = keys.findByKeyHash(hash(rawKey));
        found.ifPresent(k -> {
            Instant now = clock.instant();
            if (k.getLastUsedAt() == null || now.isAfter(k.getLastUsedAt().plus(TOUCH_INTERVAL))) {
                k.touch(now);
            }
        });
        return found.map(ApiKey::getUserId);
    }

    static String hash(String key) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
