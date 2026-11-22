package io.tickoff.domain;

import jakarta.persistence.*;
import java.time.Instant;

/** Egy kommenthez csatolt kép. A fájl a tárolóban van, itt csak az útvonala és a típusa. */
@Entity
@Table(name = "attachments")
public class Attachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "comment_id")
    private Comment comment;

    @Column(nullable = false, length = 500)
    private String path;

    @Column(name = "content_type", nullable = false, length = 50)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private int sizeBytes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected Attachment() {
    }

    public Attachment(Comment comment, String path, String contentType, int sizeBytes) {
        this.comment = comment;
        this.path = path;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
    }

    public Long getId() { return id; }
    public Comment getComment() { return comment; }
    public String getPath() { return path; }
    public String getContentType() { return contentType; }
    public int getSizeBytes() { return sizeBytes; }
    public Instant getCreatedAt() { return createdAt; }
}
