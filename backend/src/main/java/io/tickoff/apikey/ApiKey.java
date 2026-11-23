package io.tickoff.apikey;

import jakarta.persistence.*;
import java.time.Instant;

/** Egy API-kulcs: a kulcs hash-e, nem a kulcs maga. A kulcs a létrehozója jogaival olvashatja a projektjeit. */
@Entity
@Table(name = "api_keys")
public class ApiKey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(nullable = false, length = 12)
    private String prefix;

    @Column(name = "key_hash", nullable = false, length = 64, unique = true)
    private String keyHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    protected ApiKey() {
    }

    public ApiKey(Long userId, String name, String prefix, String keyHash) {
        this.userId = userId;
        this.name = name;
        this.prefix = prefix;
        this.keyHash = keyHash;
    }

    public void touch(Instant now) {
        this.lastUsedAt = now;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getName() { return name; }
    public String getPrefix() { return prefix; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getLastUsedAt() { return lastUsedAt; }
}
