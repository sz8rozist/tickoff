package io.tickoff.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

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

    /** Az ügyfél jóváhagyta a kört (minden komment kész volt). Új vagy újranyitott komment érvényteleníti. */
    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "approved_by", length = 120)
    private String approvedBy;

    /** Tájékoztató határidő az ügyfélnek (a lejárta nem zárja le a kört). */
    @Column(name = "due_date")
    private LocalDate dueDate;

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

    public void approve(String by) {
        this.approvedAt = Instant.now();
        this.approvedBy = by;
    }

    public void clearApproval() {
        this.approvedAt = null;
        this.approvedBy = null;
    }

    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public LocalDate getDueDate() { return dueDate; }

    public Instant getApprovedAt() { return approvedAt; }
    public String getApprovedBy() { return approvedBy; }

    public Long getId() { return id; }
    public Project getProject() { return project; }
    public int getNumber() { return number; }
    public Status getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getClosedAt() { return closedAt; }
}
