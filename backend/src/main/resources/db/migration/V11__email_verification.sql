-- E-mail-cím megerősítése regisztrációkor, és meghívás még nem regisztrált kollégának.
ALTER TABLE users
    ADD COLUMN email_verified_at        DATETIME(6) NULL,
    -- A megerősítő link tokenjének SHA-256 hash-e (a tokent magát nem tároljuk), lejárata és a küldés ideje
    ADD COLUMN email_verify_hash        CHAR(64)    NULL,
    ADD COLUMN email_verify_expires_at  DATETIME(6) NULL,
    ADD COLUMN email_verify_sent_at     DATETIME(6) NULL,
    ADD UNIQUE KEY uk_users_email_verify_hash (email_verify_hash);

-- A már meglévő fiókokat megbízhatónak tekintjük: nekik nincs mit megerősíteniük
UPDATE users SET email_verified_at = CURRENT_TIMESTAMP(6) WHERE email_verified_at IS NULL;

-- Függő meghívó: a tulajdonos olyan e-mail-címet hívott meg, amelyhez még nincs (megerősített) fiók.
-- A címhez tartozó fiók megerősítésekor a meghívó automatikusan taggá teszi a felhasználót.
CREATE TABLE project_invites (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    project_id BIGINT       NOT NULL,
    email      VARCHAR(255) NOT NULL,
    invited_by BIGINT       NULL,
    created_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_project_invites (project_id, email),
    KEY idx_project_invites_email (email),
    CONSTRAINT fk_project_invites_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT fk_project_invites_user FOREIGN KEY (invited_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;
