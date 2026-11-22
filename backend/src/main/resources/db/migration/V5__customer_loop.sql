-- Ügyfél-oldali kör: értesítési e-mail, kommentenkénti elfogadás és a kör jóváhagyása

ALTER TABLE comments
    -- Opcionális: az ügyfél itt kér értesítést a csapat válaszairól. A widget API sosem adja vissza.
    ADD COLUMN customer_email       VARCHAR(254) NULL,
    -- Leiratkozó link titka (véletlen, a levélben szerepel); leiratkozáskor a cím és a token is törlődik
    ADD COLUMN notify_token         CHAR(32)     NULL,
    -- Az ügyfél elfogadta a "Kész" kommentet
    ADD COLUMN customer_approved_at DATETIME(6)  NULL,
    ADD UNIQUE KEY uk_comments_notify_token (notify_token);

ALTER TABLE rounds
    -- Az ügyfél jóváhagyta a kört (minden komment kész volt)
    ADD COLUMN approved_at DATETIME(6)  NULL,
    ADD COLUMN approved_by VARCHAR(120) NULL;
