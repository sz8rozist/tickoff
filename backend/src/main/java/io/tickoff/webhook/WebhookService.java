package io.tickoff.webhook;

import io.tickoff.domain.Comment;
import io.tickoff.domain.Project;
import io.tickoff.domain.Round;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;

/**
 * A projekt eseményeinek küldése a beállított webhook-címre (ha van). A tartalom úgy van összeállítva, hogy
 * a Slack ({@code text}) és a Discord ({@code content}) bejövő webhookja is közvetlenül elfogadja, saját fogadónak
 * pedig a strukturált mezők ({@code event}, {@code project}, {@code comment}, {@code round}) szolgálnak.
 * A kézbesítés a mentés sikeres lezárása után, külön szálon történik.
 */
@Service
public class WebhookService {

    public static final String COMMENT_CREATED = "comment.created";
    public static final String REPLY_CREATED = "reply.created";
    public static final String COMMENT_REOPENED = "comment.reopened";
    public static final String ROUND_APPROVED = "round.approved";
    public static final String TEST = "test";

    private static final int TEXT_LIMIT = 1800; // a Discord 2000 karakteres korlátja alatt

    private final WebhookSender sender;

    public WebhookService(WebhookSender sender) {
        this.sender = sender;
    }

    /** Esemény küldése, ha a projekthez van webhook. {@code comment} és {@code round} elhagyható. */
    public void publish(Project project, String event, String text, Comment comment, Round round) {
        String url = project.getWebhookUrl();
        if (url == null) return;
        String secret = project.getWebhookSecret();
        long projectId = project.getId();
        String body = payload(project, event, text, comment, round);
        afterCommit(() -> sender.deliverAsync(projectId, url, secret, event, body));
    }

    /** Teszt-üzenet küldése azonnal (a dashboardról kért ellenőrzés), az eredménnyel. */
    public WebhookSender.Result sendTest(Project project) {
        String text = "Tickoff teszt: a(z) „" + project.getName() + "” projekt webhookja működik.";
        return sender.deliver(project.getWebhookUrl(), project.getWebhookSecret(), TEST,
            payload(project, TEST, text, null, null));
    }

    static String payload(Project project, String event, String text, Comment comment, Round round) {
        String clipped = text.length() <= TEXT_LIMIT ? text : text.substring(0, TEXT_LIMIT) + "…";
        StringBuilder json = new StringBuilder("{");
        json.append("\"event\":").append(quote(event));
        json.append(",\"text\":").append(quote(clipped));
        json.append(",\"content\":").append(quote(clipped));
        json.append(",\"timestamp\":").append(quote(Instant.now().toString()));
        json.append(",\"project\":{\"id\":").append(project.getId())
            .append(",\"name\":").append(quote(project.getName())).append('}');
        if (comment != null) {
            json.append(",\"comment\":{\"id\":").append(comment.getId())
                .append(",\"author\":").append(quote(comment.getAuthorName()))
                .append(",\"body\":").append(quote(comment.getBody()))
                .append(",\"pageUrl\":").append(quote(comment.getPageUrl()))
                .append(",\"status\":").append(quote(comment.getStatus().name())).append('}');
        }
        if (round != null) {
            json.append(",\"round\":{\"number\":").append(round.getNumber()).append('}');
        }
        return json.append('}').toString();
    }

    /** JSON-sztring: idézőjelek, perjelek és vezérlőkarakterek escape-elve. */
    static String quote(String s) {
        StringBuilder out = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (c < 0x20) out.append(String.format("\\u%04x", (int) c));
                    else out.append(c);
                }
            }
        }
        return out.append('"').toString();
    }

    /** A küldés a tranzakció sikeres lezárása után; ha nincs tranzakció, azonnal. */
    private static void afterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }
}
