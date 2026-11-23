-- A kör visszajelzési határideje (opcionális, tájékoztató jellegű: lejárta nem zárja le a kört)
ALTER TABLE rounds
    ADD COLUMN due_date DATE NULL;
