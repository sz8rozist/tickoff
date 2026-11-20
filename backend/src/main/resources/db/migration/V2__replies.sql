-- Kommentszálak: válaszok egy kommentre (a designertől és az ügyféltől is)
CREATE TABLE replies (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    comment_id  BIGINT       NOT NULL,
    author_name VARCHAR(120) NOT NULL,
    -- DESIGNER: bejelentkezett felhasználó, CUSTOMER: a widgeten át érkező ügyfél
    author_type VARCHAR(20)  NOT NULL,
    -- A designer válaszánál a felhasználó; törlésekor a válasz megmarad, a szerző neve a sorban van
    user_id     BIGINT       NULL,
    body        TEXT         NOT NULL,
    created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_replies_comment (comment_id, created_at),
    CONSTRAINT fk_replies_comment FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE CASCADE,
    CONSTRAINT fk_replies_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;
