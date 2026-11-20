-- E-mail alapú funkciók: jelszó-visszaállítás és értesítések

ALTER TABLE users
    -- Ennél korábban kiadott bejelentkezési tokenek érvénytelenek (jelszó-visszaállításkor állítjuk)
    ADD COLUMN password_changed_at DATETIME(6) NULL,
    -- E-mail értesítés új visszajelzésről (a felhasználó kikapcsolhatja)
    ADD COLUMN notify_email BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE password_reset_tokens (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    user_id    BIGINT      NOT NULL,
    -- A tokent magát nem tároljuk, csak az SHA-256 hash-ét: az adatbázis tartalmából nem állítható vissza a link
    token_hash CHAR(64)    NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    used_at    DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_password_reset_token_hash (token_hash),
    KEY idx_password_reset_user (user_id, created_at),
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;
