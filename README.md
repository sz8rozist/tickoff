# Tickoff

Ügyfél-visszajelzések kezelése weboldal-projektekben, javítási körökre (rounds) bontva. Az ügyfél regisztráció nélkül, egy megosztott linken keresztül kommentel közvetlenül az oldalon; a designer egy helyen látja a státuszokat.

## Felépítés (monorepo)

| Mappa | Tartalom |
|---|---|
| `backend/` | Spring Boot 4 (Java 21), Spring Data JPA, Spring Security, Flyway, MySQL |
| `dashboard/` | Vite + React 19 + TypeScript + [Mantine](https://mantine.dev) 9 (a designer felülete) |
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

## Auth

JWT (HS256, Spring Security OAuth2 resource server), állapotmentes. A designerek e-mail + jelszóval regisztrálnak és lépnek be, az ügyfelek nem (nekik a projekt share tokenje elég).

| Végpont | Leírás |
|---|---|
| `POST /api/auth/register` | `{email, password (8–72), name}` → `201 {token, user}`; `409` ha már van ilyen e-mail |
| `POST /api/auth/login` | `{email, password}` → `200 {token, user}`; `401` hibás adatokra |
| `GET /api/me` | `Authorization: Bearer <token>` → az aktuális felhasználó |

A jelszavak bcrypt hash-ként tárolódnak. Konfiguráció: `TICKOFF_JWT_SECRET` (legalább 32 bájt, **élesben kötelező felülírni**), `TICKOFF_JWT_TTL` (alapérték: `12h`).

## Projektek

Minden `/api/projects` végpont tokent kér, és csak a bejelentkezett felhasználó saját projektjeit éri el (más projektjére `404`-et adnak).

| Végpont | Leírás |
|---|---|
| `GET /api/projects` | saját projektek, újabb elöl |
| `POST /api/projects` | `{name, siteUrl (http/https)}` → `201`; automatikusan létrejön az 1. kör |
| `GET /api/projects/{id}` | egy projekt |
| `PUT /api/projects/{id}` | név és URL módosítása |
| `DELETE /api/projects/{id}` | `204`; a körök és kommentek az adatbázisban kaszkádolva törlődnek |

## Körök

Egy projektnek egyszerre legfeljebb egy nyitott köre van. Új kört csak az előző lezárása után lehet nyitni (különben `409`). A sorszámot a szerver adja, a párhuzamos kéréseket az egyedi index (`project_id`, `number`) védi.

| Végpont | Leírás |
|---|---|
| `GET /api/projects/{id}/rounds` | a projekt körei sorszám szerint |
| `POST /api/projects/{id}/rounds` | új kör nyitása → `201`; `409`, ha van nyitott kör |
| `POST /api/projects/{id}/rounds/{roundId}/close` | kör lezárása → `200`; `409`, ha már le van zárva |

## Kommentek (designer oldal)

A widgetből beérkezett kommentek a bejelentkezett tulajdonos számára, projekt- és kör-szinten. Más projektjére itt is `404`.

| Végpont | Leírás |
|---|---|
| `GET /api/projects/{id}/rounds/{roundId}/comments` | a kör kommentjei, minden mezővel (selector, viewport, user agent, státusz) |
| `PATCH /api/projects/{id}/comments/{commentId}` | `{status: OPEN \| IN_PROGRESS \| DONE}`; érvénytelen értékre `400` |
| `GET /api/projects/{id}/comments/{commentId}/screenshot` | a képernyőkép (PNG/JPEG); `404`, ha nincs |

A körlistában minden körnél ott van a `commentCount` és az `openCommentCount`. A képernyőképet JWT védi, ezért a dashboard fejléccel kéri le, és `blob:` URL-ként jeleníti meg (nem `<img src>`-vel). A dashboardon a kommentek oldalanként (`pageUrl`) csoportosítva látszanak.

## Widget API

A beágyazott widget végpontjai. Nincs bejelentkezés: a projekt **megosztó tokenje** az útvonalban van (a CORS-preflight nem hordozhat egyedi fejléc-értéket, ezért nem fejlécben megy). Két védelem van:

1. **Origin-ellenőrzés**: a kérés `Origin` fejlécének egyeznie kell a projekt `siteUrl`-jének origin-jével (séma + host + port, az alapértelmezett port elhagyható). Eltérésnél `403`. A CORS-fejléceket is csak erre az origin-re adjuk, ismeretlen tokennél semmit.
2. **Token**: ismeretlen tokenre `404`.

A widgetet tehát azon az origin-en kell beágyazni, amit a projektnél megadtál. Az `Origin` fejléc nélküli kérések (pl. curl) átmennek, a tokent viszont ők is ismerniük kell: a védelem a böngészőt védi a más oldalról érkező visszaélésektől, nem titkosítás.

| Végpont | Leírás |
|---|---|
| `GET /api/widget/{token}/project` | projekt neve, oldala és a nyitott kör (`null`, ha nincs) |
| `GET /api/widget/{token}/comments?pageUrl=` | a nyitott kör kommentjei, opcionálisan egy oldalra szűrve |
| `POST /api/widget/{token}/comments` | komment mentése a nyitott körbe → `201`; `409`, ha nincs nyitott kör; `400`, ha a `pageUrl` nem a projekt oldaláról való |
| `POST /api/widget/{token}/comments/{id}/screenshot` | képernyőkép: nyers `image/png` vagy `image/jpeg` a törzsben, max. 3 MB → `204`; `413` túl nagy, `415` rossz típus, `400` ha a tartalom nem kép (a fájl első bájtjait ellenőrizzük), `409` ha már van képe |

Komment törzse: `{authorName, body, pageUrl, cssSelector?, posX?, posY?, viewportWidth?, viewportHeight?}`. A user agentet a szerver a fejlécből veszi.

A képernyőképek a `TICKOFF_STORAGE_DIR` könyvtárban vannak (Dockerben a `screenshots` kötet), az adatbázisban csak a relatív útvonal.

## Következő lépések

- Widget: elemkiválasztás, CSS selector és képernyőkép készítése (`html-to-image`), jelölések kirajzolása
- Visszaélés-védelem a widget végpontokon (kérésszám-korlát)
- E-mail értesítések

## Ismert probléma

A fejlesztői Windows gépen a Java NIO `Selector.open()` hibával elszáll (`Unable to establish loopback connection`, `UnixDomainSockets.connect0: Invalid argument`), ezért a beágyazott Tomcat helyben nem indul. JDK 21 és JDK 26 alatt is reprodukálható, a temp könyvtár átirányítása nem segít. Ezért a backend a `docker-compose.yml`-ben Linux-konténerként fut, ott nincs ilyen gond.
