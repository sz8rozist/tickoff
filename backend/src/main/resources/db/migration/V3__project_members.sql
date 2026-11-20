-- Több felhasználó egy projekten. A tulajdonos továbbra is a projects.owner_id; ide a meghívott tagok kerülnek.
CREATE TABLE project_members (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    project_id BIGINT      NOT NULL,
    user_id    BIGINT      NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_project_members (project_id, user_id),
    KEY idx_project_members_user (user_id),
    -- A projekt vagy a felhasználó törlésekor a tagság is megszűnik
    CONSTRAINT fk_project_members_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT fk_project_members_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;
