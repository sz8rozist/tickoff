-- Mellékletek: az ügyfél képeket csatolhat a kommenthez (referencia, hibás megjelenés, stb.)
CREATE TABLE attachments (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    comment_id   BIGINT       NOT NULL,
    -- A tárolóhoz viszonyított útvonal (a fájl a képernyőképekkel egy helyen van)
    path         VARCHAR(500) NOT NULL,
    content_type VARCHAR(50)  NOT NULL,
    size_bytes   INT          NOT NULL,
    created_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_attachments_comment (comment_id),
    CONSTRAINT fk_attachments_comment FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE CASCADE
) ENGINE=InnoDB;
