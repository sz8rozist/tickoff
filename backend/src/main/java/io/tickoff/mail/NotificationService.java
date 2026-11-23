package io.tickoff.mail;

import io.tickoff.domain.Comment;
import io.tickoff.domain.Project;
import io.tickoff.domain.ProjectMemberRepository;
import io.tickoff.domain.Reply;
import io.tickoff.domain.Round;
import io.tickoff.domain.User;
import io.tickoff.domain.UserRepository;
import io.tickoff.ratelimit.RateLimiter;
import io.tickoff.ratelimit.RateLimiter.Limit;
import io.tickoff.webhook.WebhookService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * E-mail értesítés a projekt csapatának (tulajdonos és tagok) az ügyfelektől érkező visszajelzésekről:
 * új komment és új ügyfél-válasz. Aki kikapcsolta az értesítéseket, nem kap levelet.
 *
 * <p>A levél csak a sikeres adatbázis-mentés után megy el, és címzettenként korlátozott (inbox- és SMTP-hírnév
 * védelem): tartós, nagy forgalomnál a felesleges levelek elmaradnak, a kommentek ettől még mentődnek.
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    /** Címzettenként legfeljebb 10 levél egyszerre, utána percenként 1. */
    private static final Limit PER_RECIPIENT = new Limit("notify-recipient", 10, 1);
    private static final int EXCERPT_LENGTH = 500;

    private final UserRepository users;
    private final ProjectMemberRepository members;
    private final MailService mail;
    private final WebhookService webhooks;
    private final RateLimiter limiter = new RateLimiter(10_000);
    private final String baseUrl;

    public NotificationService(UserRepository users, ProjectMemberRepository members, MailService mail,
                               WebhookService webhooks, @Value("${tickoff.dashboard-origin}") String baseUrl) {
        this.users = users;
        this.members = members;
        this.mail = mail;
        this.webhooks = webhooks;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
    }

    public void newComment(Project project, Comment comment) {
        webhooks.publish(project, WebhookService.COMMENT_CREATED,
            "[" + project.getName() + "] Új visszajelzés " + comment.getAuthorName() + " tollából (" + comment.getPageUrl()
                + "):\n" + excerpt(comment.getBody()), comment, null);
        notifyTeam(project,
            "Új visszajelzés: " + project.getName(),
            comment.getAuthorName() + " új visszajelzést írt a(z) „" + project.getName() + "” projektben"
                + " (oldal: " + comment.getPageUrl() + "):\n\n" + excerpt(comment.getBody()));
    }

    public void customerReply(Project project, Comment comment, Reply reply) {
        webhooks.publish(project, WebhookService.REPLY_CREATED,
            "[" + project.getName() + "] " + reply.getAuthorName() + " válaszolt (" + comment.getPageUrl() + "):\n"
                + excerpt(reply.getBody()), comment, null);
        notifyTeam(project,
            "Új válasz: " + project.getName(),
            reply.getAuthorName() + " válaszolt " + comment.getAuthorName() + " visszajelzésére a(z) „"
                + project.getName() + "” projektben (oldal: " + comment.getPageUrl() + "):\n\n" + excerpt(reply.getBody()));
    }

    /** Valaki egy kommentet másra bízott: az új felelős értesítést kap (ha nem kapcsolta ki). */
    public void assigned(Project project, Comment comment, User assignee, String by) {
        if (!mail.isEnabled() || !assignee.isNotifyEmail()) return;
        String text = by + " rád bízta ezt a visszajelzést a(z) „" + project.getName() + "” projektben"
            + " (oldal: " + comment.getPageUrl() + "):\n\n" + excerpt(comment.getBody())
            + "\n\nMegnyitás: " + baseUrl + "/\n\n"
            + "Ezt a levelet azért kaptad, mert a Tickoffban értesítést kértél. "
            + "A beállítást a Tickoff felületén kapcsolhatod ki.\n";
        String email = assignee.getEmail();
        Long id = assignee.getId();
        afterCommit(() -> {
            if (limiter.tryAcquire("u" + id, PER_RECIPIENT) == 0) {
                mail.send(email, "[Tickoff] Feladatot kaptál: " + project.getName(), text);
            }
        });
    }

    /** Az ügyfél újranyitotta a kész kommentet: a csapatnak tudnia kell, hogy dolga van vele. */
    public void commentReopened(Project project, Comment comment, String by, String reason) {
        webhooks.publish(project, WebhookService.COMMENT_REOPENED,
            "[" + project.getName() + "] " + by + " újranyitotta a kész visszajelzést (" + comment.getPageUrl() + "):\n"
                + excerpt(comment.getBody()) + (reason == null || reason.isBlank() ? "" : "\nIndoklás: " + excerpt(reason)),
            comment, null);
        notifyTeam(project,
            "Újranyitott visszajelzés: " + project.getName(),
            by + " újranyitotta a kész visszajelzését a(z) „" + project.getName() + "” projektben"
                + " (oldal: " + comment.getPageUrl() + "):\n\n" + excerpt(comment.getBody())
                + (reason == null || reason.isBlank() ? "" : "\n\nIndoklás: " + excerpt(reason)));
    }

    /** Az ügyfél jóváhagyta a kört: minden visszajelzése kész. */
    public void roundApproved(Project project, Round round, String by) {
        webhooks.publish(project, WebhookService.ROUND_APPROVED,
            "[" + project.getName() + "] " + by + " jóváhagyta a " + round.getNumber() + ". kört: minden visszajelzés kész.",
            null, round);
        notifyTeam(project,
            "Az ügyfél jóváhagyta a kört: " + project.getName(),
            by + " jóváhagyta a(z) „" + project.getName() + "” projekt " + round.getNumber() + ". körét: "
                + "minden visszajelzés kész. Lezárhatod a kört.");
    }

    /** A csapat válaszolt: ha az ügyfél megadta az e-mail-címét, értesítjük. */
    public void designerReply(Project project, Comment comment, Reply reply) {
        if (project.isEnglish()) {
            notifyCustomer(comment, "Reply to your feedback: " + project.getName(),
                reply.getAuthorName() + " (from the team) replied to your feedback on the \"" + project.getName()
                    + "\" project:\n\n" + excerpt(reply.getBody()));
            return;
        }
        notifyCustomer(comment, "Válasz a visszajelzésedre: " + project.getName(),
            reply.getAuthorName() + " (a csapatból) válaszolt a visszajelzésedre a(z) „" + project.getName()
                + "” projektben:\n\n" + excerpt(reply.getBody()));
    }

    /** A csapat késznek jelölte a kommentet: az ügyfél megnézheti, elfogadhatja vagy visszanyithatja. */
    public void commentDone(Project project, Comment comment) {
        if (project.isEnglish()) {
            notifyCustomer(comment, "A fix is ready: " + project.getName(),
                "The team marked your feedback as done in the \"" + project.getName() + "\" project:\n\n"
                    + excerpt(comment.getBody()) + "\n\nYou can review it on the page, where you can also approve it or reopen it.");
            return;
        }
        notifyCustomer(comment, "Elkészült a javítás: " + project.getName(),
            "A csapat késznek jelölte a visszajelzésedet a(z) „" + project.getName() + "” projektben:\n\n"
                + excerpt(comment.getBody()) + "\n\nMegnézheted az oldalon, ott el is fogadhatod, vagy visszanyithatod.");
    }

    /**
     * Levél az ügyfélnek, ha a komment írója megadott e-mail-címet. A levél a kommentre mutató linket és
     * leiratkozó linket tartalmaz. Címenként ugyanaz a korlát él, mint a csapat tagjainál.
     */
    private void notifyCustomer(Comment comment, String subject, String message) {
        String email = comment.getCustomerEmail();
        String token = comment.getNotifyToken();
        if (!mail.isEnabled() || email == null || token == null) return;

        boolean en = comment.getRound().getProject().isEnglish();
        if (en) {
            String textEn = "Hi " + comment.getAuthorName() + "!\n\n" + message
                + "\n\nOpen on the page: " + deepLink(comment.getPageUrl(), comment.getId())
                + "\n\nYou received this email because you gave your email address when submitting your feedback. "
                + "If you do not want more notifications, you can unsubscribe here: "
                + baseUrl + "/api/notifications/unsubscribe/" + token + "\n";
            afterCommit(() -> {
                if (limiter.tryAcquire("c" + email.toLowerCase(), PER_RECIPIENT) == 0) {
                    mail.send(email, "[Tickoff] " + subject, textEn);
                } else {
                    log.info("Customer notification skipped (per-address limit), comment: {}", comment.getId());
                }
            });
            return;
        }
        String text = "Szia " + comment.getAuthorName() + "!\n\n" + message
            + "\n\nMegnyitás az oldalon: " + deepLink(comment.getPageUrl(), comment.getId())
            + "\n\nEzt a levelet azért kaptad, mert a visszajelzésed beküldésekor megadtad az e-mail-címedet. "
            + "Ha nem szeretnél több értesítést, itt leiratkozhatsz: "
            + baseUrl + "/api/notifications/unsubscribe/" + token + "\n";

        afterCommit(() -> {
            if (limiter.tryAcquire("c" + email.toLowerCase(), PER_RECIPIENT) == 0) {
                mail.send(email, "[Tickoff] " + subject, text);
            } else {
                log.info("Ügyfél-értesítés kihagyva (címenkénti korlát), komment: {}", comment.getId());
            }
        });
    }

    /** Az oldal címe a komment mélylinkjével (a widget ezt a paramétert olvassa ki). */
    static String deepLink(String pageUrl, Long commentId) {
        return UriComponentsBuilder.fromUriString(pageUrl)
            .replaceQueryParam("tickoff-comment", commentId)
            .build().toUriString();
    }

    private void notifyTeam(Project project, String subject, String message) {
        if (!mail.isEnabled()) return;

        // Címzettek: tulajdonos és tagok, akik nem kapcsolták ki az értesítéseket. Tranzakción belül gyűjtjük
        // össze őket, a küldés a mentés után történik.
        Map<Long, User> recipients = new LinkedHashMap<>();
        users.findById(project.getOwnerId()).ifPresent(u -> recipients.put(u.getId(), u));
        members.findByProjectIdWithUser(project.getId()).forEach(m -> recipients.putIfAbsent(m.getUser().getId(), m.getUser()));

        String text = message + "\n\nMegnyitás: " + baseUrl + "/\n\n"
            + "Ezt a levelet azért kaptad, mert a Tickoffban értesítést kértél az új visszajelzésekről. "
            + "A beállítást a Tickoff felületén kapcsolhatod ki.\n";

        afterCommit(() -> recipients.values().stream()
            .filter(User::isNotifyEmail)
            .forEach(u -> {
                if (limiter.tryAcquire("u" + u.getId(), PER_RECIPIENT) == 0) {
                    mail.send(u.getEmail(), "[Tickoff] " + subject, text);
                } else {
                    log.info("Értesítés kihagyva (címzettenkénti korlát), felhasználó: {}", u.getId());
                }
            }));
    }

    private static String excerpt(String body) {
        String text = body.strip();
        return text.length() <= EXCERPT_LENGTH ? text : text.substring(0, EXCERPT_LENGTH) + "…";
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
