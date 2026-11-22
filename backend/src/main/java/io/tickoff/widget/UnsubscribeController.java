package io.tickoff.widget;

import io.tickoff.domain.CommentRepository;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

/**
 * Leiratkozás az ügyfélnek küldött értesítésekről. A levélben szereplő link titka azonosít egy kommentet; a link
 * megnyitása törli a hozzá tartozó e-mail-címet. A válasz mindig ugyanaz az egyszerű oldal, akár volt ilyen
 * feliratkozás, akár nem (érvénytelen vagy már felhasznált link).
 */
@RestController
@RequestMapping("/api/notifications/unsubscribe")
public class UnsubscribeController {

    private static final String PAGE = """
        <!doctype html>
        <html lang="hu"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="robots" content="noindex">
        <title>Leiratkozás</title>
        <style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f5f6fb;color:#1f2140}
        main{max-width:420px;padding:32px;margin:16px;background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(31,33,64,.12)}
        h1{margin:0 0 8px;font-size:20px}p{margin:0;color:#5a5f86;line-height:1.5}</style></head>
        <body><main><h1>Leiratkoztál</h1>
        <p>Erre az e-mail-címre többé nem küldünk értesítést ehhez a visszajelzéshez.
        Ha a link már korábban felhasználásra került, nincs további teendőd.</p></main></body></html>
        """;

    private final CommentRepository comments;

    public UnsubscribeController(CommentRepository comments) {
        this.comments = comments;
    }

    @GetMapping("/{token}")
    @Transactional
    public ResponseEntity<byte[]> unsubscribe(@PathVariable String token) {
        if (token.length() == 32) {
            comments.findByNotifyToken(token).ifPresent(c -> c.unsubscribe());
        }
        return ResponseEntity.ok()
            .contentType(new MediaType("text", "html", StandardCharsets.UTF_8))
            .cacheControl(CacheControl.noStore())
            .header("Referrer-Policy", "no-referrer")
            .body(PAGE.getBytes(StandardCharsets.UTF_8));
    }
}
