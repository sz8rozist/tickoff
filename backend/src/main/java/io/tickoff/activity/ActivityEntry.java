package io.tickoff.activity;

import jakarta.persistence.*;
import java.time.Instant;

/** Egy bejegyzés a projekt tevékenységnaplójában. */
@Entity
@Table(name = "activity")
public class ActivityEntry {

    public enum ActorType { USER, CUSTOMER }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Enumerated(EnumType.STRING)
    @Column(name = "actor_type", nullable = false, length = 10)
    private ActorType actorType;

    @Column(name = "actor_name", nullable = false, length = 120)
    private String actorName;

    @Column(nullable = false, length = 40)
    private String event;

    @Column(name = "comment_id")
    private Long commentId;

    @Column(nullable = false, length = 500)
    private String summary;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected ActivityEntry() {
    }

    public ActivityEntry(Long projectId, ActorType actorType, String actorName, String event, Long commentId,
                         String summary) {
        this.projectId = projectId;
        this.actorType = actorType;
        this.actorName = actorName.length() > 120 ? actorName.substring(0, 120) : actorName;
        this.event = event;
        this.commentId = commentId;
        this.summary = summary.length() > 500 ? summary.substring(0, 499) + "…" : summary;
    }

    public Long getId() { return id; }
    public Long getProjectId() { return projectId; }
    public ActorType getActorType() { return actorType; }
    public String getActorName() { return actorName; }
    public String getEvent() { return event; }
    public Long getCommentId() { return commentId; }
    public String getSummary() { return summary; }
    public Instant getCreatedAt() { return createdAt; }
}
