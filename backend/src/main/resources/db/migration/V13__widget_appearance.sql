-- A widget megjelenése projektenként: márkaszín (#rrggbb) és a gombok oldala
ALTER TABLE projects
    ADD COLUMN widget_color    CHAR(7)     NULL,
    ADD COLUMN widget_position VARCHAR(5)  NOT NULL DEFAULT 'RIGHT';
