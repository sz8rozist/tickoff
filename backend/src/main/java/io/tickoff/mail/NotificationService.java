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
    private final RateLimiter limiter = new RateLimiter(10_000);
    private final String baseUrl;

    public NotificationService(UserRepository users, ProjectMemberRepository members, MailService mail,
                               @Value("${tickoff.dashboard-origin}") String baseUrl) {
        this.users = users;
        this.members = members;
        this.mail = mail;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
    }

    public void newComment(Project project, Comment comment) {
        notifyTeam(project,
            "Új visszajelzés: " + project.getName(),
            comment.getAuthorName() + " új visszajelzést írt a(z) „" + project.getName() + "” projektben"
                + " (oldal: " + comment.getPageUrl() + "):\n\n" + excerpt(comment.getBody()));
    }

    public void customerReply(Project project, Comment comment, Reply reply) {
        notifyTeam(project,
            "Új válasz: " + project.getName(),
            reply.getAuthorName() + " válaszolt " + comment.getAuthorName() + " visszajelzésére a(z) „"
                + project.getName() + "” projektben (oldal: " + comment.getPageUrl() + "):\n\n" + excerpt(reply.getBody()));
    }

    /** Az ügyfél újranyitotta a kész kommentet: a csapatnak tudnia kell, hogy dolga van vele. */
    public void commentReopened(Project project, Comment comment, String by, String reason) {
        notifyTeam(project,
            "Újranyitott visszajelzés: " + project.getName(),
            by + " újranyitotta a kész visszajelzését a(z) „" + project.getName() + "” projektben"
                + " (oldal: " + comment.getPageUrl() + "):\n\n" + excerpt(comment.getBody())
                + (reason == null || reason.isBlank() ? "" : "\n\nIndoklás: " + excerpt(reason)));
    }

    /** Az ügyfél jóváhagyta a kört: minden visszajelzése kész. */
    public void roundApproved(Project project, Round round, String by) {
        notifyTeam(project,
            "Az ügyfél jóváhagyta a kört: " + project.getName(),
            by + " jóváhagyta a(z) „" + project.getName() + "” projekt " + round.getNumber() + ". körét: "
                + "minden visszajelzés kész. Lezárhatod a kört.");
    }

    /** A csapat válaszolt: ha az ügyfél megadta az e-mail-címét, értesítjük. */
    public void designerReply(Project project, Comment comment, Reply reply) {
        notifyCustomer(comment, "Válasz a visszajelzésedre: " + project.getName(),
            reply.getAuthorName() + " (a csapatból) válaszolt a visszajelzésedre a(z) „" + project.getName()
                + "” projektben:\n\n" + excerpt(reply.getBody()));
    }

    /** A csapat késznek jelölte a kommentet: az ügyfél megnézheti, elfogadhatja vagy visszanyithatja. */
    public void commentDone(Project project, Comment comment) {
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
