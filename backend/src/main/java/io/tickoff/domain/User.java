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

    /** Mikor erősítette meg az e-mail-címét (null: még nem). A meglévő fiókokat a migráció megerősítettnek jelöli. */
    @Column(name = "email_verified_at")
    private Instant emailVerifiedAt;

    @Column(name = "email_verify_hash", length = 64)
    private String emailVerifyHash;

    @Column(name = "email_verify_expires_at")
    private Instant emailVerifyExpiresAt;

    @Column(name = "email_verify_sent_at")
    private Instant emailVerifySentAt;

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

    public boolean isEmailVerified() { return emailVerifiedAt != null; }

    /** A cím megerősítve: a függő token érvényét veszti. */
    public void markEmailVerified(Instant now) {
        this.emailVerifiedAt = now;
        this.emailVerifyHash = null;
        this.emailVerifyExpiresAt = null;
    }

    /** Új megerősítő token (csak a hash-e); a korábbi érvényét veszti. */
    public void setEmailVerification(String hash, Instant expiresAt, Instant sentAt) {
        this.emailVerifyHash = hash;
        this.emailVerifyExpiresAt = expiresAt;
        this.emailVerifySentAt = sentAt;
    }

    public Instant getEmailVerifyExpiresAt() { return emailVerifyExpiresAt; }
    public Instant getEmailVerifySentAt() { return emailVerifySentAt; }

    public Instant getPasswordChangedAt() { return passwordChangedAt; }
    public boolean isNotifyEmail() { return notifyEmail; }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getName() { return name; }
    public Instant getCreatedAt() { return createdAt; }
}
