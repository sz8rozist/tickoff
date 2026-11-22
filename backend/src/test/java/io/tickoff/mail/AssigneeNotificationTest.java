package io.tickoff.mail;

import io.tickoff.domain.Comment;
import io.tickoff.domain.Project;
import io.tickoff.domain.ProjectMemberRepository;
import io.tickoff.domain.Round;
import io.tickoff.domain.User;
import io.tickoff.domain.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** A felelős kijelölésekor az új felelős értesítést kap, ha nem kapcsolta ki. */
class AssigneeNotificationTest {

    private MailService mail;
    private NotificationService service;
    private Project project;
    private Comment comment;
    private User assignee;

    @BeforeEach
    void setUp() {
        mail = mock(MailService.class);
        when(mail.isEnabled()).thenReturn(true);
        service = new NotificationService(mock(UserRepository.class), mock(ProjectMemberRepository.class), mail,
            "https://app.example.com");
        project = new Project(mock(User.class), "Kávézó", "https://cafe.example.com");
        comment = new Comment(new Round(project, 1), "Anna", "A gomb kicsi", "https://cafe.example.com/");
        assignee = mock(User.class);
        when(assignee.getId()).thenReturn(5L);
        when(assignee.getEmail()).thenReturn("bela@example.com");
        when(assignee.isNotifyEmail()).thenReturn(true);
    }

    @Test
    void assigneeGetsAMailNamingWhoAssignedIt() {
        service.assigned(project, comment, assignee, "Dóra");

        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(mail).send(eq("bela@example.com"), eq("[Tickoff] Feladatot kaptál: Kávézó"), text.capture());
        assertThat(text.getValue()).contains("Dóra rád bízta").contains("A gomb kicsi");
    }

    @Test
    void noMailWhenTheAssigneeTurnedNotificationsOff() {
        when(assignee.isNotifyEmail()).thenReturn(false);

        service.assigned(project, comment, assignee, "Dóra");

        verify(mail, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    void noMailWhenMailIsNotConfigured() {
        when(mail.isEnabled()).thenReturn(false);

        service.assigned(project, comment, assignee, "Dóra");

        verify(mail, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    void commentRemembersItsAssignee() {
        comment.setAssignee(assignee);
        assertThat(comment.getAssignee()).isSameAs(assignee);

        comment.setAssignee(null);
        assertThat(comment.getAssignee()).isNull();
    }
}
