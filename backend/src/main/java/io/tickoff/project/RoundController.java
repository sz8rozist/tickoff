package io.tickoff.project;

import io.tickoff.domain.CommentRepository;
import io.tickoff.domain.CommentRepository.RoundCommentCount;
import io.tickoff.domain.Project;
import io.tickoff.domain.Round;
import io.tickoff.domain.RoundRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/projects/{projectId}/rounds")
public class RoundController {

    public record RoundDto(Long id, int number, Round.Status status, Instant createdAt, Instant closedAt,
                           long commentCount, long openCommentCount, Instant approvedAt, String approvedBy,
                           LocalDate dueDate) {
        static RoundDto of(Round r, RoundCommentCount counts) {
            return new RoundDto(r.getId(), r.getNumber(), r.getStatus(), r.getCreatedAt(), r.getClosedAt(),
                counts == null ? 0 : counts.getTotal().longValue(),
                counts == null || counts.getOpenCount() == null ? 0 : counts.getOpenCount().longValue(),
                r.getApprovedAt(), r.getApprovedBy(), r.getDueDate());
        }
    }

    private final ProjectAccess access;
    private final RoundRepository rounds;
    private final CommentRepository comments;

    public RoundController(ProjectAccess access, RoundRepository rounds, CommentRepository comments) {
        this.access = access;
        this.rounds = rounds;
        this.comments = comments;
    }

    @GetMapping
    public List<RoundDto> list(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId) {
        Project project = owned(jwt, projectId);
        Map<Long, RoundCommentCount> counts = counts(project);
        return rounds.findByProjectIdOrderByNumberAsc(project.getId()).stream()
            .map(r -> RoundDto.of(r, counts.get(r.getId())))
            .toList();
    }

    /**
     * Új kört csak akkor lehet nyitni, ha az előző le van zárva: egyszerre egy nyitott kör van. A {@code carryOver}
     * megadásával az előző kör nem kész kommentjei átkerülnek az új körbe (a widget csak a nyitott kör kommentjeit
     * mutatja, így az ügyfélnek nem kell újra beküldenie a még meg nem oldottakat).
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public RoundDto open(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId,
                         @RequestParam(defaultValue = "false") boolean carryOver) {
        Project project = owned(jwt, projectId);
        Round latest = rounds.findTopByProjectIdOrderByNumberDesc(project.getId()).orElse(null);
        if (latest != null && latest.getStatus() == Round.Status.OPEN) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Előbb zárd le a nyitott kört");
        }
        int number = latest == null ? 1 : latest.getNumber() + 1;
        try {
            Round created = rounds.saveAndFlush(new Round(project, number));
            if (carryOver && latest != null) {
                comments.moveUnresolved(latest.getId(), created.getId());
            }
            return RoundDto.of(created, counts(project).get(created.getId()));
        } catch (DataIntegrityViolationException e) {
            // Párhuzamos kérés ugyanazzal a sorszámmal: az egyedi index (project_id, number) elkapja.
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A kör időközben létrejött");
        }
    }

    public record DueDateRequest(LocalDate dueDate) {
    }

    /**
     * A nyitott kör határidejének beállítása vagy törlése ({@code dueDate: null}). Tájékoztató jellegű: az ügyfél a
     * widgetben látja, de a lejárta nem zárja le a kört. Egy napnál régebbi dátum nem adható meg.
     */
    @org.springframework.web.bind.annotation.PutMapping("/{roundId}/due-date")
    @Transactional
    public RoundDto setDueDate(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId,
                               @PathVariable Long roundId, @org.springframework.web.bind.annotation.RequestBody DueDateRequest req) {
        Project project = owned(jwt, projectId);
        Round round = rounds.findByIdAndProjectId(roundId, project.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (round.getStatus() == Round.Status.CLOSED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Lezárt körnek nincs határideje");
        }
        if (req.dueDate() != null && req.dueDate().isBefore(LocalDate.now().minusDays(1))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A határidő nem lehet a múltban");
        }
        round.setDueDate(req.dueDate());
        return RoundDto.of(round, counts(project).get(round.getId()));
    }

    @PostMapping("/{roundId}/close")
    @Transactional
    public RoundDto close(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId, @PathVariable Long roundId) {
        Project project = owned(jwt, projectId);
        Round round = rounds.findByIdAndProjectId(roundId, project.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (round.getStatus() == Round.Status.CLOSED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A kör már le van zárva");
        }
        round.close();
        return RoundDto.of(round, counts(project).get(round.getId()));
    }

    private Map<Long, RoundCommentCount> counts(Project project) {
        return comments.countByRound(project.getId()).stream()
            .collect(Collectors.toMap(RoundCommentCount::getRoundId, Function.identity()));
    }

    /** A körök kezelése a projekt tagjainak is megengedett (nem csak a tulajdonosnak). */
    private Project owned(Jwt jwt, Long projectId) {
        return access.member(projectId, Long.valueOf(jwt.getSubject()));
    }
}
