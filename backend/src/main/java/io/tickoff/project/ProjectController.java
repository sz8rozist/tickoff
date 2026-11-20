package io.tickoff.project;

import io.tickoff.domain.Project;
import io.tickoff.domain.ProjectRepository;
import io.tickoff.domain.Round;
import io.tickoff.domain.RoundRepository;
import io.tickoff.domain.User;
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

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    public record ProjectRequest(
        @NotBlank @Size(max = 160) String name,
        @NotBlank @Size(max = 500) @Pattern(regexp = "^https?://\\S+$", message = "http(s) URL kell") String siteUrl) {
    }

    public record ProjectDto(Long id, String name, String siteUrl, String shareToken, Instant createdAt,
                             ProjectAccess.Role role, String ownerName) {
        static ProjectDto of(Project p, ProjectAccess.Role role, String ownerName) {
            return new ProjectDto(p.getId(), p.getName(), p.getSiteUrl(), p.getShareToken(), p.getCreatedAt(),
                role, ownerName);
        }
    }

    private final ProjectRepository projects;
    private final RoundRepository rounds;
    private final UserRepository users;
    private final ProjectAccess access;
    private final ScreenshotStorage storage;

    public ProjectController(ProjectRepository projects, RoundRepository rounds, UserRepository users,
                             ProjectAccess access, ScreenshotStorage storage) {
        this.projects = projects;
        this.rounds = rounds;
        this.users = users;
        this.access = access;
        this.storage = storage;
    }

    /** A felhasználó saját és a hozzá meghívott projektjei, újabb elöl. */
    @GetMapping
    public List<ProjectDto> list(@AuthenticationPrincipal Jwt jwt) {
        Long userId = userId(jwt);
        return projects.findAccessible(userId).stream()
            .map(p -> ProjectDto.of(p, access.roleOf(p, userId), p.getOwner().getName()))
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
        return ProjectDto.of(project, access.roleOf(project, userId), ownerName);
    }

    private static Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
