-- A widget nyelve projektenként (hu vagy en): az ügyfél ezen a nyelven látja a felületet és a neki küldött leveleket
ALTER TABLE projects
    ADD COLUMN widget_lang CHAR(2) NOT NULL DEFAULT 'hu';
