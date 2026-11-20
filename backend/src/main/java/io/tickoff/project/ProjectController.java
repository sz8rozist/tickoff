package io.tickoff.project;

import io.tickoff.domain.Project;
import io.tickoff.domain.ProjectRepository;
import io.tickoff.domain.Round;
import io.tickoff.domain.RoundRepository;
import io.tickoff.domain.UserRepository;
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
import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    public record ProjectRequest(
        @NotBlank @Size(max = 160) String name,
        @NotBlank @Size(max = 500) @Pattern(regexp = "^https?://\\S+$", message = "http(s) URL kell") String siteUrl) {
    }

    public record ProjectDto(Long id, String name, String siteUrl, String shareToken, Instant createdAt) {
        static ProjectDto of(Project p) {
            return new ProjectDto(p.getId(), p.getName(), p.getSiteUrl(), p.getShareToken(), p.getCreatedAt());
        }
    }

    private final ProjectRepository projects;
    private final RoundRepository rounds;
    private final UserRepository users;
    private final ScreenshotStorage storage;

    public ProjectController(ProjectRepository projects, RoundRepository rounds, UserRepository users,
                             ScreenshotStorage storage) {
        this.projects = projects;
        this.rounds = rounds;
        this.users = users;
        this.storage = storage;
    }

    @GetMapping
    public List<ProjectDto> list(@AuthenticationPrincipal Jwt jwt) {
        return projects.findByOwnerIdOrderByCreatedAtDesc(userId(jwt)).stream().map(ProjectDto::of).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ProjectDto create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ProjectRequest req) {
        Project project = projects.save(
            new Project(users.getReferenceById(userId(jwt)), req.name().trim(), req.siteUrl().trim()));
        // Minden projekt az 1. körrel indul, a kommentek körökhöz tartoznak.
        rounds.save(new Round(project, 1));
        return ProjectDto.of(project);
    }

    @GetMapping("/{id}")
    public ProjectDto get(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return ProjectDto.of(owned(jwt, id));
    }

    @PutMapping("/{id}")
    @Transactional
    public ProjectDto update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
                             @Valid @RequestBody ProjectRequest req) {
        Project project = owned(jwt, id);
        project.update(req.name().trim(), req.siteUrl().trim());
        return ProjectDto.of(project);
    }

    /**
     * Új megosztó token generálása. A régi azonnal érvénytelen, ezért a vele beágyazott widgetek leállnak,
     * amíg az új tokent be nem írják az oldalba. Akkor hasznos, ha a token illetéktelenhez került.
     */
    @PostMapping("/{id}/share-token")
    @Transactional
    public ProjectDto regenerateShareToken(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        Project project = owned(jwt, id);
        project.regenerateShareToken();
        return ProjectDto.of(project);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        Project project = owned(jwt, id);
        // A körök és kommentek törlését az adatbázis ON DELETE CASCADE-je végzi.
        projects.delete(project);
        // A képernyőképek a fájlrendszerben vannak: azokat külön kell törölni
        storage.deleteProject(project.getId());
    }

    private Project owned(Jwt jwt, Long id) {
        // Más felhasználó projektjére is 404-et adunk, hogy ne derüljön ki, létezik-e.
        return projects.findByIdAndOwnerId(id, userId(jwt))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private static Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
