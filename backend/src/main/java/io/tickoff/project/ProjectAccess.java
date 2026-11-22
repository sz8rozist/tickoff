package io.tickoff.project;

import io.tickoff.domain.Project;
import io.tickoff.domain.ProjectMemberRepository;
import io.tickoff.domain.ProjectRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * A projektekhez való hozzáférés egyetlen helyen. Két szerepkör van:
 * <ul>
 *   <li><b>OWNER</b> (tulajdonos): mindent csinálhat, a projekt beállításait, a tokent és a tagokat is kezelheti.</li>
 *   <li><b>MEMBER</b> (meghívott tag): a visszajelzéseket kezelheti (körök, kommentek, válaszok, export), de a
 *       projekt beállításaihoz, a tokenhez és a tagokhoz nem nyúlhat.</li>
 * </ul>
 * Aki nem tulajdonos és nem tag, annak a projekt nem létezik (404), hogy ne derüljön ki a létezése.
 */
@Service
public class ProjectAccess {

    public enum Role { OWNER, MEMBER }

    private final ProjectRepository projects;
    private final ProjectMemberRepository members;

    public ProjectAccess(ProjectRepository projects, ProjectMemberRepository members) {
        this.projects = projects;
        this.members = members;
    }

    /** A projekt, ha a felhasználó tag vagy tulajdonos. Nem hozzáférőnek 404. */
    public Project member(Long projectId, Long userId) {
        return resolve(projectId, userId, Role.MEMBER).project();
    }

    /** A projekt, ha a felhasználó a tulajdonosa. Tagnak 403, idegennek 404. */
    public Project owner(Long projectId, Long userId) {
        return resolve(projectId, userId, Role.OWNER).project();
    }

    /** A felhasználó szerepköre a projektben (a hozzáférést is ellenőrzi). */
    public Role roleOf(Project project, Long userId) {
        return project.getOwnerId().equals(userId) ? Role.OWNER : Role.MEMBER;
    }

    /** Tulajdonos vagy tag-e a felhasználó (a projekt csapatának tagja). */
    public boolean isTeamMember(Project project, Long userId) {
        return project.getOwnerId().equals(userId) || members.existsByProjectIdAndUserId(project.getId(), userId);
    }

    public record Access(Project project, Role role) {
    }

    public Access resolve(Long projectId, Long userId, Role required) {
        Project project = projects.findById(projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (project.getOwnerId().equals(userId)) {
            return new Access(project, Role.OWNER);
        }
        if (!members.existsByProjectIdAndUserId(projectId, userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        if (required == Role.OWNER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ehhez csak a projekt tulajdonosa jogosult");
        }
        return new Access(project, Role.MEMBER);
    }
}
