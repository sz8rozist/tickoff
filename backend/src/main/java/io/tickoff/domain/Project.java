package io.tickoff.domain;

import jakarta.persistence.*;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;

@Entity
@Table(name = "projects")
public class Project {

    private static final SecureRandom RANDOM = new SecureRandom();

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id")
    private User owner;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(name = "site_url", nullable = false, length = 500)
    private String siteUrl;

    @Column(name = "share_token", nullable = false, unique = true, length = 64)
    private String shareToken;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected Project() {
    }

    public Project(User owner, String name, String siteUrl) {
        this.owner = owner;
        this.name = name;
        this.siteUrl = siteUrl;
        this.shareToken = generateToken();
    }

    private static String generateToken() {
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    public Long getId() { return id; }
    public User getOwner() { return owner; }
    public String getName() { return name; }
    public String getSiteUrl() { return siteUrl; }
    public String getShareToken() { return shareToken; }
    public Instant getCreatedAt() { return createdAt; }
}
