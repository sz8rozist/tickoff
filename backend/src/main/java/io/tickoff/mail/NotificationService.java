package io.tickoff.mail;

import io.tickoff.domain.Comment;
import io.tickoff.domain.Project;
import io.tickoff.domain.ProjectMemberRepository;
import io.tickoff.domain.Reply;
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
