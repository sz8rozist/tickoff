package io.tickoff.activity;

import io.tickoff.activity.ActivityEntry.ActorType;
import io.tickoff.domain.Comment;
import io.tickoff.domain.Project;
import io.tickoff.domain.User;
import io.tickoff.domain.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ThreadLocalRandom;

/**
 * A tevékenységnapló írása. A bejegyzés abban a tranzakcióban születik, amelyben a művelet maga, így egyik sem
 * marad meg a másik nélkül. A napló nem a kritikus út része: a régi (180 napnál idősebb) bejegyzéseket időnként,
 * a rögzítés mellékhatásaként töröljük, külön ütemező nélkül.
 */
@Service
public class ActivityLog {

    static final Duration RETENTION = Duration.ofDays(180);
    private static final int EXCERPT = 80;

    private final ActivityRepository entries;
    private final UserRepository users;

    public ActivityLog(ActivityRepository entries, UserRepository users) {
        this.entries = entries;
        this.users = users;
    }

    /** Csapattag (bejelentkezett felhasználó) tevékenysége. */
    @Transactional
    public void byUser(Project project, Long userId, String event, Comment comment, String summary) {
        String name = users.findById(userId).map(User::getName).orElse("Ismeretlen felhasználó");
        record(project.getId(), ActorType.USER, name, event, comment, summary);
    }

    /** Az ügyfél tevékenysége a widgeten át. */
    @Transactional
    public void byCustomer(Project project, String name, String event, Comment comment, String summary) {
        record(project.getId(), ActorType.CUSTOMER, name, event, comment, summary);
    }

    private void record(Long projectId, ActorType type, String name, String event, Comment comment, String summary) {
        entries.save(new ActivityEntry(projectId, type, name, event, comment == null ? null : comment.getId(), summary));
        // Ritkán takarítunk (kb. minden 50. bejegyzésnél), hogy a napló mérete korlátos maradjon
        if (ThreadLocalRandom.current().nextInt(50) == 0) {
            entries.deleteOlderThan(projectId, Instant.now().minus(RETENTION));
        }
    }

    /** A komment rövid, egysoros idézete a naplóhoz. */
    public static String quote(Comment comment) {
        String text = comment.getBody().replaceAll("\\s+", " ").trim();
        return "„" + (text.length() <= EXCERPT ? text : text.substring(0, EXCERPT).trim() + "…") + "”";
    }
}
