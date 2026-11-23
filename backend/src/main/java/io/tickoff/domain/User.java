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

    /** OFF, DAILY vagy WEEKLY: összefoglaló e-mail a projektekről. */
    @Column(name = "digest_frequency", nullable = false, length = 10)
    private String digestFrequency = "OFF";

    @Column(name = "digest_last_sent_at")
    private Instant digestLastSentAt;

    /** A TOTP megosztott titka (base32); amíg a totp_enabled_at üres, a beállítás nincs megerősítve. */
    @Column(name = "totp_secret", length = 64)
    private String totpSecret;

    @Column(name = "totp_enabled_at")
    private Instant totpEnabledAt;

    @Column(name = "totp_last_step")
    private Long totpLastStep;

    @Column(name = "totp_recovery_hashes", length = 700)
    private String totpRecoveryHashes;

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

    public void setDigestFrequency(String frequency) { this.digestFrequency = frequency; }
    public String getDigestFrequency() { return digestFrequency; }
    public Instant getDigestLastSentAt() { return digestLastSentAt; }
    public void markDigestSent(Instant now) { this.digestLastSentAt = now; }

    public boolean isTotpEnabled() { return totpEnabledAt != null; }
    public String getTotpSecret() { return totpSecret; }
    public Long getTotpLastStep() { return totpLastStep; }
    public void setTotpLastStep(Long step) { this.totpLastStep = step; }
    public String getTotpRecoveryHashes() { return totpRecoveryHashes; }
    public void setTotpRecoveryHashes(String hashes) { this.totpRecoveryHashes = hashes; }

    /** Új (még nem megerősített) titok; a korábbi, megerősítetlen titok lecserélődik. */
    public void startTotpSetup(String secret) {
        this.totpSecret = secret;
    }

    public void enableTotp(Instant now, long step, String recoveryHashes) {
        this.totpEnabledAt = now;
        this.totpLastStep = step;
        this.totpRecoveryHashes = recoveryHashes;
    }

    public void clearTotp() {
        this.totpSecret = null;
        this.totpEnabledAt = null;
        this.totpLastStep = null;
        this.totpRecoveryHashes = null;
    }

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
