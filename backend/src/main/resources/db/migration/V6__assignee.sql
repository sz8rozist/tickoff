-- Felelős kijelölése: egy komment egy csapattagra (tulajdonos vagy tag) bízható.
-- Ha a felhasználó fiókja törlődik, a komment felelős nélkül marad.
ALTER TABLE comments
    ADD COLUMN assignee_id BIGINT NULL,
    ADD KEY idx_comments_assignee (assignee_id),
    ADD CONSTRAINT fk_comments_assignee FOREIGN KEY (assignee_id) REFERENCES users (id) ON DELETE SET NULL;
