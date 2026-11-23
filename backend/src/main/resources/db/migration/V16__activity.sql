-- Tevékenységnapló: ki mit csinált a projektben (kommentek, válaszok, státuszváltások, körök, jóváhagyások)
CREATE TABLE activity (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    project_id  BIGINT       NOT NULL,
    -- USER: csapattag, CUSTOMER: az ügyfél a widgeten át
    actor_type  VARCHAR(10)  NOT NULL,
    actor_name  VARCHAR(120) NOT NULL,
    event       VARCHAR(40)  NOT NULL,
    -- A komment törlésekor a bejegyzés megmarad (a hivatkozás nélkül)
    comment_id  BIGINT       NULL,
    summary     VARCHAR(500) NOT NULL,
    created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_activity_project (project_id, id),
    CONSTRAINT fk_activity_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_comment FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE SET NULL
) ENGINE=InnoDB;
