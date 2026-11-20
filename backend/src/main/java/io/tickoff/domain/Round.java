package io.tickoff.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "rounds")
public class Round {

    public enum Status { OPEN, CLOSED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id")
    private Project project;

    @Column(nullable = false)
    private int number;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.OPEN;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "closed_at")
    private Instant closedAt;

    protected Round() {
    }

    public Round(Project project, int number) {
        this.project = project;
        this.number = number;
    }

    public void close() {
        this.status = Status.CLOSED;
        this.closedAt = Instant.now();
    }

    public Long getId() { return id; }
    public Project getProject() { return project; }
    public int getNumber() { return number; }
    public Status getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getClosedAt() { return closedAt; }
}
