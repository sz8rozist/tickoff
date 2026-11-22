package io.tickoff.mail;

import io.tickoff.domain.Comment;
import io.tickoff.domain.Project;
import io.tickoff.domain.ProjectMemberRepository;
import io.tickoff.domain.Reply;
import io.tickoff.domain.Round;
import io.tickoff.domain.User;
import io.tickoff.domain.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Az ügyfélnek küldött levelek: csak megadott cím esetén mennek, linkkel és leiratkozással, korlátozva. */
class CustomerNotificationTest {

    private MailService mail;
    private NotificationService service;
    private Project project;
    private Comment comment;
    private Reply reply;

    @BeforeEach
    void setUp() {
        mail = mock(MailService.class);
        when(mail.isEnabled()).thenReturn(true);
        service = new NotificationService(mock(UserRepository.class), mock(ProjectMemberRepository.class), mail,
            mock(io.tickoff.webhook.WebhookService.class),
            "https://app.example.com/");

        User owner = mock(User.class);
        when(owner.getName()).thenReturn("Dóra");
        project = new Project(owner, "Kávézó", "https://cafe.example.com");
        comment = new Comment(new Round(project, 1), "Anna", "A gomb kicsi", "https://cafe.example.com/etlap?x=1#fent");
        ReflectionTestUtils.setField(comment, "id", 42L);
        reply = Reply.byDesigner(comment, owner, "Javítottuk, nézd meg.");
    }

    @Test
    void designerReplyGoesToTheAddressWithDeepLinkAndUnsubscribe() {
        comment.setCustomerEmail("anna@example.com");

        service.designerReply(project, comment, reply);

        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(mail).send(org.mockito.ArgumentMatchers.eq("anna@example.com"), anyString(), text.capture());
        assertThat(text.getValue())
            .contains("Javítottuk, nézd meg.")
            // A meglévő query és a fragment megmarad, a mélylink paramétere hozzáadódik
            .contains("https://cafe.example.com/etlap?x=1&tickoff-comment=42#fent")
            .contains("https://app.example.com/api/notifications/unsubscribe/" + comment.getNotifyToken());
    }

    @Test
    void nothingIsSentWithoutAnAddress() {
        service.designerReply(project, comment, reply);
        service.commentDone(project, comment);

        verify(mail, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    void nothingIsSentAfterUnsubscribing() {
        comment.setCustomerEmail("anna@example.com");
        comment.unsubscribe();

        service.commentDone(project, comment);

        verify(mail, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    void nothingIsSentWhenMailIsNotConfigured() {
        when(mail.isEnabled()).thenReturn(false);
        comment.setCustomerEmail("anna@example.com");

        service.commentDone(project, comment);

        verify(mail, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    void doneNotificationInvitesTheCustomerToReview() {
        comment.setCustomerEmail("anna@example.com");

        service.commentDone(project, comment);

        ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(mail).send(org.mockito.ArgumentMatchers.eq("anna@example.com"), subject.capture(), text.capture());
        assertThat(subject.getValue()).startsWith("[Tickoff]").contains("Kávézó");
        assertThat(text.getValue()).contains("A gomb kicsi").contains("el is fogadhatod");
    }

    @Test
    void perAddressLimitStopsAFlood() {
        comment.setCustomerEmail("anna@example.com");

        for (int i = 0; i < 30; i++) {
            service.designerReply(project, comment, reply);
        }

        // Címenként 10 levél egyszerre, utána percenként 1: a többi elmarad
        ArgumentCaptor<String> to = ArgumentCaptor.forClass(String.class);
        verify(mail, org.mockito.Mockito.atMost(11)).send(to.capture(), any(), any());
        assertThat(to.getAllValues()).hasSizeLessThanOrEqualTo(11);
    }

    @Test
    void deepLinkReplacesAnExistingFocusParameter() {
        assertThat(NotificationService.deepLink("https://a.example.com/?tickoff-comment=1&b=2", 7L))
            .isEqualTo("https://a.example.com/?b=2&tickoff-comment=7");
    }
}
