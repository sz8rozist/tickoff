package io.tickoff.project;

import io.tickoff.domain.Project;
import io.tickoff.domain.ProjectRepository;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/projects/{projectId}/rounds")
public class RoundController {

    public record RoundDto(Long id, int number, Round.Status status, Instant createdAt, Instant closedAt) {
        static RoundDto of(Round r) {
            return new RoundDto(r.getId(), r.getNumber(), r.getStatus(), r.getCreatedAt(), r.getClosedAt());
        }
    }

    private final ProjectRepository projects;
    private final RoundRepository rounds;

    public RoundController(ProjectRepository projects, RoundRepository rounds) {
        this.projects = projects;
        this.rounds = rounds;
    }

    @GetMapping
    public List<RoundDto> list(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId) {
        Project project = owned(jwt, projectId);
        return rounds.findByProjectIdOrderByNumberAsc(project.getId()).stream().map(RoundDto::of).toList();
    }

    /** Új kört csak akkor lehet nyitni, ha az előző le van zárva: egyszerre egy nyitott kör van. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public RoundDto open(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId) {
        Project project = owned(jwt, projectId);
        Round latest = rounds.findTopByProjectIdOrderByNumberDesc(project.getId()).orElse(null);
        if (latest != null && latest.getStatus() == Round.Status.OPEN) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Előbb zárd le a nyitott kört");
        }
        int number = latest == null ? 1 : latest.getNumber() + 1;
        try {
            return RoundDto.of(rounds.saveAndFlush(new Round(project, number)));
        } catch (DataIntegrityViolationException e) {
            // Párhuzamos kérés ugyanazzal a sorszámmal: az egyedi index (project_id, number) elkapja.
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A kör időközben létrejött");
        }
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
        return RoundDto.of(round);
    }

    private Project owned(Jwt jwt, Long projectId) {
        return projects.findByIdAndOwnerId(projectId, Long.valueOf(jwt.getSubject()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
}
