-- Kétlépcsős belépés (TOTP, hitelesítő alkalmazással)
ALTER TABLE users
    -- A megosztott titok (base32); amíg a totp_enabled_at üres, a beállítás még nincs megerősítve
    ADD COLUMN totp_secret          VARCHAR(64)  NULL,
    ADD COLUMN totp_enabled_at      DATETIME(6)  NULL,
    -- A legutóbb elfogadott 30 másodperces időszelet: ugyanaz a kód nem használható újra (visszajátszás ellen)
    ADD COLUMN totp_last_step       BIGINT       NULL,
    -- A helyreállító kódok SHA-256 hash-ei, vesszővel elválasztva (felhasználáskor törlődnek)
    ADD COLUMN totp_recovery_hashes VARCHAR(700) NULL;
