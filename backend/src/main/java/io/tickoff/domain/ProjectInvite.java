package io.tickoff.domain;

import jakarta.persistence.*;
import java.time.Instant;

/** Függő meghívó egy még nem (megerősítetten) regisztrált e-mail-címre. */
@Entity
@Table(name = "project_invites")
public class ProjectInvite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id")
    private Project project;

    @Column(nullable = false)
    private String email;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invited_by")
    private User invitedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected ProjectInvite() {
    }

    public ProjectInvite(Project project, String email, User invitedBy) {
        this.project = project;
        this.email = email;
        this.invitedBy = invitedBy;
    }

    public Long getId() { return id; }
    public Project getProject() { return project; }
    public String getEmail() { return email; }
    public User getInvitedBy() { return invitedBy; }
    public Instant getCreatedAt() { return createdAt; }
}
