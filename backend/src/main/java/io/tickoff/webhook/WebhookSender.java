package io.tickoff.webhook;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HexFormat;

/**
 * A webhook-kérések tényleges elküldése. Az URL gyakran titkot tartalmaz (pl. egy Slack-webhook útvonala), ezért
 * a naplóba sosem kerül: csak a projekt azonosítója és a hiba oka.
 *
 * <p>Nincs átirányítás-követés (egy átirányítás belső címre vihetne), a kapcsolat és a válasz ideje korlátos,
 * a válasz törzsét nem olvassuk. Újrapróbálkozás nincs: a webhook "legjobb szándékú" értesítés.
 */
@Component
public class WebhookSender {

    private static final Logger log = LoggerFactory.getLogger(WebhookSender.class);

    /** A küldés eredménye: sikeres-e, a válasz HTTP-kódja (0, ha nem érkezett), és a hiba rövid oka. */
    public record Result(boolean ok, int status, String error) {
    }

    private final HttpClient client = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NEVER)
        .connectTimeout(Duration.ofSeconds(5))
        .build();
    private final boolean allowPrivate;

    public WebhookSender(@Value("${tickoff.webhook.allow-private:false}") boolean allowPrivate) {
        this.allowPrivate = allowPrivate;
    }

    public boolean allowPrivate() {
        return allowPrivate;
    }

    /** Aszinkron kézbesítés (a kérés nem vár a fogadóra); a hibát csak naplózzuk. */
    @Async("webhookExecutor")
    public void deliverAsync(long projectId, String url, String secret, String event, String body) {
        Result result = deliver(url, secret, event, body);
        if (!result.ok()) {
            log.warn("A webhook kézbesítése nem sikerült (projekt: {}, esemény: {}): {}", projectId, event, result.error());
        }
    }

    /** Szinkron kézbesítés (a teszt-küldéshez): az eredményt visszaadja. */
    public Result deliver(String url, String secret, String event, String body) {
        try {
            // A címet minden küldés előtt újra ellenőrizzük: a DNS közben megváltozhatott
            URI uri = WebhookUrls.validate(url, allowPrivate);
            HttpRequest.Builder request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(8))
                .header("Content-Type", "application/json; charset=utf-8")
                .header("User-Agent", "Tickoff-Webhook")
                .header("X-Tickoff-Event", event)
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8));
            if (secret != null) {
                request.header("X-Tickoff-Signature", "sha256=" + sign(secret, body));
            }
            HttpResponse<Void> response = client.send(request.build(), HttpResponse.BodyHandlers.discarding());
            int status = response.statusCode();
            return status >= 200 && status < 300
                ? new Result(true, status, null)
                : new Result(false, status, "A fogadó HTTP " + status + " választ adott");
        } catch (IllegalArgumentException e) {
            return new Result(false, 0, e.getMessage());
        } catch (java.net.http.HttpTimeoutException e) {
            return new Result(false, 0, "A fogadó nem válaszolt időben");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Result(false, 0, "A küldés megszakadt");
        } catch (Exception e) {
            return new Result(false, 0, "A fogadó nem érhető el");
        }
    }

    /** HMAC-SHA256 hex: a fogadó ugyanezzel számolhatja ki a várt aláírást a nyers törzsből. */
    static String sign(String secret, String body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
    }
}
