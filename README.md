# Tickoff

Ügyfél-visszajelzések kezelése weboldal-projektekben, javítási körökre (rounds) bontva. Az ügyfél regisztráció nélkül, egy megosztott linken keresztül kommentel közvetlenül az oldalon; a designer egy helyen látja a státuszokat.

## Felépítés (monorepo)

| Mappa | Tartalom |
|---|---|
| `backend/` | Spring Boot 4 (Java 21), Spring Data JPA, Spring Security, Flyway, MySQL |
| `dashboard/` | Vite + React 19 + TypeScript + [Mantine](https://mantine.dev) 9 (a designer felülete) |
| `widget/` | Beágyazható widget: React-szintaxis, buildkor Preactre aliasolva, Shadow DOM, egyetlen IIFE fájl |
| `docker-compose.yml` | Fejlesztői stack: MySQL 8.4 (port: `3307`) és a backend (port: `8080`) |
| `docker-compose.prod.yml`, `Dockerfile.web`, `deploy/` | Production stack: MySQL, backend, Caddy (HTTPS, dashboard, widget, proxy), lásd az Üzemeltetés szakaszt |
| `scripts/backup.sh` | Mentés az éles stackről |

## Indítás

```bash
# 1) Adatbázis + backend (http://localhost:8080) – a Flyway induláskor lefuttatja a migrációkat
docker compose up -d --build

# (csak az adatbázis: docker compose up -d mysql, majd cd backend && ./mvnw spring-boot:run)

# 3) Dashboard (http://localhost:5173)
npm install
npm run dev:dashboard

# 4) Widget demo oldal (http://localhost:5174/?token=PROJEKT_TOKEN)
npm run dev:widget
```

A widget kipróbálásához a projekt oldalának címe a dashboardon `http://localhost:5174` legyen, mert a CORS és az origin-ellenőrzés ehhez köti a kéréseket.

## Widget beágyazása

```html
<script src="https://…/tickoff-widget.js" data-token="PROJEKT_TOKEN" data-api="https://api.pelda.hu"></script>
```

A `data-api` elhagyható, ilyenkor a script saját origin-je az API címe. A widget a projekt megosztó tokenjével dolgozik, és csak azon az oldalon működik, amelynek origin-je (séma + host + port) egyezik a projektnél megadottal. Rossz token vagy origin esetén a widget nem jelenik meg, a vendégoldalon nincs hibaüzenet, csak egy figyelmeztetés a böngésző konzoljában.

**Az ügyfél oldaláról nézve:**

1. A jobb alsó **Visszajelzés** gomb elindítja az elemkiválasztást: az egér alatti elem keretet kap, kattintásra kiválasztódik (Esc: mégse). A kattintást a widget elnyeli, az oldal saját kattintás-kezelője nem fut le.
2. Egy űrlapon megadja a nevét (a böngésző megjegyzi) és a szöveget, opcionálisan képernyőképet csatol (Ctrl+Enter: küldés).
3. A kommentek számozott **jelölésként** látszanak az oldalon (piros: nyitott, narancs: folyamatban, zöld: kész), kattintásra megnyílik a szövegük. A jelölések követik az elemet, ha az elrendezés megváltozik (pl. mobil nézetben).

**Mit rögzít a komment:** az elem egyedi CSS-selectorát (a lehető legrövidebbet, `#id`-t preferálva), a kattintás helyét az elem méretének százalékában (`posX`/`posY`, 0–100), az oldal URL-jét (`origin + útvonal + query`), a viewport méretét, a user agentet (szerveroldalon a fejlécből) és a képernyőképet. A képernyőkép a látható nézet piros-fehér kerettel kiemelt elemmel; a widget saját felülete nincs rajta.

**Korlátok:**

- A jelölések csak a **nyitott kör** kommentjeit mutatják, lezárt körnél nincs jelölés és nem lehet újat küldeni (az ügyfél tájékoztató üzenetet kap).
- Az oldal URL-jébe a query is bekerül, ezért ne legyen titok az URL-ben (pl. token, jelszó-visszaállító kód).
- Single-page alkalmazásnál a jelölések az oldal betöltésekor töltődnek be, útvonalváltáskor nem frissülnek.
- A képernyőkép a görgetést eltolással kezeli, ezért görgetett oldalon a `position: fixed` elemek (pl. rögzített fejléc) elcsúszhatnak a képen. A kép best effort: ha nem sikerül (idegen domainről érkező képek, 10 mp időtúllépés, a böngészőlap a háttérben van), a komment akkor is mentődik, és az ügyfél jelzést kap.
- A widget mérete kb. 17,6 KB gzip.

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

## Kérésszám-korlát

A visszaélések ellen (komment-spam, jelszó-találgatás, preflight-árasztás) a backend memóriabeli **token bucket** korlátozót használ (`io.tickoff.ratelimit`). Túllépéskor `429 Too Many Requests` jön `Retry-After` fejléccel (másodpercben, mikor lesz újra token).

| Mire | Kulcs | Kapacitás / feltöltés |
|---|---|---|
| Widget írás (komment + képernyőkép, közös keret) | IP | 20 / 20 percenként |
| | token | 120 / 120 percenként |
| Widget olvasás (`GET /api/widget/{token}/**`) | IP | 60 / 120 percenként |
| | token | 120 / 600 percenként |
| Widget összes kérése, **a preflightot is** beleértve | IP | 200 / 300 percenként |
| `POST /api/auth/login` | IP | 10 / 10 percenként |
| `POST /api/auth/register` | IP | 5 / 5 percenként |

Két szűrő fut: a durva IP-korlát a CORS előtt (minden widget-kérés, a preflight is, adatbázis-lekérdezéssel jár a CORS-beállításhoz, ezt védi), a pontos korlátok a CORS után (így a 429-es válaszban már ott van az `Access-Control-Allow-Origin`, és a widget el tudja olvasni, majd barátságos üzenetet mutat). A durva korlát 429-es válasza CORS-fejléc nélkül megy, ez csak támadásszerű forgalomnál fordul elő.

A kulcsok száma korlátos (LRU, 50 000), így véletlen tokenekkel sem lehet elfogyasztani a memóriát. Az IP-korlátokat vizsgáljuk előbb, mint a token-korlátokat. Kikapcsolás: `TICKOFF_RATE_LIMIT_ENABLED=false`.

**Üzemeltetési tudnivalók:**

- **Proxy mögött** a korlát az alkalmazás által látott távoli címre épül. Ha a szerver egy reverse proxy mögött fut, minden kliens ugyanazzal az IP-vel látszik, és közös vödörbe kerül. A `prod` profil ezt kezeli: `server.forward-headers-strategy=native`, így a backend a **belső hálózati** (privát címtartományú) proxy `X-Forwarded-For` fejlécéből olvassa a kliens-IP-t, bármi mástól érkezőt figyelmen kívül hagy. A mellékelt Caddy a kapott kérések fejlécét felülírja, tehát a kliens által hamisított `X-Forwarded-For` hatástalan. Ha saját proxyt használsz, ami nem privát címtartományban van, add meg a címét: `server.tomcat.remoteip.internal-proxies`.
- **Egy példányra** működik. Több példányos telepítésnél minden példánynak saját vödrei vannak, ezért a hatékony korlát a példányszám-szorosa; pontos korláthoz közös tároló (pl. Redis) kell.
- Az egységtesztek (`RateLimiterTest`, `RateLimitFilterTest`) adatbázis nélkül futnak: `./mvnw test -Dtest='RateLimiterTest,RateLimitFilterTest'` (ezen a gépen Dockerben, lásd az Ismert problémát).

## Üzemeltetés (production)

A production stack három konténer: **MySQL** (csak belső hálózaton), **backend** (`prod` profil, nem root felhasználó, csak belső hálózaton) és **web** (Caddy: automatikus HTTPS, a lefordított dashboard és widget kiszolgálása, az `/api` proxyja). Kívülről egyedül a Caddy érhető el, a 80-as és 443-as porton.

### Első indítás

Előfeltétel: egy szerver Dockerrel, és egy domain, aminek a DNS-e a szerverre mutat (a Let's Encrypt-hez a 80-as és 443-as portnak elérhetőnek kell lennie).

```bash
cp .env.example .env
# töltsd ki: domain, e-mail, jelszavak, JWT-titok. Erős titkok:  openssl rand -base64 36
docker compose -f docker-compose.prod.yml up -d --build
```

A kötelező változók hiányában a compose érthető hibával megáll (és a backend a `prod` profillal sem indul el titok nélkül, a fejlesztői JWT-titkot pedig kifejezetten elutasítja). Az első indításkor a tanúsítvány kérése pár másodpercet vesz igénybe; az állapot: `https://<domain>/actuator/health`.

1. Nyisd meg a `https://<domain>` címet, és **regisztráld a saját fiókodat**.
2. Állítsd a `.env`-ben `TICKOFF_REGISTRATION_ENABLED=false` értékre, és `docker compose -f docker-compose.prod.yml up -d` (újraindul a backend). Így idegenek nem tudnak fiókot létrehozni. Ha egy kolléga is kell, kapcsold vissza ideiglenesen.
3. Hozz létre egy projektet, és ágyazd be a widgetet az ügyfél oldalába:

```html
<script src="https://<domain>/widget/tickoff-widget.js" data-token="PROJEKT_TOKEN"></script>
```

A `data-api` itt nem kell: a widget a saját script-jének origin-jét használja API-ként.

### Frissítés

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Az adatbázis-séma a backend indulásakor automatikusan frissül (Flyway). A dashboard `index.html`-je mindig frissen töltődik, a fájlnevekbe hash kerül, ezért egy új kiadás azonnal érvényesül a böngészőkben.

### Mentés és visszaállítás

```bash
scripts/backup.sh /var/backups/tickoff     # adatbázis-dump + képernyőképek (időzítsd cronnal)
```

A mentés ideiglenes fájlba készül, és csak ép állapotban kerül a helyére, hibánál nem marad töredék. **Másold a mentéseket a szerveren kívülre is**, és időnként próbáld ki a visszaállítást.

```bash
# adatbázis (a dump DROP TABLE-lel kezdi a táblákat, tehát meglévő adatra is visszaállítható; előtte érdemes leállítani a backendet)
gunzip -c db-ÉÉÉÉHHNN-ÓÓPPMM.sql.gz | docker compose -f docker-compose.prod.yml exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot tickoff'
# képernyőképek
docker compose -f docker-compose.prod.yml exec -T backend sh -c 'tar -C /data -xzf -' < screenshots-ÉÉÉÉHHNN-ÓÓPPMM.tar.gz
```

### Mi van beállítva

- **HTTPS** automatikusan (Let's Encrypt), HSTS, `nosniff`, `Referrer-Policy`; a `Server` fejléc elrejtve. A tanúsítványok kötetben vannak, újraindításkor nem vesznek el.
- **Dashboard**: szigorú Content-Security-Policy (`script-src 'self'`, nincs beágyazás: `frame-ancestors 'none'`), a hash-elt assetek `immutable` gyorsítótárral.
- **Actuator**: kívülről csak a `/actuator/health` érhető el, a többi `404`; a backend sem teszi ki a többit.
- **Kérésméret**: az `/api` kérések legfeljebb 4 MB-osak (a képernyőkép 3 MB), a nagyobbat a Caddy `413`-mal elutasítja.
- **Backend**: nem root felhasználóval fut, kíméletes leállítás (graceful shutdown: a folyamatban lévő kéréseket befejezi), a JVM a konténer memóriakorlátjához igazodik. A MySQL és a backend portja nincs kiadva.
- **Kérésszám-korlát** és a valódi kliens-IP kezelése proxy mögött: lásd a Kérésszám-korlát szakaszt.

### Amit érdemes tudni

- A widget **az ügyfél saját oldalán fut**: ha annak szigorú Content-Security-Policy-ja van, engedélyeznie kell a `<domain>` script-forrást és `connect-src`-t.
- Egy szerveren, egy példányban gondolkodik (a kérésszám-korlát memóriában él, a képernyőképek helyi köteten). Több példányhoz közös tároló (Redis, objektumtároló) kell.
- A JWT-titok cseréje mindenkit kijelentkeztet. A `MYSQL_*` jelszavakat csak úgy lehet utólag cserélni, ha az adatbázisban is átírod őket (a változó csak az első létrehozáskor érvényesül).
- Ha egy korábban rootként létrehozott `screenshots` kötetet használnál tovább, a tartalmát a nem root backendnek adni kell: `docker compose -f docker-compose.prod.yml run --rm --user root --entrypoint chown backend -R 10001:10001 /data`.

## Következő lépések

- Widget: SPA-útvonalváltás kezelése, kommentek válaszolása/szálak, a dashboardról a jelölés "megmutatása" az oldalon
- Automata integrációs tesztek (Testcontainers), a Docker-build jelenleg kihagyja a teszteket
- E-mail értesítések

## Ismert probléma

A fejlesztői Windows gépen a Java NIO `Selector.open()` hibával elszáll (`Unable to establish loopback connection`, `UnixDomainSockets.connect0: Invalid argument`), ezért a beágyazott Tomcat helyben nem indul. JDK 21 és JDK 26 alatt is reprodukálható, a temp könyvtár átirányítása nem segít. Ezért a backend a `docker-compose.yml`-ben Linux-konténerként fut, ott nincs ilyen gond.
