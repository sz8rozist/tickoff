package io.tickoff.auth;

import io.tickoff.domain.User;
import io.tickoff.domain.UserRepository;
import io.tickoff.ratelimit.RateLimiter;
import io.tickoff.ratelimit.RateLimiter.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;

/**
 * Kétlépcsős belépés (TOTP) kezelése: bekapcsolás (titok + megerősítő kód), belépéskori ellenőrzés, kikapcsolás.
 * <ul>
 *   <li>Egy kód csak egyszer használható (a legutóbb elfogadott időszeletnél nem újabb kód elutasítva): lehallgatott
 *       kóddal nem lehet újra belépni.</li>
 *   <li>8 helyreállító kód készül (egyszer használatosak, csak a hash-ük van tárolva), ha elvész a telefon.</li>
 *   <li>A találgatás ellen felhasználónként 5 próbálkozás egyszerre, utána percenként 1.</li>
 * </ul>
 */
@Service
public class TwoFactorService {

    static final String ISSUER = "Tickoff";
    private static final int RECOVERY_CODES = 8;
    private static final Limit ATTEMPTS = new Limit("two-factor-user", 5, 1);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final Clock clock;
    private final UserRepository users;
    private final RateLimiter limiter = new RateLimiter(10_000);

    public TwoFactorService(Clock clock, UserRepository users) {
        this.clock = clock;
        this.users = users;
    }

    /** A felhasználó a hívó tranzakciójában töltődik be (a vezérlőből érkező példány leválasztott, a módosítása nem mentődne). */
    private User load(Long userId) {
        return users.findById(userId).orElseThrow(() -> new IllegalStateException("Ismeretlen felhasználó"));
    }

    public record Setup(String secret, String otpauthUri) {
    }

    /** Új titkot készít a felhasználónak (még nincs bekapcsolva: a megerősítő kód után él). */
    @Transactional
    public Setup setup(Long userId) {
        User user = load(userId);
        if (user.isTotpEnabled()) {
            throw new IllegalStateException("A kétlépcsős belépés már be van kapcsolva");
        }
        String secret = Totp.newSecret();
        user.startTotpSetup(secret);
        return new Setup(secret, Totp.otpauthUri(ISSUER, user.getEmail(), secret));
    }

    /** Megerősíti a beállítást a kóddal, bekapcsolja, és visszaadja az egyszeri helyreállító kódokat. */
    @Transactional
    public List<String> enable(Long userId, String code) {
        User user = load(userId);
        if (user.isTotpEnabled() || user.getTotpSecret() == null) {
            throw new IllegalStateException("Nincs megerősítésre váró beállítás");
        }
        if (!allow(user)) throw new TooManyAttempts();
        long step = Totp.verify(user.getTotpSecret(), code, clock.millis());
        if (step < 0) return null;
        List<String> recovery = newRecoveryCodes();
        user.enableTotp(clock.instant(), step, String.join(",", recovery.stream().map(TwoFactorService::hash).toList()));
        return recovery;
    }

    /**
     * Belépéskori ellenőrzés: TOTP-kód vagy helyreállító kód. @return igaz, ha elfogadva
     * @throws TooManyAttempts ha a felhasználó túl sokszor próbálkozott
     */
    @Transactional
    public boolean verifyLogin(Long userId, String codeOrRecovery) {
        return check(load(userId), codeOrRecovery);
    }

    private boolean check(User user, String codeOrRecovery) {
        if (!allow(user)) throw new TooManyAttempts();
        String candidate = codeOrRecovery == null ? "" : codeOrRecovery.trim();
        if (candidate.matches("\\d{6}")) {
            long step = Totp.verify(user.getTotpSecret(), candidate, clock.millis());
            // A már felhasznált vagy régebbi időszelet nem fogadható el újra
            if (step < 0 || (user.getTotpLastStep() != null && step <= user.getTotpLastStep())) return false;
            user.setTotpLastStep(step);
            return true;
        }
        return consumeRecoveryCode(user, candidate);
    }

    /** Kikapcsolás: a jelszót a hívó ellenőrzi, itt a kódot (TOTP vagy helyreállító). @return igaz, ha kikapcsolva */
    @Transactional
    public boolean disable(Long userId, String codeOrRecovery) {
        User user = load(userId);
        if (!user.isTotpEnabled()) return true;
        if (!check(user, codeOrRecovery)) return false;
        user.clearTotp();
        return true;
    }

    private boolean consumeRecoveryCode(User user, String candidate) {
        String normalized = candidate.toLowerCase().replace(" ", "");
        String hash = hash(normalized);
        String stored = user.getTotpRecoveryHashes();
        if (stored == null || stored.isBlank()) return false;
        List<String> remaining = new ArrayList<>(Arrays.asList(stored.split(",")));
        // Időzítés-biztos összehasonlítás: minden tárolt hash-sel
        boolean found = false;
        for (String h : new ArrayList<>(remaining)) {
            if (MessageDigest.isEqual(h.getBytes(StandardCharsets.UTF_8), hash.getBytes(StandardCharsets.UTF_8))) {
                remaining.remove(h);
                found = true;
            }
        }
        if (found) user.setTotpRecoveryHashes(String.join(",", remaining));
        return found;
    }

    private boolean allow(User user) {
        return limiter.tryAcquire("u" + user.getId(), ATTEMPTS) == 0;
    }

    private static List<String> newRecoveryCodes() {
        List<String> codes = new ArrayList<>();
        for (int i = 0; i < RECOVERY_CODES; i++) {
            byte[] b = new byte[5];
            RANDOM.nextBytes(b);
            String hex = HexFormat.of().formatHex(b); // 10 hex karakter
            codes.add(hex.substring(0, 5) + "-" + hex.substring(5));
        }
        return codes;
    }

    /** A helyreállító kód hash-e (a kötőjel nélküli, kisbetűs alakból). */
    static String hash(String code) {
        try {
            String normalized = code.toLowerCase().replace(" ", "");
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(normalized.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Túl sok sikertelen próbálkozás ugyanarra a fiókra. */
    public static class TooManyAttempts extends RuntimeException {
    }
}
