package io.tickoff.widget;

import io.tickoff.domain.Comment;
import io.tickoff.domain.CommentRepository;
import io.tickoff.domain.Project;
import io.tickoff.domain.ProjectRepository;
import io.tickoff.domain.Reply;
import io.tickoff.domain.ReplyRepository;
import io.tickoff.domain.Round;
import io.tickoff.domain.RoundRepository;
import io.tickoff.mail.NotificationService;
import io.tickoff.project.ReplyService;
import io.tickoff.project.ReplyService.ReplyDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * A beágyazott widget végpontjai. Nincs bejelentkezés: a projekt megosztó tokenje (az útvonalban) a kulcs,
 * és a kérés {@code Origin} fejlécének egyeznie kell a projekt oldalának origin-jével.
 */
@RestController
@RequestMapping("/api/widget/{token}")
public class WidgetController {

    static final int MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024;
    private static final byte[] PNG_MAGIC = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
    private static final byte[] JPEG_MAGIC = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};

    /** A korábbi körökből legfeljebb ennyit adunk vissza (a legutóbbiakat). */
    static final int MAX_HISTORY_ROUNDS = 10;

    public record RoundInfo(Long id, int number, boolean approved, String approvedBy) {
        static RoundInfo of(Round r) {
            return new RoundInfo(r.getId(), r.getNumber(), r.getApprovedAt() != null, r.getApprovedBy());
        }
    }

    public record ProjectInfo(String name, String siteUrl, RoundInfo openRound) {
    }

    public record CommentRequest(
        @NotBlank @Size(max = 120) String authorName,
        @NotBlank @Size(max = 4000) String body,
        @NotBlank @Size(max = 1000) String pageUrl,
        @Size(max = 1000) String cssSelector,
        @DecimalMin("0") @DecimalMax("1000000") Double posX,
        @DecimalMin("0") @DecimalMax("1000000") Double posY,
        @Min(1) @Max(20000) Integer viewportWidth,
        @Min(1) @Max(20000) Integer viewportHeight,
        // Opcionális: ide megy az értesítés, ha a csapat válaszol. Nem kerül vissza a widgetnek.
        @Email @Size(max = 254) String customerEmail) {
    }

    public record ReopenRequest(@NotBlank @Size(max = 120) String authorName, @Size(max = 4000) String reason) {
    }

    public record ApproveRoundRequest(@NotBlank @Size(max = 120) String authorName) {
    }

    public record HistoryRound(int number, Instant closedAt, boolean approved, String approvedBy,
                               List<CommentDto> comments) {
    }

    public record ReplyRequest(
        @NotBlank @Size(max = 120) String authorName,
        @NotBlank @Size(max = 4000) String body) {
    }

    public record CommentDto(Long id, String authorName, String body, String pageUrl, String cssSelector,
                             Double posX, Double posY, Comment.Status status, boolean hasScreenshot,
                             boolean approved, Instant createdAt, List<ReplyDto> replies) {
        static CommentDto of(Comment c, List<ReplyDto> replies) {
            return new CommentDto(c.getId(), c.getAuthorName(), c.getBody(), c.getPageUrl(), c.getCssSelector(),
                c.getPosX(), c.getPosY(), c.getStatus(), c.getScreenshotPath() != null,
                c.getCustomerApprovedAt() != null, c.getCreatedAt(), replies);
        }
    }

    private final ProjectRepository projects;
    private final RoundRepository rounds;
    private final CommentRepository comments;
    private final ReplyRepository replyRepository;
    private final ReplyService replyService;
    private final NotificationService notifications;
    private final ScreenshotStorage storage;

    public WidgetController(ProjectRepository projects, RoundRepository rounds, CommentRepository comments,
                            ReplyRepository replyRepository, ReplyService replyService,
                            NotificationService notifications, ScreenshotStorage storage) {
        this.projects = projects;
        this.rounds = rounds;
        this.comments = comments;
        this.replyRepository = replyRepository;
        this.replyService = replyService;
        this.notifications = notifications;
        this.storage = storage;
    }

    @GetMapping("/project")
    public ProjectInfo project(@PathVariable String token, HttpServletRequest request) {
        Project project = authorize(token, request);
        RoundInfo open = openRound(project).map(RoundInfo::of).orElse(null);
        return new ProjectInfo(project.getName(), project.getSiteUrl(), open);
    }

    /** A nyitott kör kommentjei (opcionálisan egy oldalra szűrve), hogy a widget ki tudja rajzolni a jelöléseket. */
    @GetMapping("/comments")
    @Transactional(readOnly = true)
    public List<CommentDto> list(@PathVariable String token, @RequestParam(required = false) String pageUrl,
                                 HttpServletRequest request) {
        Project project = authorize(token, request);
        return openRound(project)
            .map(r -> {
                List<Comment> list = comments.findByRoundIdOrderByCreatedAtAsc(r.getId()).stream()
                    .filter(c -> pageUrl == null || c.getPageUrl().equals(pageUrl))
                    .toList();
                Map<Long, List<ReplyDto>> replies = replyService.byComment(list.stream().map(Comment::getId).toList());
                return list.stream().map(c -> CommentDto.of(c, replies.getOrDefault(c.getId(), List.of()))).toList();
            })
            .orElse(List.of());
    }

    @PostMapping("/comments")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public CommentDto create(@PathVariable String token, @Valid @RequestBody CommentRequest req,
                             HttpServletRequest request) {
        Project project = authorize(token, request);
        Round round = openRound(project)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Nincs nyitott kör"));
        if (!Origins.sameOrigin(req.pageUrl(), project.getSiteUrl())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Az oldal nem a projekthez tartozik");
        }
        Comment comment = new Comment(round, req.authorName().trim(), req.body().trim(), req.pageUrl().trim());
        comment.setLocation(blankToNull(req.cssSelector()), req.posX(), req.posY());
        comment.setCustomerEmail(blankToNull(req.customerEmail()));
        // Új, még nem kész komment: a kör korábbi jóváhagyása már nem érvényes
        round.clearApproval();
        // A user agentet a fejlécből vesszük, nem a kliens által küldött törzsből.
        comment.setEnvironment(req.viewportWidth(), req.viewportHeight(), truncate(request.getHeader("User-Agent"), 500));
        Comment saved = comments.save(comment);
        notifications.newComment(project, saved);
        return CommentDto.of(saved, List.of());
    }

    /** A lezárt körök (legfeljebb a legutóbbi {@value #MAX_HISTORY_ROUNDS}) kommentjei, csak olvasásra. */
    @GetMapping("/history")
    @Transactional(readOnly = true)
    public List<HistoryRound> history(@PathVariable String token, HttpServletRequest request) {
        Project project = authorize(token, request);
        List<Round> closed = rounds.findByProjectIdOrderByNumberAsc(project.getId()).stream()
            .filter(r -> r.getStatus() == Round.Status.CLOSED)
            .toList();
        List<Round> recent = closed.subList(Math.max(0, closed.size() - MAX_HISTORY_ROUNDS), closed.size());
        List<HistoryRound> result = new ArrayList<>();
        for (int i = recent.size() - 1; i >= 0; i--) { // legújabb elöl
            Round r = recent.get(i);
            List<Comment> list = comments.findByRoundIdOrderByCreatedAtAsc(r.getId());
            Map<Long, List<ReplyDto>> replies = replyService.byComment(list.stream().map(Comment::getId).toList());
            result.add(new HistoryRound(r.getNumber(), r.getClosedAt(), r.getApprovedAt() != null, r.getApprovedBy(),
                list.stream().map(c -> CommentDto.of(c, replies.getOrDefault(c.getId(), List.of()))).toList()));
        }
        return result;
    }

    /** Az ügyfél elfogadja a "Kész" kommentet. */
    @PostMapping("/comments/{commentId}/approve")
    @Transactional
    public CommentDto approve(@PathVariable String token, @PathVariable Long commentId, HttpServletRequest request) {
        Project project = authorize(token, request);
        Comment comment = openRoundComment(project, commentId);
        if (comment.getStatus() != Comment.Status.DONE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Csak kész visszajelzést lehet elfogadni");
        }
        comment.approveByCustomer();
        return CommentDto.of(comment, replyService.forComment(comment.getId()));
    }

    /** Az ügyfél visszanyitja a "Kész" kommentet (pl. mert a javítás nem jó): a szálba bejegyzés kerül. */
    @PostMapping("/comments/{commentId}/reopen")
    @Transactional
    public CommentDto reopen(@PathVariable String token, @PathVariable Long commentId,
                             @Valid @RequestBody ReopenRequest req, HttpServletRequest request) {
        Project project = authorize(token, request);
        Comment comment = openRoundComment(project, commentId);
        if (comment.getStatus() != Comment.Status.DONE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Csak kész visszajelzést lehet visszanyitni");
        }
        replyService.requireRoom(comment.getId());
        String name = req.authorName().trim();
        String reason = blankToNull(req.reason());
        comment.setStatus(Comment.Status.OPEN);
        replyRepository.save(Reply.byCustomer(comment, name, reason == null ? "Visszanyitva." : "Visszanyitva: " + reason));
        notifications.commentReopened(project, comment, name, reason);
        return CommentDto.of(comment, replyService.forComment(comment.getId()));
    }

    /** Az ügyfél jóváhagyja a nyitott kört: csak akkor, ha van komment, és mind kész. */
    @PostMapping("/round/approve")
    @Transactional
    public RoundInfo approveRound(@PathVariable String token, @Valid @RequestBody ApproveRoundRequest req,
                                  HttpServletRequest request) {
        Project project = authorize(token, request);
        Round open = openRound(project)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Nincs nyitott kör"));
        List<Comment> list = comments.findByRoundIdOrderByCreatedAtAsc(open.getId());
        if (list.isEmpty() || list.stream().anyMatch(c -> c.getStatus() != Comment.Status.DONE)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Jóváhagyás előtt minden visszajelzésnek késznek kell lennie");
        }
        String name = req.authorName().trim();
        open.approve(name);
        notifications.roundApproved(project, open, name);
        return RoundInfo.of(open);
    }

    /** A nyitott kör kommentje: 404, ha nincs ilyen a projektben, 409, ha lezárt körhöz tartozik. */
    private Comment openRoundComment(Project project, Long commentId) {
        Comment comment = comments.findByIdAndRoundProjectId(commentId, project.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        Round open = openRound(project)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Nincs nyitott kör"));
        if (!comment.getRound().getId().equals(open.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ez a komment egy lezárt körhöz tartozik");
        }
        return comment;
    }

    /** Válasz egy kommentre az ügyfél nevében. Csak a nyitott kör kommentjeire lehet válaszolni. */
    @PostMapping("/comments/{commentId}/replies")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ReplyDto reply(@PathVariable String token, @PathVariable Long commentId,
                          @Valid @RequestBody ReplyRequest req, HttpServletRequest request) {
        Project project = authorize(token, request);
        Comment comment = comments.findByIdAndRoundProjectId(commentId, project.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        Round open = openRound(project)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Nincs nyitott kör"));
        if (!comment.getRound().getId().equals(open.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ez a komment egy lezárt körhöz tartozik");
        }
        replyService.requireRoom(comment.getId());
        Reply saved = replyRepository.save(Reply.byCustomer(comment, req.authorName().trim(), req.body().trim()));
        notifications.customerReply(project, comment, saved);
        return ReplyDto.of(saved);
    }

    /** A komment képernyőképe: nyers PNG vagy JPEG a kérés törzsében, legfeljebb 3 MB. */
    @PostMapping("/comments/{commentId}/screenshot")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void screenshot(@PathVariable String token, @PathVariable Long commentId,
                           HttpServletRequest request) throws IOException {
        Project project = authorize(token, request);
        Comment comment = comments.findByIdAndRoundProjectId(commentId, project.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (comment.getScreenshotPath() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A kommenthez már van képernyőkép");
        }

        String type = request.getContentType() == null ? "" : request.getContentType().split(";")[0].trim().toLowerCase();
        byte[] magic;
        String ext;
        switch (type) {
            case "image/png" -> {
                magic = PNG_MAGIC;
                ext = "png";
            }
            case "image/jpeg" -> {
                magic = JPEG_MAGIC;
                ext = "jpg";
            }
            default -> throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Csak PNG vagy JPEG");
        }

        if (request.getContentLengthLong() > MAX_SCREENSHOT_BYTES) {
            throw new ResponseStatusException(HttpStatus.CONTENT_TOO_LARGE, "A kép túl nagy");
        }
        // Chunked kérésnél nincs Content-Length, ezért olvasás közben is korlátozunk.
        byte[] data = request.getInputStream().readNBytes(MAX_SCREENSHOT_BYTES + 1);
        if (data.length > MAX_SCREENSHOT_BYTES) {
            throw new ResponseStatusException(HttpStatus.CONTENT_TOO_LARGE, "A kép túl nagy");
        }
        if (data.length < magic.length || !startsWith(data, magic)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A tartalom nem érvényes kép");
        }

        comment.setScreenshotPath(storage.save(project.getId(), comment.getId(), ext, data));
    }

    /** Token alapján megkeresi a projektet, és ellenőrzi a böngésző által küldött origin-t. */
    private Project authorize(String token, HttpServletRequest request) {
        Project project = projects.findByShareToken(token)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String origin = request.getHeader("Origin");
        // Böngészőből minden cross-origin kéréshez jön Origin. Ha van, egyeznie kell a projekt oldalával.
        if (origin != null && !origin.equals(Origins.of(project.getSiteUrl()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ez az origin nem engedélyezett");
        }
        return project;
    }

    private java.util.Optional<Round> openRound(Project project) {
        return rounds.findTopByProjectIdOrderByNumberDesc(project.getId())
            .filter(r -> r.getStatus() == Round.Status.OPEN);
    }

    private static boolean startsWith(byte[] data, byte[] prefix) {
        for (int i = 0; i < prefix.length; i++) {
            if (data[i] != prefix[i]) return false;
        }
        return true;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String truncate(String s, int max) {
        return s == null ? null : s.length() <= max ? s : s.substring(0, max);
    }
}
