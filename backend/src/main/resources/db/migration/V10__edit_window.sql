-- Az ügyfél rövid ideig szerkesztheti vagy visszavonhatja a saját kommentjét, fiók nélkül.
-- A jogosultságot egy véletlen titok adja, amelyet csak a komment létrehozásakor kap meg a widget;
-- az adatbázisban csak az SHA-256 hash-e van.
ALTER TABLE comments
    ADD COLUMN edit_token_hash CHAR(64)    NULL,
    ADD COLUMN edited_at       DATETIME(6) NULL;
