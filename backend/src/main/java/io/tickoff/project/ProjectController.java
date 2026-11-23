package io.tickoff.project;

import io.tickoff.domain.Comment;
import io.tickoff.domain.CommentRepository;
import io.tickoff.domain.Project;
import io.tickoff.domain.ProjectRepository;
import io.tickoff.domain.Round;
import io.tickoff.domain.RoundRepository;
import io.tickoff.domain.User;
import io.tickoff.domain.UserRepository;
import io.tickoff.webhook.WebhookSender;
import io.tickoff.webhook.WebhookService;
import io.tickoff.webhook.WebhookUrls;
import io.tickoff.widget.ScreenshotStorage;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    public record ProjectRequest(
        @NotBlank @Size(max = 160) String name,
        @NotBlank @Size(max = 500) @Pattern(regexp = "^https?://\\S+$", message = "http(s) URL kell") String siteUrl) {
    }

    /** {@code url == null} vagy üres: a webhook kikapcsolása. */
    public record WebhookRequest(@Size(max = 500) String url) {
    }

    /** A projekt nyitott körének összesítője: kommentek státuszonként és az ügyfél jóváhagyása. */
    public record ProjectStats(Integer roundNumber, long open, long inProgress, long done, boolean approved) {
        static final ProjectStats NONE = new ProjectStats(null, 0, 0, 0, false);
    }

    /** A webhook adatai (cím, titok) csak a tulajdonosnak látszanak: a cím gyakran titkot tartalmaz. */
    public record ProjectDto(Long id, String name, String siteUrl, String shareToken, Instant createdAt,
                             ProjectAccess.Role role, String ownerName, String webhookUrl, String webhookSecret,
                             ProjectStats stats) {
        static ProjectDto of(Project p, ProjectAccess.Role role, String ownerName, ProjectStats stats) {
            boolean owner = role == ProjectAccess.Role.OWNER;
            return new ProjectDto(p.getId(), p.getName(), p.getSiteUrl(), p.getShareToken(), p.getCreatedAt(),
                role, ownerName, owner ? p.getWebhookUrl() : null, owner ? p.getWebhookSecret() : null, stats);
        }
    }

    private final ProjectRepository projects;
    private final RoundRepository rounds;
    private final UserRepository users;
    private final ProjectAccess access;
    private final ScreenshotStorage storage;
    private final WebhookService webhooks;
    private final WebhookSender webhookSender;
    private final CommentRepository comments;

    public ProjectController(ProjectRepository projects, RoundRepository rounds, UserRepository users,
                             ProjectAccess access, ScreenshotStorage storage, WebhookService webhooks,
                             WebhookSender webhookSender, CommentRepository comments) {
        this.projects = projects;
        this.rounds = rounds;
        this.users = users;
        this.access = access;
        this.storage = storage;
        this.webhooks = webhooks;
        this.webhookSender = webhookSender;
        this.comments = comments;
    }

    /** A felhasználó saját és a hozzá meghívott projektjei, újabb elöl. */
    @GetMapping
    public List<ProjectDto> list(@AuthenticationPrincipal Jwt jwt) {
        Long userId = userId(jwt);
        List<Project> accessible = projects.findAccessible(userId);
        // Az összesítők két lekérdezéssel, nem projektenként
        Map<Long, ProjectStats> stats = statsFor(accessible.stream().map(Project::getId).toList());
        return accessible.stream()
            .map(p -> ProjectDto.of(p, access.roleOf(p, userId), p.getOwner().getName(),
                stats.getOrDefault(p.getId(), ProjectStats.NONE)))
            .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ProjectDto create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ProjectRequest req) {
        User owner = users.getReferenceById(userId(jwt));
        Project project = projects.save(new Project(owner, req.name().trim(), req.siteUrl().trim()));
        // Minden projekt az 1. körrel indul, a kommentek körökhöz tartoznak.
        rounds.save(new Round(project, 1));
        return dto(project, userId(jwt));
    }

    @GetMapping("/{id}")
    public ProjectDto get(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return dto(access.member(id, userId(jwt)), userId(jwt));
    }

    /** A projekt beállításait csak a tulajdonos módosíthatja. */
    @PutMapping("/{id}")
    @Transactional
    public ProjectDto update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
                             @Valid @RequestBody ProjectRequest req) {
        Project project = access.owner(id, userId(jwt));
        project.update(req.name().trim(), req.siteUrl().trim());
        return dto(project, userId(jwt));
    }

    /**
     * Új megosztó token generálása (csak a tulajdonos). A régi azonnal érvénytelen, ezért a vele beágyazott
     * widgetek leállnak, amíg az új tokent be nem írják az oldalba. Akkor hasznos, ha a token illetéktelenhez került.
     */
    @PostMapping("/{id}/share-token")
    @Transactional
    public ProjectDto regenerateShareToken(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        Project project = access.owner(id, userId(jwt));
        project.regenerateShareToken();
        return dto(project, userId(jwt));
    }

    /**
     * A webhook beállítása vagy kikapcsolása (csak a tulajdonos). A cím csak nyilvános https-cím lehet (SSRF ellen,
     * lásd {@link WebhookUrls}); érvénytelen címre 400.
     */
    @PutMapping("/{id}/webhook")
    @Transactional
    public ProjectDto setWebhook(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
                                 @Valid @RequestBody WebhookRequest req) {
        Project project = access.owner(id, userId(jwt));
        String url = req.url() == null || req.url().isBlank() ? null : req.url().trim();
        if (url != null) {
            try {
                WebhookUrls.validate(url, webhookSender.allowPrivate());
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
            }
        }
        project.setWebhook(url);
        return dto(project, userId(jwt));
    }

    /** Teszt-üzenet a beállított webhookra (csak a tulajdonos); az eredményt azonnal visszaadja. */
    @PostMapping("/{id}/webhook/test")
    public WebhookSender.Result testWebhook(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        Project project = access.owner(id, userId(jwt));
        if (project.getWebhookUrl() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Nincs beállított webhook");
        }
        return webhooks.sendTest(project);
    }

    /** A projekt törlése (csak a tulajdonos): a tagok számára is megszűnik. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        Project project = access.owner(id, userId(jwt));
        // A körök, kommentek és tagságok törlését az adatbázis ON DELETE CASCADE-je végzi.
        projects.delete(project);
        // A képernyőképek a fájlrendszerben vannak: azokat külön kell törölni
        storage.deleteProject(project.getId());
    }

    private ProjectDto dto(Project project, Long userId) {
        String ownerName = users.findById(project.getOwnerId()).map(User::getName).orElse("");
        ProjectStats stats = statsFor(List.of(project.getId())).getOrDefault(project.getId(), ProjectStats.NONE);
        return ProjectDto.of(project, access.roleOf(project, userId), ownerName, stats);
    }

    /** A projektek nyitott körének összesítője (ahol nincs nyitott kör, nincs bejegyzés). */
    private Map<Long, ProjectStats> statsFor(Collection<Long> projectIds) {
        if (projectIds.isEmpty()) return Map.of();
        Map<Long, Round> open = rounds.findByProjectIdInAndStatus(projectIds, Round.Status.OPEN).stream()
            .collect(Collectors.toMap(r -> r.getProject().getId(), r -> r, (a, b) -> a));
        Map<Long, Map<Comment.Status, Long>> counts = new HashMap<>();
        for (CommentRepository.StatusCount c : comments.countOpenRoundByStatus(projectIds)) {
            counts.computeIfAbsent(c.getProjectId(), k -> new HashMap<>()).put(c.getStatus(), c.getTotal());
        }
        Map<Long, ProjectStats> result = new HashMap<>();
        open.forEach((projectId, round) -> {
            Map<Comment.Status, Long> byStatus = counts.getOrDefault(projectId, Map.of());
            result.put(projectId, new ProjectStats(round.getNumber(),
                byStatus.getOrDefault(Comment.Status.OPEN, 0L),
                byStatus.getOrDefault(Comment.Status.IN_PROGRESS, 0L),
                byStatus.getOrDefault(Comment.Status.DONE, 0L),
                round.getApprovedAt() != null));
        });
        return result;
    }

    private static Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
