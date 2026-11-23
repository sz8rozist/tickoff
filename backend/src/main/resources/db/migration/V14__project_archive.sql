-- Archivált projekt: a lezárt projekt eltűnik a listából, a widgetje leáll, az adatai megmaradnak
ALTER TABLE projects
    ADD COLUMN archived_at DATETIME(6) NULL;
