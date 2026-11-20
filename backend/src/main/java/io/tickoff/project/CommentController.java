package io.tickoff.project;

import io.tickoff.domain.Comment;
import io.tickoff.domain.CommentRepository;
import io.tickoff.domain.Project;
import io.tickoff.domain.ProjectRepository;
import io.tickoff.domain.Round;
import io.tickoff.domain.RoundRepository;
import io.tickoff.widget.ScreenshotStorage;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

/** A designer oldala: a projekt kommentjei, státuszkezelés és a képernyőképek. */
@RestController
@RequestMapping("/api/projects/{projectId}")
public class CommentController {

    public record StatusRequest(@NotNull Comment.Status status) {
    }

    public record CommentDto(Long id, String authorName, String body, String pageUrl, String cssSelector,
                             Double posX, Double posY, Integer viewportWidth, Integer viewportHeight,
                             String userAgent, Comment.Status status, boolean hasScreenshot, Instant createdAt) {
        static CommentDto of(Comment c) {
            return new CommentDto(c.getId(), c.getAuthorName(), c.getBody(), c.getPageUrl(), c.getCssSelector(),
                c.getPosX(), c.getPosY(), c.getViewportWidth(), c.getViewportHeight(), c.getUserAgent(),
                c.getStatus(), c.getScreenshotPath() != null, c.getCreatedAt());
        }
    }

    private final ProjectRepository projects;
    private final RoundRepository rounds;
    private final CommentRepository comments;
    private final ScreenshotStorage storage;

    public CommentController(ProjectRepository projects, RoundRepository rounds, CommentRepository comments,
                             ScreenshotStorage storage) {
        this.projects = projects;
        this.rounds = rounds;
        this.comments = comments;
        this.storage = storage;
    }

    @GetMapping("/rounds/{roundId}/comments")
    public List<CommentDto> list(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId,
                                 @PathVariable Long roundId) {
        Project project = owned(jwt, projectId);
        Round round = rounds.findByIdAndProjectId(roundId, project.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return comments.findByRoundIdOrderByCreatedAtAsc(round.getId()).stream().map(CommentDto::of).toList();
    }

    @PatchMapping("/comments/{commentId}")
    @Transactional
    public CommentDto updateStatus(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId,
                                   @PathVariable Long commentId, @Valid @RequestBody StatusRequest req) {
        Comment comment = comment(jwt, projectId, commentId);
        comment.setStatus(req.status());
        return CommentDto.of(comment);
    }

    /** A képernyőképet JWT-vel védjük, ezért a kliens fejléccel kéri le (nem {@code <img src>}-vel). */
    @GetMapping("/comments/{commentId}/screenshot")
    public ResponseEntity<byte[]> screenshot(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId,
                                             @PathVariable Long commentId) throws IOException {
        Comment comment = comment(jwt, projectId, commentId);
        String relative = comment.getScreenshotPath();
        if (relative == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        Path file = storage.resolve(relative);
        if (!Files.isRegularFile(file)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        MediaType type = relative.endsWith(".png") ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG;
        return ResponseEntity.ok()
            .contentType(type)
            .cacheControl(CacheControl.maxAge(java.time.Duration.ofMinutes(10)).cachePrivate())
            .body(Files.readAllBytes(file));
    }

    private Comment comment(Jwt jwt, Long projectId, Long commentId) {
        Project project = owned(jwt, projectId);
        return comments.findByIdAndRoundProjectId(commentId, project.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private Project owned(Jwt jwt, Long projectId) {
        return projects.findByIdAndOwnerId(projectId, Long.valueOf(jwt.getSubject()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
}
