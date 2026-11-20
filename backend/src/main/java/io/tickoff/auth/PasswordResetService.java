package io.tickoff.auth;

import io.tickoff.domain.PasswordResetToken;
import io.tickoff.domain.PasswordResetTokenRepository;
import io.tickoff.domain.User;
import io.tickoff.domain.UserRepository;
import io.tickoff.mail.MailService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
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
import java.util.Locale;
import java.util.Optional;

/**
 * Jelszó-visszaállítás e-mailben küldött, egyszer használatos linkkel.
 * <ul>
 *   <li>A link tokenjét csak hash-ként tároljuk, 1 óráig érvényes, és sikeres használat után (vagy újabb kérésre) érvénytelen.</li>
 *   <li>A kérés válasza nem árulja el, hogy létezik-e a fiók.</li>
 *   <li>Egy fiókra óránként legfeljebb 3 levél megy (levélbombázás ellen).</li>
 *   <li>Sikeres visszaállítás után a fiók korábbi bejelentkezései is érvénytelenek.</li>
 * </ul>
 */
@Service
public class PasswordResetService {

    static final Duration TTL = Duration.ofHours(1);
    static final int MAX_REQUESTS_PER_HOUR = 3;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository users;
    private final PasswordResetTokenRepository tokens;
    private final PasswordEncoder encoder;
    private final MailService mail;
    private final Clock clock;
    private final String baseUrl;

    public PasswordResetService(UserRepository users, PasswordResetTokenRepository tokens, PasswordEncoder encoder,
                                MailService mail, Clock clock, @Value("${tickoff.dashboard-origin}") String baseUrl) {
        this.users = users;
        this.tokens = tokens;
        this.encoder = encoder;
        this.mail = mail;
        this.clock = clock;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
    }

    /** Visszaállító levelet küld, ha van ilyen fiók. A hívó mindenképp ugyanazt a választ adja. */
    @Transactional
    public void requestReset(String email) {
        Optional<User> found = users.findByEmail(email.trim().toLowerCase(Locale.ROOT));
        if (found.isEmpty() || !mail.isEnabled()) return;
        User user = found.get();
        Instant now = clock.instant();

        if (tokens.countByUserIdAndCreatedAtAfter(user.getId(), now.minus(Duration.ofHours(1))) >= MAX_REQUESTS_PER_HOUR) {
            return;
        }
        // Az újabb kérés érvényteleníti a korábbi, még fel nem használt linkeket (a sorok megmaradnak a számláláshoz)
        tokens.invalidateUnusedByUserId(user.getId(), now);
        tokens.deleteOlderThan(now.minus(Duration.ofDays(7)));

        String rawToken = newToken();
        tokens.save(new PasswordResetToken(user, hash(rawToken), now.plus(TTL)));

        String link = baseUrl + "/?reset-token=" + rawToken;
        mail.send(user.getEmail(), "Tickoff: jelszó-visszaállítás",
            "Szia " + user.getName() + "!\n\n"
                + "Jelszó-visszaállítást kértek a Tickoff fiókodhoz. Az új jelszó megadásához nyisd meg ezt a linket "
                + "(egy óráig érvényes, és csak egyszer használható):\n\n"
                + link + "\n\n"
                + "Ha nem te kérted, hagyd figyelmen kívül ezt a levelet: a jelszavad nem változik.\n");
    }

    /** @return igaz, ha a token érvényes volt, és az új jelszó beállítva; hamis, ha ismeretlen, lejárt vagy használt */
    @Transactional
    public boolean reset(String rawToken, String newPassword) {
        Instant now = clock.instant();
        Optional<PasswordResetToken> found = tokens.findByTokenHashWithUser(hash(rawToken));
        if (found.isEmpty() || !found.get().isUsable(now)) return false;

        PasswordResetToken token = found.get();
        User user = token.getUser();
        user.changePassword(encoder.encode(newPassword), now);
        token.markUsed(now);
        tokens.invalidateUnusedByUserId(user.getId(), now);
        return true;
    }

    private static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String hash(String rawToken) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
