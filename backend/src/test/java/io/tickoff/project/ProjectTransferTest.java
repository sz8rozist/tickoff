package io.tickoff.project;

import io.tickoff.domain.Project;
import io.tickoff.domain.User;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ProjectTransferTest {

    @Test
    void transferUpdatesTheOwnerAndTheMirroredOwnerId() {
        User oldOwner = mock(User.class);
        when(oldOwner.getId()).thenReturn(1L);
        User newOwner = mock(User.class);
        when(newOwner.getId()).thenReturn(2L);

        Project project = new Project(oldOwner, "Teszt", "https://a.example.com");
        assertThat(project.getOwnerId()).isEqualTo(1L);

        project.transferTo(newOwner);

        // Tranzakción belül se maradhat a régi tulajdonos azonosítója (a jogosultság-ellenőrzés ezt olvassa)
        assertThat(project.getOwnerId()).isEqualTo(2L);
        assertThat(project.getOwner()).isSameAs(newOwner);
    }
}
