package io.tickoff.project;

import io.tickoff.domain.Comment;
import io.tickoff.domain.CommentRepository;
import io.tickoff.domain.Project;
import io.tickoff.domain.Round;
import io.tickoff.domain.RoundRepository;
import io.tickoff.project.ReplyService.ReplyDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Nyomtatható kör-riport (HTML, a böngészőből PDF-be menthető): mi érkezett, mi lett megoldva, mi maradt. Alapból
 * ügyfélnek is átadható (nincsenek benne a belső adatok: prioritás, címkék, felelős); {@code internal=true}
 * mellett a csapat belső változata készül. Minden szöveg HTML-escape-elt, a riport nem tartalmaz scriptet.
 */
@RestController
@RequestMapping("/api/projects/{projectId}/rounds/{roundId}/report")
public class ReportController {

    private final ProjectAccess access;
    private final RoundRepository rounds;
    private final CommentRepository comments;
    private final ReplyService replyService;
    private final ZoneId zone;

    public ReportController(ProjectAccess access, RoundRepository rounds, CommentRepository comments,
                            ReplyService replyService, @Value("${tickoff.export-zone:Europe/Budapest}") String zone) {
        this.access = access;
        this.rounds = rounds;
        this.comments = comments;
        this.replyService = replyService;
        this.zone = ZoneId.of(zone);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> report(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId,
                                         @PathVariable Long roundId,
                                         @RequestParam(defaultValue = "false") boolean internal) {
        Project project = access.member(projectId, Long.valueOf(jwt.getSubject()));
        Round round = rounds.findByIdAndProjectId(roundId, project.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        List<Comment> list = comments.findByRoundIdOrderByCreatedAtAsc(round.getId());
        Map<Long, List<ReplyDto>> replies = replyService.byComment(list.stream().map(Comment::getId).toList());
        String html = render(project, round, list, replies, internal);
        return ResponseEntity.ok()
            .contentType(new MediaType("text", "html", StandardCharsets.UTF_8))
            .cacheControl(CacheControl.noStore())
            .body(html.getBytes(StandardCharsets.UTF_8));
    }

    String render(Project project, Round round, List<Comment> list, Map<Long, List<ReplyDto>> replies, boolean internal) {
        DateTimeFormatter date = DateTimeFormatter.ofPattern("yyyy. MM. dd.").withZone(zone);
        DateTimeFormatter dateTime = DateTimeFormatter.ofPattern("yyyy. MM. dd. HH:mm").withZone(zone);
        long open = list.stream().filter(c -> c.getStatus() == Comment.Status.OPEN).count();
        long progress = list.stream().filter(c -> c.getStatus() == Comment.Status.IN_PROGRESS).count();
        long done = list.stream().filter(c -> c.getStatus() == Comment.Status.DONE).count();

        StringBuilder h = new StringBuilder(8192);
        h.append("<!doctype html><html lang=\"hu\"><head><meta charset=\"utf-8\">")
            .append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">")
            .append("<meta name=\"robots\" content=\"noindex\"><title>Riport – ").append(esc(project.getName()))
            .append(" – ").append(round.getNumber()).append(". kör</title><style>").append(CSS).append("</style></head><body>");
        h.append("<h1>").append(esc(project.getName())).append("</h1>");
        h.append("<p class=\"sub\">Visszajelzési riport · ").append(round.getNumber()).append(". kör")
            .append(internal ? " · belső változat" : "").append("</p>");

        h.append("<table class=\"meta\"><tr><th>Oldal</th><td>").append(esc(project.getSiteUrl())).append("</td></tr>")
            .append("<tr><th>A kör kezdete</th><td>").append(date.format(round.getCreatedAt())).append("</td></tr>");
        if (round.getClosedAt() != null) {
            h.append("<tr><th>Lezárva</th><td>").append(date.format(round.getClosedAt())).append("</td></tr>");
        } else {
            h.append("<tr><th>Állapot</th><td>nyitott</td></tr>");
        }
        if (round.getDueDate() != null) {
            h.append("<tr><th>Határidő</th><td>").append(round.getDueDate()).append("</td></tr>");
        }
        if (round.getApprovedAt() != null) {
            h.append("<tr><th>Jóváhagyás</th><td>").append(esc(round.getApprovedBy() == null ? "az ügyfél" : round.getApprovedBy()))
                .append(", ").append(date.format(round.getApprovedAt())).append("</td></tr>");
        }
        h.append("<tr><th>Összesítés</th><td>").append(list.size()).append(" visszajelzés: ")
            .append(done).append(" kész, ").append(progress).append(" folyamatban, ").append(open).append(" nyitott</td></tr></table>");

        if (list.isEmpty()) {
            h.append("<p>Ebben a körben nem érkezett visszajelzés.</p>");
        }

        Map<String, List<Comment>> byPage = new LinkedHashMap<>();
        for (Comment c : list) byPage.computeIfAbsent(c.getPageUrl(), k -> new java.util.ArrayList<>()).add(c);
        int n = 0;
        for (Map.Entry<String, List<Comment>> page : byPage.entrySet()) {
            h.append("<h2>").append(esc(page.getKey())).append("</h2>");
            for (Comment c : page.getValue()) {
                n++;
                h.append("<section class=\"c ").append(c.getStatus().name().toLowerCase()).append("\">")
                    .append("<div class=\"head\"><span class=\"n\">").append(n).append("</span><strong>")
                    .append(esc(c.getAuthorName())).append("</strong> <span class=\"muted\">")
                    .append(dateTime.format(c.getCreatedAt())).append("</span><span class=\"badge\">")
                    .append(statusLabel(c.getStatus())).append(c.getCustomerApprovedAt() != null ? " · elfogadva" : "")
                    .append("</span></div>")
                    .append("<p class=\"body\">").append(esc(c.getBody())).append("</p>");
                if (internal) {
                    h.append("<p class=\"muted small\">Prioritás: ").append(c.getPriority().name().toLowerCase());
                    if (!c.getLabels().isEmpty()) h.append(" · Címkék: ").append(esc(String.join(", ", c.getLabels())));
                    if (c.getAssignee() != null) h.append(" · Felelős: ").append(esc(c.getAssignee().getName()));
                    if (c.getCssSelector() != null) h.append(" · Elem: ").append(esc(c.getCssSelector()));
                    h.append("</p>");
                }
                List<ReplyDto> thread = replies.getOrDefault(c.getId(), List.of());
                if (!thread.isEmpty()) {
                    h.append("<ul class=\"thread\">");
                    for (ReplyDto r : thread) {
                        h.append("<li><strong>").append(esc(r.authorName())).append("</strong>")
                            .append(r.authorType() == io.tickoff.domain.Reply.AuthorType.DESIGNER ? " <span class=\"muted\">(csapat)</span>" : "")
                            .append(": ").append(esc(r.body())).append("</li>");
                    }
                    h.append("</ul>");
                }
                h.append("</section>");
            }
        }
        h.append("<p class=\"foot muted small\">Készült: ").append(dateTime.format(java.time.Instant.now()))
            .append(" · Nyomtatás vagy PDF mentés: Ctrl+P</p></body></html>");
        return h.toString();
    }

    private static String statusLabel(Comment.Status s) {
        return switch (s) {
            case OPEN -> "Nyitott";
            case IN_PROGRESS -> "Folyamatban";
            case DONE -> "Kész";
        };
    }

    /** HTML-escape: a felhasználói szövegek sosem kerülhetnek jelölésként a riportba. */
    static String esc(String s) {
        if (s == null) return "";
        StringBuilder out = new StringBuilder(s.length() + 16);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&#39;");
                default -> out.append(c);
            }
        }
        return out.toString();
    }

    private static final String CSS = """
        body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1f2140;max-width:820px;margin:32px auto;padding:0 20px;line-height:1.5}
        h1{margin:0;font-size:28px;letter-spacing:-.02em}.sub{margin:4px 0 20px;color:#5a5f86}
        h2{font-size:15px;margin:26px 0 8px;padding-bottom:6px;border-bottom:1px solid #e3e5f3;word-break:break-all;color:#4a52c9}
        table.meta{border-collapse:collapse;margin-bottom:8px;font-size:14px}.meta th{text-align:left;padding:4px 18px 4px 0;color:#5a5f86;font-weight:600}
        .c{border:1px solid #e3e5f3;border-left:4px solid #adb5bd;border-radius:10px;padding:10px 14px;margin:10px 0;page-break-inside:avoid}
        .c.open{border-left-color:#f76707}.c.in_progress{border-left-color:#5b64e3}.c.done{border-left-color:#12b886}
        .head{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.n{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#eef0ff;font-size:12px;font-weight:700}
        .badge{margin-left:auto;font-size:12px;font-weight:600;padding:2px 10px;border-radius:999px;background:#f1f2fa}
        .body{margin:6px 0;white-space:pre-wrap}.muted{color:#6b7094}.small{font-size:12px}
        .thread{margin:6px 0 0;padding-left:16px;border-left:2px solid #e3e5f3;list-style:none;font-size:14px}.thread li{margin:3px 0;white-space:pre-wrap}
        .foot{margin-top:30px}@media print{body{margin:0;max-width:none}}
        """;
}
