package io.tickoff.project;

import io.tickoff.domain.Comment;
import io.tickoff.domain.CommentRepository;
import io.tickoff.domain.Project;
import io.tickoff.domain.ProjectRepository;
import io.tickoff.domain.Reply;
import io.tickoff.domain.ReplyRepository;
import io.tickoff.domain.Round;
import io.tickoff.domain.RoundRepository;
import io.tickoff.domain.User;
import io.tickoff.domain.UserRepository;
import io.tickoff.project.ReplyService.ReplyDto;
import io.tickoff.widget.ScreenshotStorage;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/** A designer oldala: a projekt kommentjei, státuszkezelés és a képernyőképek. */
@RestController
@RequestMapping("/api/projects/{projectId}")
public class CommentController {

    public record StatusRequest(@NotNull Comment.Status status) {
    }

    public record ReplyRequest(@NotBlank @Size(max = 4000) String body) {
    }

    public record CommentDto(Long id, String authorName, String body, String pageUrl, String cssSelector,
                             Double posX, Double posY, Integer viewportWidth, Integer viewportHeight,
                             String userAgent, Comment.Status status, boolean hasScreenshot, Instant createdAt,
                             List<ReplyDto> replies) {
        static CommentDto of(Comment c, List<ReplyDto> replies) {
            return new CommentDto(c.getId(), c.getAuthorName(), c.getBody(), c.getPageUrl(), c.getCssSelector(),
                c.getPosX(), c.getPosY(), c.getViewportWidth(), c.getViewportHeight(), c.getUserAgent(),
                c.getStatus(), c.getScreenshotPath() != null, c.getCreatedAt(), replies);
        }
    }

    private final ProjectRepository projects;
    private final RoundRepository rounds;
    private final CommentRepository comments;
    private final ReplyRepository replyRepository;
    private final ReplyService replyService;
    private final UserRepository users;
    private final ScreenshotStorage storage;
    private final ZoneId exportZone;

    public CommentController(ProjectRepository projects, RoundRepository rounds, CommentRepository comments,
                             ReplyRepository replyRepository, ReplyService replyService, UserRepository users,
                             ScreenshotStorage storage, @Value("${tickoff.export-zone:Europe/Budapest}") String zone) {
        this.projects = projects;
        this.rounds = rounds;
        this.comments = comments;
        this.replyRepository = replyRepository;
        this.replyService = replyService;
        this.users = users;
        this.storage = storage;
        this.exportZone = ZoneId.of(zone);
    }

    @GetMapping("/rounds/{roundId}/comments")
    public List<CommentDto> list(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId,
                                 @PathVariable Long roundId) {
        Project project = owned(jwt, projectId);
        Round round = rounds.findByIdAndProjectId(roundId, project.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        List<Comment> list = comments.findByRoundIdOrderByCreatedAtAsc(round.getId());
        Map<Long, List<ReplyDto>> replies = replyService.byComment(list.stream().map(Comment::getId).toList());
        return list.stream().map(c -> CommentDto.of(c, replies.getOrDefault(c.getId(), List.of()))).toList();
    }

    @PatchMapping("/comments/{commentId}")
    @Transactional
    public CommentDto updateStatus(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId,
                                   @PathVariable Long commentId, @Valid @RequestBody StatusRequest req) {
        Comment comment = comment(jwt, projectId, commentId);
        comment.setStatus(req.status());
        return CommentDto.of(comment, replyService.forComment(comment.getId()));
    }

    /** Válasz a kommentre a designer nevében. */
    @PostMapping("/comments/{commentId}/replies")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ReplyDto reply(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId,
                          @PathVariable Long commentId, @Valid @RequestBody ReplyRequest req) {
        Comment comment = comment(jwt, projectId, commentId);
        replyService.requireRoom(comment.getId());
        User author = users.findById(Long.valueOf(jwt.getSubject()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        return ReplyDto.of(replyRepository.save(Reply.byDesigner(comment, author, req.body().trim())));
    }

    @DeleteMapping("/comments/{commentId}/replies/{replyId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteReply(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId,
                            @PathVariable Long commentId, @PathVariable Long replyId) {
        Comment comment = comment(jwt, projectId, commentId);
        Reply reply = replyRepository.findByIdAndCommentId(replyId, comment.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        replyRepository.delete(reply);
    }

    @DeleteMapping("/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId, @PathVariable Long commentId) {
        Comment comment = comment(jwt, projectId, commentId);
        String screenshot = comment.getScreenshotPath();
        comments.delete(comment);
        // A kép a fájlrendszerben van: az adatbázis-törlés után külön töröljük
        storage.delete(screenshot);
    }

    /**
     * A projekt kommentjeinek exportja CSV-ben (magyar Excelhez: pontosvessző, UTF-8 BOM). A {@code roundId}
     * megadásával egyetlen kör kommentjei kerülnek bele.
     */
    @GetMapping("/comments/export")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> exportCsv(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId,
                                            @RequestParam(required = false) Long roundId) {
        Project project = owned(jwt, projectId);
        if (roundId != null) {
            rounds.findByIdAndProjectId(roundId, project.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        }

        DateTimeFormatter format = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(exportZone);
        CsvWriter csv = new CsvWriter().row(List.of(
            "Kör", "Oldal", "Szerző", "Szöveg", "Státusz", "Elem (selector)", "Viewport", "Böngésző", "Létrehozva",
            "Válaszok"));
        List<Comment> exported = comments.findAllForExport(project.getId()).stream()
            .filter(c -> roundId == null || c.getRound().getId().equals(roundId))
            .toList();
        Map<Long, List<ReplyDto>> replies = replyService.byComment(exported.stream().map(Comment::getId).toList());
        for (Comment c : exported) {
            csv.row(List.of(
                String.valueOf(c.getRound().getNumber()),
                c.getPageUrl(),
                c.getAuthorName(),
                c.getBody(),
                statusLabel(c.getStatus()),
                c.getCssSelector() == null ? "" : c.getCssSelector(),
                c.getViewportWidth() != null && c.getViewportHeight() != null
                    ? c.getViewportWidth() + "x" + c.getViewportHeight() : "",
                c.getUserAgent() == null ? "" : c.getUserAgent(),
                format.format(c.getCreatedAt()),
                // A szál egy cellában, időrendben: "Név (csapat): szöveg" sorokban
                replies.getOrDefault(c.getId(), List.of()).stream()
                    .map(r -> r.authorName() + (r.authorType() == Reply.AuthorType.DESIGNER ? " (csapat)" : "")
                        + ": " + r.body())
                    .collect(Collectors.joining("\n"))));
        }

        String filename = "tickoff-" + slug(project.getName())
            + (roundId != null ? "-kor" + rounds.findById(roundId).map(Round::getNumber).orElse(0) : "")
            + "-" + LocalDate.now(exportZone).format(DateTimeFormatter.BASIC_ISO_DATE) + ".csv";
        return ResponseEntity.ok()
            .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
            .cacheControl(CacheControl.noStore())
            .body(csv.toBytes());
    }

    private static String statusLabel(Comment.Status status) {
        return switch (status) {
            case OPEN -> "Nyitott";
            case IN_PROGRESS -> "Folyamatban";
            case DONE -> "Kész";
        };
    }

    /** Fájlnévbarát, ékezet nélküli név a projektnévből. */
    static String slug(String name) {
        String ascii = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        String slug = ascii.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        return slug.isEmpty() ? "projekt" : (slug.length() > 40 ? slug.substring(0, 40).replaceAll("-+$", "") : slug);
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
