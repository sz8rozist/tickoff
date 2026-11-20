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
    // A fiók törlése jelszót kér, ezért ellopott token mellett is korlátozni kell a találgatást.
    private static final Limit DELETE_ACCOUNT_IP = new Limit("delete-account-ip", 5, 5);

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
            Rule.of(HttpMethod.POST, "/api/widget/{token}/comments", writeIp, writeToken),
            Rule.of(HttpMethod.GET, "/api/widget/{token}/**",
                new Scoped(Scope.IP, WIDGET_READ_IP), new Scoped(Scope.TOKEN, WIDGET_READ_TOKEN)),
            Rule.of(HttpMethod.POST, "/api/auth/login", new Scoped(Scope.IP, LOGIN_IP)),
            Rule.of(HttpMethod.POST, "/api/auth/register", new Scoped(Scope.IP, REGISTER_IP)),
            Rule.of(HttpMethod.DELETE, "/api/me", new Scoped(Scope.IP, DELETE_ACCOUNT_IP))));
    }
}
