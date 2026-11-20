CREATE TABLE users (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(120) NOT NULL,
    created_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE projects (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    owner_id    BIGINT       NOT NULL,
    name        VARCHAR(160) NOT NULL,
    site_url    VARCHAR(500) NOT NULL,
    -- Az ügyfél ezzel a tokennel fér hozzá regisztráció nélkül
    share_token VARCHAR(64)  NOT NULL,
    created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_projects_share_token (share_token),
    CONSTRAINT fk_projects_owner FOREIGN KEY (owner_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE rounds (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    project_id BIGINT      NOT NULL,
    number     INT         NOT NULL,
    status     VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    closed_at  DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_rounds_project_number (project_id, number),
    CONSTRAINT fk_rounds_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE comments (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    round_id        BIGINT       NOT NULL,
    author_name     VARCHAR(120) NOT NULL,
    body            TEXT         NOT NULL,
    page_url        VARCHAR(1000) NOT NULL,
    css_selector    VARCHAR(1000) NULL,
    pos_x           DOUBLE       NULL,
    pos_y           DOUBLE       NULL,
    viewport_width  INT          NULL,
    viewport_height INT          NULL,
    user_agent      VARCHAR(500) NULL,
    screenshot_path VARCHAR(500) NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'OPEN',
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_comments_round (round_id),
    CONSTRAINT fk_comments_round FOREIGN KEY (round_id) REFERENCES rounds (id) ON DELETE CASCADE
) ENGINE=InnoDB;
