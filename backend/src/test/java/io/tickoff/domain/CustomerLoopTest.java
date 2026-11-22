package io.tickoff.domain;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/** Az ügyfél-oldali kör szabályai: elfogadás, a kör jóváhagyása és az értesítési cím kezelése. */
class CustomerLoopTest {

    private Round round;
    private Comment comment;

    @BeforeEach
    void setUp() {
        round = new Round(mock(Project.class), 1);
        comment = new Comment(round, "Anna", "A gomb kicsi", "https://a.example.com/");
    }

    @Test
    void customerApprovalIsDroppedWhenTheStatusChanges() {
        comment.setStatus(Comment.Status.DONE);
        comment.approveByCustomer();
        assertThat(comment.getCustomerApprovedAt()).isNotNull();

        // Újranyitás vagy bármilyen más státusz: az elfogadás a korábbi "Kész" állapotra szólt
        comment.setStatus(Comment.Status.OPEN);

        assertThat(comment.getCustomerApprovedAt()).isNull();
    }

    @Test
    void settingTheSameStatusAgainKeepsTheApproval() {
        comment.setStatus(Comment.Status.DONE);
        comment.approveByCustomer();

        comment.setStatus(Comment.Status.DONE);

        assertThat(comment.getCustomerApprovedAt()).isNotNull();
    }

    @Test
    void leavingDoneInvalidatesTheRoundApproval() {
        comment.setStatus(Comment.Status.DONE);
        round.approve("Anna");
        assertThat(round.getApprovedAt()).isNotNull();

        comment.setStatus(Comment.Status.IN_PROGRESS);

        assertThat(round.getApprovedAt()).isNull();
        assertThat(round.getApprovedBy()).isNull();
    }

    @Test
    void becomingDoneDoesNotTouchTheRoundApproval() {
        round.approve("Anna");

        comment.setStatus(Comment.Status.DONE);

        assertThat(round.getApprovedAt()).isNotNull();
    }

    @Test
    void emailGetsAnUnguessableUnsubscribeToken() {
        comment.setCustomerEmail("  anna@example.com ");

        assertThat(comment.getCustomerEmail()).isEqualTo("anna@example.com");
        assertThat(comment.getNotifyToken()).hasSize(32).matches("[0-9a-f]{32}");

        Comment other = new Comment(round, "Béla", "x", "https://a.example.com/");
        other.setCustomerEmail("bela@example.com");
        assertThat(other.getNotifyToken()).isNotEqualTo(comment.getNotifyToken());
    }

    @Test
    void blankEmailMeansNoNotifications() {
        comment.setCustomerEmail("anna@example.com");

        comment.setCustomerEmail("   ");

        assertThat(comment.getCustomerEmail()).isNull();
        assertThat(comment.getNotifyToken()).isNull();
    }

    @Test
    void unsubscribingRemovesTheAddressAndTheToken() {
        comment.setCustomerEmail("anna@example.com");

        comment.unsubscribe();

        assertThat(comment.getCustomerEmail()).isNull();
        assertThat(comment.getNotifyToken()).isNull();
    }
}
