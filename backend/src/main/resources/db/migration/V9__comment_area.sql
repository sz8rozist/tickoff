-- Kijelölt terület: az ügyfél téglalapot húzhat egy elem fölé (nem csak egyetlen elemre kattinthat).
-- A pos_x / pos_y a téglalap bal felső sarka, az area_* a mérete, mindkettő az elem méretének százalékában.
ALTER TABLE comments
    ADD COLUMN area_width  DOUBLE NULL,
    ADD COLUMN area_height DOUBLE NULL;
