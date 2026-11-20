package io.tickoff.project;

import io.tickoff.domain.Project;
import io.tickoff.domain.ProjectMemberRepository;
import io.tickoff.domain.ProjectRepository;
import io.tickoff.project.ProjectAccess.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ProjectAccessTest {

    private static final long PROJECT = 1L;
    private static final long OWNER = 10L;
    private static final long MEMBER = 20L;
    private static final long STRANGER = 30L;

    private final ProjectRepository projects = mock(ProjectRepository.class);
    private final ProjectMemberRepository members = mock(ProjectMemberRepository.class);
    private final Project project = mock(Project.class);
    private ProjectAccess access;

    @BeforeEach
    void setUp() {
        when(project.getOwnerId()).thenReturn(OWNER);
        when(projects.findById(PROJECT)).thenReturn(Optional.of(project));
        when(members.existsByProjectIdAndUserId(PROJECT, MEMBER)).thenReturn(true);
        access = new ProjectAccess(projects, members);
    }

    private static void assertStatus(Runnable action, HttpStatus expected) {
        assertThatThrownBy(action::run)
            .isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode().value()).isEqualTo(expected.value()));
    }

    @Test
    void ownerHasFullAccess() {
        assertThat(access.member(PROJECT, OWNER)).isSameAs(project);
        assertThat(access.owner(PROJECT, OWNER)).isSameAs(project);
        assertThat(access.roleOf(project, OWNER)).isEqualTo(Role.OWNER);
    }

    @Test
    void memberCanManageFeedbackButNotOwnerOnlyThings() {
        assertThat(access.member(PROJECT, MEMBER)).isSameAs(project);
        assertThat(access.roleOf(project, MEMBER)).isEqualTo(Role.MEMBER);

        // A tag látja a projektet, ezért 403 (nem 404) jár neki az owner-only műveletekre
        assertStatus(() -> access.owner(PROJECT, MEMBER), HttpStatus.FORBIDDEN);
    }

    @Test
    void strangerDoesNotSeeTheProjectAtAll() {
        assertStatus(() -> access.member(PROJECT, STRANGER), HttpStatus.NOT_FOUND);
        // Az owner-only műveletnél sem derül ki, hogy a projekt létezik
        assertStatus(() -> access.owner(PROJECT, STRANGER), HttpStatus.NOT_FOUND);
    }

    @Test
    void unknownProjectIsNotFound() {
        when(projects.findById(99L)).thenReturn(Optional.empty());
        assertStatus(() -> access.member(99L, OWNER), HttpStatus.NOT_FOUND);
        assertStatus(() -> access.owner(99L, OWNER), HttpStatus.NOT_FOUND);
    }
}
