package io.tickoff.domain;

import jakarta.persistence.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;

@Entity
@Table(name = "comments")
public class Comment {

    public enum Status { OPEN, IN_PROGRESS, DONE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "round_id")
    private Round round;

    @Column(name = "author_name", nullable = false, length = 120)
    private String authorName;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(name = "page_url", nullable = false, length = 1000)
    private String pageUrl;

    @Column(name = "css_selector", length = 1000)
    private String cssSelector;

    @Column(name = "pos_x")
    private Double posX;

    @Column(name = "pos_y")
    private Double posY;

    /** A kijelölt terület mérete az elem méretének százalékában (null: egyetlen pont/elem). */
    @Column(name = "area_width")
    private Double areaWidth;

    @Column(name = "area_height")
    private Double areaHeight;

    @Column(name = "viewport_width")
    private Integer viewportWidth;

    @Column(name = "viewport_height")
    private Integer viewportHeight;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "screenshot_path", length = 500)
    private String screenshotPath;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.OPEN;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    /** Az ügyfél e-mail-címe az értesítésekhez (opcionális, a widgetnek nem adjuk vissza). */
    @Column(name = "customer_email", length = 254)
    private String customerEmail;

    /** A levélben szereplő leiratkozó link titka. */
    @Column(name = "notify_token", length = 32)
    private String notifyToken;

    @Column(name = "customer_approved_at")
    private Instant customerApprovedAt;

    /** A szerkesztési titok SHA-256 hash-e (hex); a titkot magát nem tároljuk. */
    @Column(name = "edit_token_hash", length = 64)
    private String editTokenHash;

    @Column(name = "edited_at")
    private Instant editedAt;

    /** A felelős csapattag (tulajdonos vagy tag), vagy null. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignee_id")
    private User assignee;

    protected Comment() {
    }

    public Comment(Round round, String authorName, String body, String pageUrl) {
        this.round = round;
        this.authorName = authorName;
        this.body = body;
        this.pageUrl = pageUrl;
    }

    public void setLocation(String cssSelector, Double posX, Double posY) {
        this.cssSelector = cssSelector;
        this.posX = posX;
        this.posY = posY;
    }

    public void setArea(Double areaWidth, Double areaHeight) {
        this.areaWidth = areaWidth;
        this.areaHeight = areaHeight;
    }

    public void setEnvironment(Integer viewportWidth, Integer viewportHeight, String userAgent) {
        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;
        this.userAgent = userAgent;
    }

    public void setScreenshotPath(String screenshotPath) { this.screenshotPath = screenshotPath; }

    /**
     * Státuszváltás. Az ügyfél elfogadása csak az adott "Kész" állapotra szól, ezért változáskor törlődik; ha a komment
     * már nem kész, a kör jóváhagyása sem érvényes.
     */
    public void setStatus(Status status) {
        if (status != this.status) {
            this.customerApprovedAt = null;
            if (status != Status.DONE) {
                round.clearApproval();
            }
        }
        this.status = status;
    }

    /** Az ügyfél elfogadja a kész kommentet. */
    public void approveByCustomer() {
        this.customerApprovedAt = Instant.now();
    }

    /** Értesítési cím beállítása; a leiratkozó token ilyenkor jön létre. Üres cím = nincs értesítés. */
    public void setCustomerEmail(String email) {
        if (email == null || email.isBlank()) {
            this.customerEmail = null;
            this.notifyToken = null;
            return;
        }
        this.customerEmail = email.trim();
        byte[] bytes = new byte[16];
        new SecureRandom().nextBytes(bytes);
        this.notifyToken = HexFormat.of().formatHex(bytes);
    }

    /** Leiratkozás: a cím és a token is törlődik. */
    public void unsubscribe() {
        this.customerEmail = null;
        this.notifyToken = null;
    }

    /**
     * Új szerkesztési titkot ad ki a kommenthez, és visszaadja (csak ekkor látható egyszer: a widget a böngészőben
     * őrzi). Az adatbázisban csak a hash-e van.
     */
    public String issueEditToken() {
        byte[] bytes = new byte[16];
        new SecureRandom().nextBytes(bytes);
        String token = HexFormat.of().formatHex(bytes);
        this.editTokenHash = sha256(token);
        return token;
    }

    /** Egyezik-e a megadott titok a kiadottal (időzítés-biztos összehasonlítás). */
    public boolean matchesEditToken(String candidate) {
        if (editTokenHash == null || candidate == null) return false;
        return MessageDigest.isEqual(editTokenHash.getBytes(StandardCharsets.UTF_8),
            sha256(candidate).getBytes(StandardCharsets.UTF_8));
    }

    /** A szöveg módosítása az ügyfél által. */
    public void editBody(String newBody) {
        this.body = newBody;
        this.editedAt = Instant.now();
    }

    private static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public Instant getEditedAt() { return editedAt; }

    public void setAssignee(User assignee) { this.assignee = assignee; }
    public User getAssignee() { return assignee; }

    public String getCustomerEmail() { return customerEmail; }
    public String getNotifyToken() { return notifyToken; }
    public Instant getCustomerApprovedAt() { return customerApprovedAt; }

    public Long getId() { return id; }
    public Round getRound() { return round; }
    public String getAuthorName() { return authorName; }
    public String getBody() { return body; }
    public String getPageUrl() { return pageUrl; }
    public String getCssSelector() { return cssSelector; }
    public Double getPosX() { return posX; }
    public Double getPosY() { return posY; }
    public Double getAreaWidth() { return areaWidth; }
    public Double getAreaHeight() { return areaHeight; }
    public Integer getViewportWidth() { return viewportWidth; }
    public Integer getViewportHeight() { return viewportHeight; }
    public String getUserAgent() { return userAgent; }
    public String getScreenshotPath() { return screenshotPath; }
    public Status getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
}
