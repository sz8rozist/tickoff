package io.tickoff.ratelimit;

import io.tickoff.ratelimit.RateLimitFilter.Rule;
import io.tickoff.ratelimit.RateLimitFilter.Scope;
import io.tickoff.ratelimit.RateLimitFilter.Scoped;
import io.tickoff.ratelimit.RateLimiter.Limit;
import org.springframework.http.HttpMethod;

import java.util.List;

/**
 * Az alkalmazás kérésszám-korlátai. Két szűrő van, mert a CORS-szűrőhöz képest kétféle helyen kell futniuk:
 * <ul>
 *   <li>{@link #beforeCors}: durva IP-korlát a widget összes kérésére, az OPTIONS (preflight) kérésekre is.
 *       Minden widget-kérés (preflight is) adatbázis-lekérdezéssel jár a CORS-beállításhoz, ezt védjük vele.
 *       A 429-es válaszon itt még nincs CORS-fejléc.</li>
 *   <li>{@link #afterCors}: a pontos korlátok. Itt a 429-es válasz már tartalmazza a CORS-fejléceket,
 *       így a widget a böngészőben is el tudja olvasni.</li>
 * </ul>
 * A kulcs az IP-cím (a szerver által látott távoli cím) és a widget tokenje. Proxy mögött a valódi kliens-IP-t
 * a szervernek kell kiolvasnia (lásd README), különben minden kliens egy vödörbe kerül.
 */
public final class RateLimits {

    private static final int MAX_KEYS = 50_000;

    // Widget: írás (komment + képernyőkép). Egy komment 2 kérés (komment, kép), tehát percenként ~10 komment.
    private static final Limit WIDGET_WRITE_IP = new Limit("widget-write-ip", 20, 20);
    private static final Limit WIDGET_WRITE_TOKEN = new Limit("widget-write-token", 120, 120);

    // Widget: olvasás (projekt, kommentek). Egy oldalbetöltés 2 kérés.
    private static final Limit WIDGET_READ_IP = new Limit("widget-read-ip", 60, 120);
    private static final Limit WIDGET_READ_TOKEN = new Limit("widget-read-token", 120, 600);

    // Durva korlát, a preflightot is beleértve.
    private static final Limit WIDGET_COARSE_IP = new Limit("widget-coarse-ip", 200, 300);

    // Jelszavas végpontok: nyers erő és tömeges regisztráció ellen.
    private static final Limit LOGIN_IP = new Limit("login-ip", 10, 10);
    private static final Limit REGISTER_IP = new Limit("register-ip", 5, 5);
    // Jelszó-visszaállítás: a levélküldés és a találgatás ellen. Fiókonként külön korlát is van (óránként 3 levél).
    private static final Limit FORGOT_PASSWORD_IP = new Limit("forgot-password-ip", 5, 5);
    private static final Limit RESET_PASSWORD_IP = new Limit("reset-password-ip", 10, 10);
    // A meghívás e-mail alapján keres fiókot: a létezésük így kideríthető, ezért korlátozzuk.
    private static final Limit INVITE_IP = new Limit("invite-ip", 20, 20);
    // A fiók törlése jelszót kér, ezért ellopott token mellett is korlátozni kell a találgatást.
    private static final Limit DELETE_ACCOUNT_IP = new Limit("delete-account-ip", 5, 5);
    // A leiratkozó link titka 128 bites, de a találgatást így is korlátozzuk.
    // E-mail-megerősítés: a token találgatása és a levélküldés ellen
    private static final Limit VERIFY_EMAIL_IP = new Limit("verify-email-ip", 10, 10);
    private static final Limit RESEND_VERIFICATION_IP = new Limit("resend-verification-ip", 5, 5);
    private static final Limit UNSUBSCRIBE_IP = new Limit("unsubscribe-ip", 10, 10);
    // A teszt-webhook kimenő kérést indít a szerverről, ezért szigorúan korlátozzuk.
    private static final Limit WEBHOOK_TEST_IP = new Limit("webhook-test-ip", 5, 5);

    private RateLimits() {
    }

    public static RateLimitFilter beforeCors() {
        return new RateLimitFilter("rateLimitBeforeCors", new RateLimiter(MAX_KEYS), List.of(
            Rule.of(null, "/api/widget/**", new Scoped(Scope.IP, WIDGET_COARSE_IP))));
    }

    public static RateLimitFilter afterCors() {
        Scoped writeIp = new Scoped(Scope.IP, WIDGET_WRITE_IP);
        Scoped writeToken = new Scoped(Scope.TOKEN, WIDGET_WRITE_TOKEN);
        return new RateLimitFilter("rateLimitAfterCors", new RateLimiter(MAX_KEYS), List.of(
            // Specifikusabb szabályok elöl: az első egyező érvényes.
            Rule.of(HttpMethod.POST, "/api/widget/{token}/comments/{id}/screenshot", writeIp, writeToken),
            Rule.of(HttpMethod.POST, "/api/widget/{token}/comments/{id}/replies", writeIp, writeToken),
            Rule.of(HttpMethod.POST, "/api/widget/{token}/comments", writeIp, writeToken),
            // Elfogadás, visszanyitás, kör jóváhagyása
            Rule.of(HttpMethod.POST, "/api/widget/{token}/**", writeIp, writeToken),
            Rule.of(HttpMethod.GET, "/api/widget/{token}/**",
                new Scoped(Scope.IP, WIDGET_READ_IP), new Scoped(Scope.TOKEN, WIDGET_READ_TOKEN)),
            Rule.of(HttpMethod.POST, "/api/auth/login", new Scoped(Scope.IP, LOGIN_IP)),
            Rule.of(HttpMethod.POST, "/api/auth/register", new Scoped(Scope.IP, REGISTER_IP)),
            Rule.of(HttpMethod.POST, "/api/auth/forgot-password", new Scoped(Scope.IP, FORGOT_PASSWORD_IP)),
            Rule.of(HttpMethod.POST, "/api/auth/verify-email", new Scoped(Scope.IP, VERIFY_EMAIL_IP)),
            Rule.of(HttpMethod.POST, "/api/me/verification", new Scoped(Scope.IP, RESEND_VERIFICATION_IP)),
            Rule.of(HttpMethod.POST, "/api/projects/{id}/members/invites", new Scoped(Scope.IP, INVITE_IP)),
            Rule.of(HttpMethod.POST, "/api/auth/reset-password", new Scoped(Scope.IP, RESET_PASSWORD_IP)),
            Rule.of(HttpMethod.POST, "/api/projects/{id}/webhook/test", new Scoped(Scope.IP, WEBHOOK_TEST_IP)),
            Rule.of(HttpMethod.GET, "/api/notifications/unsubscribe/{token}", new Scoped(Scope.IP, UNSUBSCRIBE_IP)),
            Rule.of(HttpMethod.DELETE, "/api/me", new Scoped(Scope.IP, DELETE_ACCOUNT_IP)),
            Rule.of(HttpMethod.POST, "/api/projects/{id}/members", new Scoped(Scope.IP, INVITE_IP))));
    }
}
