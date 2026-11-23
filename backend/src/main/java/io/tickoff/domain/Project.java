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

    // Csak olvasható tükör az owner_id oszlopról: a tulajdonos azonosítója a lusta kapcsolat betöltése nélkül is elérhető
    @Column(name = "owner_id", insertable = false, updatable = false)
    private Long ownerId;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(name = "site_url", nullable = false, length = 500)
    private String siteUrl;

    @Column(name = "share_token", nullable = false, unique = true, length = 64)
    private String shareToken;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    /** Mikor archiválták (null: aktív). Archivált projektnél a widget nem működik. */
    @Column(name = "archived_at")
    private Instant archivedAt;

    /** A widget márkaszíne (#rrggbb), vagy null: az alapértelmezett. */
    @Column(name = "widget_color", length = 7)
    private String widgetColor;

    /** A widget és az ügyfélnek küldött levelek nyelve: hu vagy en. */
    @Column(name = "widget_lang", nullable = false, length = 2)
    private String widgetLang = "hu";

    /** A widget gombjainak oldala: RIGHT (alapértelmezett) vagy LEFT. */
    @Column(name = "widget_position", nullable = false, length = 5)
    private String widgetPosition = "RIGHT";

    /** Ide küldjük a projekt eseményeit (Slack, Discord, saját fogadó), vagy null. */
    @Column(name = "webhook_url", length = 500)
    private String webhookUrl;

    /** A webhook-kérések HMAC-aláírásának titka. */
    @Column(name = "webhook_secret", length = 32)
    private String webhookSecret;

    protected Project() {
    }

    public Project(User owner, String name, String siteUrl) {
        this.owner = owner;
        this.name = name;
        this.siteUrl = siteUrl;
        this.shareToken = generateToken();
    }

    /** A projekt átadása másik felhasználónak. A tükörmezőt is frissítjük, hogy a tranzakción belül se maradjon régi érték. */
    public void transferTo(User newOwner) {
        this.owner = newOwner;
        this.ownerId = newOwner.getId();
    }

    public Long getOwnerId() {
        // Frissen létrehozott (még nem újratöltött) projektnél a tükör üres, ilyenkor a kapcsolat azonosítóját adjuk
        return ownerId != null ? ownerId : owner.getId();
    }

    /** Új megosztó token: a régi azonnal érvénytelen, a vele beágyazott widgetek leállnak. */
    public void regenerateShareToken() {
        this.shareToken = generateToken();
    }

    public void update(String name, String siteUrl) {
        this.name = name;
        this.siteUrl = siteUrl;
    }

    public void setArchived(boolean archived) {
        this.archivedAt = archived ? Instant.now() : null;
    }

    public Instant getArchivedAt() { return archivedAt; }

    public void setWidgetAppearance(String color, String position, String lang) {
        this.widgetColor = color;
        this.widgetPosition = position;
        this.widgetLang = lang;
    }

    public String getWidgetLang() { return widgetLang; }

    /** Angol nyelvű-e az ügyfél felé menő kommunikáció. */
    public boolean isEnglish() { return "en".equals(widgetLang); }

    /** Webhook beállítása; üres cím kikapcsolja. A titok az első beállításkor jön létre, és megmarad. */
    public void setWebhook(String url) {
        if (url == null || url.isBlank()) {
            this.webhookUrl = null;
            this.webhookSecret = null;
            return;
        }
        this.webhookUrl = url.trim();
        if (this.webhookSecret == null) {
            byte[] bytes = new byte[16];
            RANDOM.nextBytes(bytes);
            this.webhookSecret = HexFormat.of().formatHex(bytes);
        }
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
    public String getWidgetColor() { return widgetColor; }
    public String getWidgetPosition() { return widgetPosition; }
    public String getWebhookUrl() { return webhookUrl; }
    public String getWebhookSecret() { return webhookSecret; }
}
