-- API-kulcsok a nyilvános, csak olvasható API-hoz (más rendszerek integrálásához)
CREATE TABLE api_keys (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    user_id      BIGINT       NOT NULL,
    name         VARCHAR(80)  NOT NULL,
    -- A kulcs eleje (azonosításra a listában); a kulcsot magát nem tároljuk, csak az SHA-256 hash-ét
    prefix       VARCHAR(12)  NOT NULL,
    key_hash     CHAR(64)     NOT NULL,
    created_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    last_used_at DATETIME(6)  NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_api_keys_hash (key_hash),
    KEY idx_api_keys_user (user_id),
    CONSTRAINT fk_api_keys_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;
