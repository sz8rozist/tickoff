-- Összefoglaló e-mail (napi vagy heti), amit a felhasználó kérhet a projektjeiről
ALTER TABLE users
    ADD COLUMN digest_frequency    VARCHAR(10) NOT NULL DEFAULT 'OFF',
    ADD COLUMN digest_last_sent_at DATETIME(6) NULL;
