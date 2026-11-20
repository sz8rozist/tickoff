package io.tickoff.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "replies")
public class Reply {

    public enum AuthorType { DESIGNER, CUSTOMER }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "comment_id")
    private Comment comment;

    @Column(name = "author_name", nullable = false, length = 120)
    private String authorName;

    @Enumerated(EnumType.STRING)
    @Column(name = "author_type", nullable = false, length = 20)
    private AuthorType authorType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected Reply() {
    }

    private Reply(Comment comment, String authorName, AuthorType authorType, User user, String body) {
        this.comment = comment;
        this.authorName = authorName;
        this.authorType = authorType;
        this.user = user;
        this.body = body;
    }

    /** Bejelentkezett felhasználó (designer) válasza. */
    public static Reply byDesigner(Comment comment, User user, String body) {
        return new Reply(comment, user.getName(), AuthorType.DESIGNER, user, body);
    }

    /** A widgeten át érkező, azonosítatlan ügyfél válasza. */
    public static Reply byCustomer(Comment comment, String authorName, String body) {
        return new Reply(comment, authorName, AuthorType.CUSTOMER, null, body);
    }

    public Long getId() { return id; }
    public Comment getComment() { return comment; }
    public String getAuthorName() { return authorName; }
    public AuthorType getAuthorType() { return authorType; }
    public User getUser() { return user; }
    public String getBody() { return body; }
    public Instant getCreatedAt() { return createdAt; }
}
