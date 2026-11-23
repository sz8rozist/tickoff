package io.tickoff.apikey;

import io.tickoff.domain.Comment;
import io.tickoff.domain.CommentRepository;
import io.tickoff.domain.Project;
import io.tickoff.domain.ProjectRepository;
import io.tickoff.project.ProjectAccess;
import io.tickoff.project.ReplyService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * A nyilvános, csak olvasható API (API-kulccsal: {@code Authorization: Bearer tk_…}). A kulcs tulajdonosának
 * projektjeit és visszajelzéseit adja, a belső részletek nélkül (nincs ügyfél-e-mail, token, webhook-cím).
 * Más rendszerek (feladatkezelő, riport, irányítópult) integrálására való.
 */
@RestController
@RequestMapping("/api/v1")
public class ApiV1Controller {

    static final int DEFAULT_LIMIT = 200;
    static final int MAX_LIMIT = 500;

    public record ProjectItem(Long id, String name, String siteUrl, boolean archived, Instant createdAt) {
    }

    public record CommentItem(Long id, Long projectId, int round, String pageUrl, String cssSelector, String author,
                              String body, Comment.Status status, Comment.Priority priority, List<String> labels,
                              String assignee, boolean approvedByCustomer, int replyCount, Instant createdAt) {
    }

    private final ProjectRepository projects;
    private final ProjectAccess access;
    private final CommentRepository comments;
    private final ReplyService replies;

    public ApiV1Controller(ProjectRepository projects, ProjectAccess access, CommentRepository comments,
                           ReplyService replies) {
        this.projects = projects;
        this.access = access;
        this.comments = comments;
        this.replies = replies;
    }

    /** A kulcs tulajdonosának projektjei (a sajátjai és a hozzá meghívottak). */
    @GetMapping("/projects")
    public List<ProjectItem> projects(@AuthenticationPrincipal Jwt jwt) {
        return projects.findAccessible(Long.valueOf(jwt.getSubject())).stream()
            .map(p -> new ProjectItem(p.getId(), p.getName(), p.getSiteUrl(), p.getArchivedAt() != null, p.getCreatedAt()))
            .toList();
    }

    /**
     * A projekt kommentjei, kör és idő szerint rendezve. Szűrhető státuszra és körre; {@code limit} (alapból 200,
     * legfeljebb 500) és {@code offset} lapoz. Nem hozzáférő projektre 404.
     */
    @GetMapping("/projects/{projectId}/comments")
    @Transactional(readOnly = true)
    public List<CommentItem> comments(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId,
                                      @RequestParam(required = false) Comment.Status status,
                                      @RequestParam(required = false) Integer round,
                                      @RequestParam(defaultValue = "0") int offset,
                                      @RequestParam(defaultValue = "200") int limit) {
        Project project = access.member(projectId, Long.valueOf(jwt.getSubject()));
        int size = Math.min(Math.max(limit, 1), MAX_LIMIT);
        List<Comment> page = comments.findAllForExport(project.getId()).stream()
            .filter(c -> status == null || c.getStatus() == status)
            .filter(c -> round == null || c.getRound().getNumber() == round)
            .skip(Math.max(offset, 0))
            .limit(size)
            .toList();
        Map<Long, Integer> replyCounts = replies.byComment(page.stream().map(Comment::getId).toList()).entrySet().stream()
            .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().size()));
        return page.stream()
            .map(c -> new CommentItem(c.getId(), project.getId(), c.getRound().getNumber(), c.getPageUrl(),
                c.getCssSelector(), c.getAuthorName(), c.getBody(), c.getStatus(), c.getPriority(), c.getLabels(),
                c.getAssignee() == null ? null : c.getAssignee().getName(), c.getCustomerApprovedAt() != null,
                replyCounts.getOrDefault(c.getId(), 0), c.getCreatedAt()))
            .toList();
    }
}
