package io.tickoff.domain;

import jakarta.persistence.*;
import java.time.Instant;

/** Egy meghívott felhasználó tagsága egy projektben (a tulajdonos nem szerepel itt). */
@Entity
@Table(name = "project_members")
public class ProjectMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id")
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected ProjectMember() {
    }

    public ProjectMember(Project project, User user) {
        this.project = project;
        this.user = user;
    }

    public Long getId() { return id; }
    public Project getProject() { return project; }
    public User getUser() { return user; }
    public Instant getCreatedAt() { return createdAt; }
}
