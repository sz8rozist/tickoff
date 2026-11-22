-- Webhook (Slack, Discord, saját szolgáltatás): a projekt eseményeit egy URL-re küldjük
ALTER TABLE projects
    ADD COLUMN webhook_url    VARCHAR(500) NULL,
    -- A kérések aláírásához (HMAC-SHA256): a fogadó ezzel ellenőrizheti, hogy a kérés tőlünk jött
    ADD COLUMN webhook_secret CHAR(32)     NULL;
