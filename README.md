# Tickoff

Ügyfél-visszajelzések kezelése weboldal-projektekben, javítási körökre (rounds) bontva. Az ügyfél regisztráció nélkül, egy megosztott linken keresztül kommentel közvetlenül az oldalon; a designer egy helyen látja a státuszokat.

## Felépítés (monorepo)

| Mappa | Tartalom |
|---|---|
| `backend/` | Spring Boot 4 (Java 21), Spring Data JPA, Spring Security, Flyway, MySQL |
| `dashboard/` | Vite + React 19 + TypeScript (a designer felülete) |
| `widget/` | Beágyazható widget: React-szintaxis, buildkor Preactre aliasolva, Shadow DOM, egyetlen IIFE fájl |
| `docker-compose.yml` | MySQL 8.4 fejlesztéshez (port: `3307`) |

## Indítás

```bash
# 1) Adatbázis + backend (http://localhost:8080) – a Flyway induláskor lefuttatja a migrációkat
docker compose up -d --build

# (csak az adatbázis: docker compose up -d mysql, majd cd backend && ./mvnw spring-boot:run)

# 3) Dashboard (http://localhost:5173)
npm install
npm run dev:dashboard

# 4) Widget demo oldal
npm run dev:widget
```

A widget beágyazása egy oldalba:

```html
<script src="https://…/tickoff-widget.js" data-token="PROJEKT_TOKEN"></script>
```

## Adatmodell (V1 migráció)

`users` → `projects` (share token) → `rounds` → `comments` (selector, pozíció, viewport, user agent, státusz, képernyőkép útvonal).

## Következő lépések

- Auth a designereknek (JWT vagy session cookie)
- Widget API (`/api/widget/**`): komment mentése token alapján, projektenkénti origin-ellenőrzés
- Widget: elemkiválasztás, CSS selector és képernyőkép készítése (`html-to-image`)
- Dashboard: projektek, körök, kommentlista és státuszkezelés
- E-mail értesítések

## Ismert probléma

A fejlesztői Windows gépen a Java NIO `Selector.open()` hibával elszáll (`Unable to establish loopback connection`, `UnixDomainSockets.connect0: Invalid argument`), ezért a beágyazott Tomcat helyben nem indul. JDK 21 és JDK 26 alatt is reprodukálható, a temp könyvtár átirányítása nem segít. Ezért a backend a `docker-compose.yml`-ben Linux-konténerként fut, ott nincs ilyen gond.
