package io.tickoff.mail;

import io.tickoff.domain.Comment;
import io.tickoff.domain.CommentRepository;
import io.tickoff.domain.Project;
import io.tickoff.domain.ProjectRepository;
import io.tickoff.domain.Round;
import io.tickoff.domain.RoundRepository;
import io.tickoff.domain.User;
import io.tickoff.domain.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Napi vagy heti összefoglaló e-mail a felhasználóknak, akik kérték. Reggel 8-kor fut (a beállított időzónában):
 * a napi összefoglaló minden nap, a heti hétfőn megy. Csak akkor küldünk levelet, ha van mit mondani (nyitott vagy
 * új visszajelzés, jóváhagyott kör), hogy ne legyen üres levél. Az archivált projektek kimaradnak.
 */
@Service
public class DigestService {

    private static final Logger log = LoggerFactory.getLogger(DigestService.class);

    private final UserRepository users;
    private final ProjectRepository projects;
    private final RoundRepository rounds;
    private final CommentRepository comments;
    private final MailService mail;
    private final ZoneId zone;
    private final String baseUrl;

    public DigestService(UserRepository users, ProjectRepository projects, RoundRepository rounds,
                         CommentRepository comments, MailService mail,
                         @Value("${tickoff.export-zone:Europe/Budapest}") String zone,
                         @Value("${tickoff.dashboard-origin}") String baseUrl) {
        this.users = users;
        this.projects = projects;
        this.rounds = rounds;
        this.comments = comments;
        this.mail = mail;
        this.zone = ZoneId.of(zone);
        this.baseUrl = baseUrl.replaceAll("/+$", "");
    }

    /** Minden reggel 8-kor; a cron a konfigurált időzónában értelmezett. */
    @Scheduled(cron = "0 0 8 * * *", zone = "${tickoff.export-zone:Europe/Budapest}")
    public void scheduled() {
        try {
            int sent = sendDue(Instant.now());
            if (sent > 0) log.info("Összefoglaló e-mailek elküldve: {}", sent);
        } catch (RuntimeException e) {
            log.error("Az összefoglaló e-mailek küldése nem sikerült: {}", e.toString());
        }
    }

    /** Elküldi a mai napon esedékes összefoglalókat. @return a kiküldött levelek száma */
    @Transactional
    public int sendDue(Instant now) {
        if (!mail.isEnabled()) return 0;
        DayOfWeek today = ZonedDateTime.ofInstant(now, zone).getDayOfWeek();
        int sent = 0;
        for (User user : users.findByDigestFrequencyNot("OFF")) {
            boolean due = user.getDigestFrequency().equals("DAILY")
                || (user.getDigestFrequency().equals("WEEKLY") && today == DayOfWeek.MONDAY);
            if (!due) continue;
            Instant since = user.getDigestLastSentAt() != null ? user.getDigestLastSentAt()
                : now.minus(Duration.ofDays(user.getDigestFrequency().equals("WEEKLY") ? 7 : 1));
            String text = compose(user, since);
            if (text != null) {
                mail.send(user.getEmail(), "[Tickoff] Összefoglaló a projektjeidről", text);
                user.markDigestSent(now);
                sent++;
            }
        }
        return sent;
    }

    /** A levél szövege, vagy null, ha nincs mit mondani. */
    String compose(User user, Instant since) {
        List<Project> active = projects.findAccessible(user.getId()).stream()
            .filter(p -> p.getArchivedAt() == null).toList();
        if (active.isEmpty()) return null;
        List<Long> ids = active.stream().map(Project::getId).toList();

        Map<Long, Map<Comment.Status, Long>> byStatus = new HashMap<>();
        for (CommentRepository.StatusCount c : comments.countOpenRoundByStatus(ids)) {
            byStatus.computeIfAbsent(c.getProjectId(), k -> new HashMap<>()).put(c.getStatus(), c.getTotal());
        }
        Map<Long, Long> fresh = comments.countCreatedSince(ids, since).stream()
            .collect(Collectors.toMap(CommentRepository.ProjectCount::getProjectId, CommentRepository.ProjectCount::getTotal));
        Map<Long, Round> openRounds = rounds.findByProjectIdInAndStatus(ids, Round.Status.OPEN).stream()
            .collect(Collectors.toMap(r -> r.getProject().getId(), r -> r, (a, b) -> a));

        StringBuilder body = new StringBuilder();
        for (Project p : active) {
            Map<Comment.Status, Long> s = byStatus.getOrDefault(p.getId(), Map.of());
            long open = s.getOrDefault(Comment.Status.OPEN, 0L);
            long inProgress = s.getOrDefault(Comment.Status.IN_PROGRESS, 0L);
            long news = fresh.getOrDefault(p.getId(), 0L);
            Round round = openRounds.get(p.getId());
            boolean approved = round != null && round.getApprovedAt() != null;
            if (open == 0 && inProgress == 0 && news == 0 && !approved) continue;

            body.append("• ").append(p.getName()).append('\n');
            body.append("  ").append(open).append(" nyitott, ").append(inProgress).append(" folyamatban");
            if (news > 0) body.append(", ").append(news).append(" új az utóbbi időben");
            body.append('\n');
            if (approved) {
                body.append("  Az ügyfél jóváhagyta a ").append(round.getNumber()).append(". kört: lezárhatod.\n");
            }
            if (round != null && round.getDueDate() != null) {
                body.append("  Határidő: ").append(round.getDueDate()).append('\n');
            }
            body.append('\n');
        }
        if (body.length() == 0) return null;
        return "Szia " + user.getName() + "!\n\nÍgy állnak a projektjeid:\n\n" + body
            + "Megnyitás: " + baseUrl + "/\n\n"
            + "Ezt az összefoglalót azért kapod, mert a Tickoffban kérted. A gyakoriságot a fiók menüjében "
            + "módosíthatod vagy kikapcsolhatod.\n";
    }
}
