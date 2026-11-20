package io.tickoff.domain;

import jakarta.persistence.*;
import java.time.Instant;

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

    public void setEnvironment(Integer viewportWidth, Integer viewportHeight, String userAgent) {
        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;
        this.userAgent = userAgent;
    }

    public void setScreenshotPath(String screenshotPath) { this.screenshotPath = screenshotPath; }
    public void setStatus(Status status) { this.status = status; }

    public Long getId() { return id; }
    public Round getRound() { return round; }
    public String getAuthorName() { return authorName; }
    public String getBody() { return body; }
    public String getPageUrl() { return pageUrl; }
    public String getCssSelector() { return cssSelector; }
    public Double getPosX() { return posX; }
    public Double getPosY() { return posY; }
    public Integer getViewportWidth() { return viewportWidth; }
    public Integer getViewportHeight() { return viewportHeight; }
    public String getUserAgent() { return userAgent; }
    public String getScreenshotPath() { return screenshotPath; }
    public Status getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
}
