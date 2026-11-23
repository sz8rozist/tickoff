-- Prioritás és címkék a kommenteken (a csapat belső rendezéséhez; az ügyfél nem látja)
ALTER TABLE comments
    ADD COLUMN priority VARCHAR(10)  NOT NULL DEFAULT 'NORMAL',
    -- Vesszővel elválasztott, kisbetűs címkék (legfeljebb 5)
    ADD COLUMN labels   VARCHAR(255) NOT NULL DEFAULT '';
