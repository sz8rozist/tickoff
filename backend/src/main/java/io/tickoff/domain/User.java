package io.tickoff.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    /** Az ennél korábban kiadott bejelentkezési tokenek érvénytelenek (jelszó-visszaállítás után). */
    @Column(name = "password_changed_at")
    private Instant passwordChangedAt;

    @Column(name = "notify_email", nullable = false)
    private boolean notifyEmail = true;

    protected User() {
    }

    public User(String email, String passwordHash, String name) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.name = name;
    }

    /** Új jelszó beállítása. A korábban kiadott bejelentkezési tokenek ezzel érvénytelenné válnak. */
    public void changePassword(String newPasswordHash, Instant now) {
        this.passwordHash = newPasswordHash;
        this.passwordChangedAt = now;
    }

    public void setNotifyEmail(boolean notifyEmail) { this.notifyEmail = notifyEmail; }

    public Instant getPasswordChangedAt() { return passwordChangedAt; }
    public boolean isNotifyEmail() { return notifyEmail; }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getName() { return name; }
    public Instant getCreatedAt() { return createdAt; }
}
