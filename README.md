# Tickoff

[![CI](https://github.com/sz8rozist/tickoff/actions/workflows/ci.yml/badge.svg)](https://github.com/sz8rozist/tickoff/actions/workflows/ci.yml)

Ügyfél-visszajelzések kezelése weboldal-projektekben, javítási körökre (rounds) bontva. Az ügyfél regisztráció nélkül, közvetlenül a lapon kommentel egy beágyazott widgeten keresztül (rákattint egy elemre, leírja, mit változtatna); a designer egy helyen látja a visszajelzéseket körönként, oldalanként csoportosítva, státusszal és képernyőképpel.


## Funkciók

### Bemutató oldal és belépés

- **Landing oldal** (`/`, bejelentkezés előtt): bemutatja a terméket (nyitó rész ábrával, "három lépés" a beágyazási példával, funkciók, az ügyfél szemszöge, felhívás). Külső erőforrás nélkül készült (a Caddy CSP-je ezt nem is engedné), világos és sötét témában is, mobilon is jól olvasható.
- **Belépés** (`/belepes`) és **regisztráció** (`/regisztracio`): kétoszlopos felület (bal oldalt a márka és az előnyök, jobb oldalt az űrlap), mobilon egyoszlopos. Bejelentkezve ezek a címek a dashboardra irányítanak. Az útvonalkezelés a History API-val, külön router nélkül működik; élesben a Caddy `try_files` szabálya miatt a címek frissítéskor is betöltődnek.

### Designer (dashboard)

- **Fiók**: regisztráció és belépés e-mail + jelszóval (JWT, bcrypt), a munkamenet oldalfrissítés után is megmarad. A nyilvános regisztráció éles üzemben kikapcsolható. A fiók a jelszó megadásával véglegesen törölhető (a saját projektekkel együtt). **Elfelejtett jelszó**: e-mailben kapott, egy óráig érvényes, egyszer használható linkkel új jelszó adható meg, és ilyenkor a fiók minden korábbi bejelentkezése megszűnik.
- **E-mail értesítés**: a csapat (tulajdonos és tagok) levelet kap az ügyfelektől érkező új kommentről és válaszról. Felhasználónként ki- és bekapcsolható a fejlécben lévő kapcsolóval.
- **Projektek**: létrehozás, szerkesztés, törlés (a körök, kommentek és képernyőképek is törlődnek). Minden projekthez tartozik egy megosztó token a widgethez, egy kattintással másolható, és szükség esetén **újragenerálható** (ha illetéktelenhez került; a régi token azonnal érvénytelen).
- **Áttekintés**: a projektlista tetején összesítő (nyitott, folyamatban lévő visszajelzések, lezárásra váró jóváhagyott körök), minden projektkártyán pedig a nyitott kör állapota egy sorban (nyitott / folyamatban / kész, és hogy az ügyfél jóváhagyta-e). Az összesítők két lekérdezéssel készülnek, nem projektenként, és a kommentek állapotváltásakor frissülnek.
- **Kör határideje**: a nyitott körhöz opcionális határidő adható; az ügyfél a Lista panelen látja a hátralévő időt (lejártkor pirossal). Tájékoztató jellegű, a lejárta nem zárja le a kört.
- **Javítási körök**: új kör nyitása és lezárása. Új körnél a **nem kész kommentek átvihetők** az új körbe (alapból be van jelölve), így az ügyfélnek nem kell újra beküldenie a még meg nem oldottakat; az átvitt komment az új kör kommentje lesz (a lezárt kör előzményéből kikerül), a kész kommentek a régi körben maradnak. Egyszerre egy nyitott kör van, új kört csak az előző lezárása után lehet nyitni. A köröknél látszik az összes és a nyitott kommentek száma.
- **Kommentek**: körönként listázva, **oldalanként csoportosítva**. Mindegyiknél látszik a szerző, az idő, a szöveg, az elem CSS-selectora, a viewport mérete és a böngésző/rendszer. Státusz: nyitott, folyamatban, kész.
- **Szűrés és keresés**: a kommentek szűrhetők státuszra és felelősre ("Hozzám rendelt", "Gazdátlan"), és kereshetők szövegben (szerző, komment, válaszok, oldal, felelős neve; ékezet- és kisbetű-független). Szűrés közben látszik az "X / Y komment" számláló.
- **Tevékenységnapló**: a projekt kártyáján a "Tevékenység" fül időrendben mutatja, ki mit csinált (új visszajelzés, válaszok, státuszváltás, felelős, prioritás, szerkesztés és visszavonás, elfogadás, visszanyitás, kör nyitása/lezárása/jóváhagyása, törlés), újabb elöl, 50-esével lapozva. A bejegyzés a művelettel azonos tranzakcióban születik; 180 napnál régebbi bejegyzések törlődnek (külön ütemező nélkül, rögzítés közben).
- **Kör-riport**: minden körnél a "Riport" gomb nyomtatható összefoglalót nyit új lapon (a böngészőből PDF-be menthető): a kör adatai, a jóváhagyás, az összesítés és a kommentek oldalanként, szálakkal. Alapból ügyfélnek is átadható (nincs benne prioritás, címke, felelős és CSS-selector), a "Belső riport" ezeket is tartalmazza. Minden szöveg HTML-escape-elt, a riport nem tartalmaz scriptet.
- **Prioritás és címkék**: minden kommenthez belső prioritás (sürgős, magas, normál, alacsony) és legfeljebb 5 címke adható (a szerver kisbetűsre, egyedire normalizálja). A sürgős és magas kommentek jelvényt kapnak; szűrhető címkére, rendezhető prioritás szerint, és az exportban külön oszlop. Az ügyfél nem látja.
- **Rendezés és tömeges művelet**: a kommentek rendezhetők (legrégebbi / legújabb elöl, státusz szerint, válaszok száma szerint). A kommentek kijelölhetők (egyenként vagy az összes látható egyszerre), és a kijelöltekre egy lépésben állítható a státusz vagy a felelős; a hibás elemek kijelölve maradnak az újrapróbáláshoz. A kész állapotra váltásról az e-mailt kérő ügyfelek értesítést kapnak, ahogy egyenként is.
- **Felelős**: minden komment egy csapattagra (tulajdonos vagy tag) bízható. Aki másra bíz egy kommentet, annak az illető e-mail értesítést kap (ha nem kapcsolta ki). Ha valaki kilép vagy eltávolítják, a rá bízott kommentek felelős nélkül maradnak. A CSV-exportban külön oszlop.
- **A widget nyelve**: projektenként választható magyar vagy angol. Az angol a widget teljes felületét (űrlap, jelölők, lista, jóváhagyás, hibaüzenetek, dátumok) és az ügyfélnek küldött leveleket (válasz, kész javítás, leiratkozó oldal) érinti; a csapat felülete és a csapatnak küldött levelek nyelve ettől független (lásd a Nyelv pontot). Hiányzó fordításnál a magyar szöveg jelenik meg.
- **A widget megjelenése**: a tulajdonos a projekt menüjében beállíthatja a widget márkaszínét (a gomb és a kiemelések színe) és a gombok oldalát (jobb vagy bal alul), élő előnézettel. A túl világos színt a szerver elutasítja (a gombokon fehér szöveg van, legalább 3:1 kontraszt kell). A beállítás a widget indulásakor töltődik be, nincs szükség új beágyazásra.
- **Archiválás**: a lezárt projekt archiválható (a tulajdonos a projekt menüjében): eltűnik a listából és az összesítőből (egy kapcsolóval megjeleníthető), a widgetje leáll (az ügyfél nem lát és nem küld semmit), az adatok megmaradnak, és bármikor visszaállítható.
- **Összefoglaló e-mail**: a fiók menüből kérhető napi (minden reggel 8-kor) vagy heti (hétfőn) összefoglaló a projektekről: nyitott és folyamatban lévő visszajelzések, az új kommentek az előző levél óta, jóváhagyott körök, határidők. Csak akkor megy levél, ha van mit mondani; az archivált projektek kimaradnak; SMTP nélkül nem működik. Az időzóna a `tickoff.export-zone` (alapból Europe/Budapest).
- **Kétlépcsős belépés (TOTP)**: a fiók menüből bekapcsolható hitelesítő alkalmazással (Google Authenticator, Authy, 1Password stb.): QR-kód beolvasása, majd a 6 jegyű kód megerősítése. Bekapcsolás után belépéskor a jelszó mellett a kód is kell. 8 egyszeri **helyreállító kód** készül (csak a hash-ük tárolódik), ha elvész a telefon. Egy kód csak egyszer használható (visszajátszás ellen), a találgatást IP- és fiókonkénti korlát védi. Kikapcsolás a jelszóval és egy kóddal.
- **API-kulcsok és nyilvános API**: a fiók menüből API-kulcs hozható létre (legfeljebb 10; a teljes kulcs csak létrehozáskor látható, az adatbázisban csak a hash-e van). A kulccsal (`Authorization: Bearer tk_…`) **csak olvasható** végpontok érhetők el az `/api/v1` alatt (lásd az API szakaszt); a kulcs a tulajdonos jogaival dolgozik, és csak itt fogadható el. A lista mutatja az utolsó használat idejét; bármikor törölhető.
- **Téma**: a fiók menüből automatikus (a rendszer beállítását követi), világos vagy sötét téma választható.
- **Webhook (Slack, Discord, saját fogadó)**: a tulajdonos a projekt menüjében megadhat egy webhook-címet; ide érkezik az új visszajelzés, az ügyfél válasza, az újranyitás és a kör jóváhagyása. A tartalom Slack és Discord bejövő webhookjával közvetlenül működik (`text` és `content` mező), saját fogadónak strukturált JSON (`event`, `project`, `comment`, `round`) és `X-Tickoff-Signature: sha256=…` HMAC-aláírás jár. A "Teszt küldése" gomb azonnal kipróbálja. A cím és a titok csak a tulajdonosnak látszik.
- **Képernyőképek**: a komment képernyőképe megnyitható a dashboardon (a kiválasztott elem kiemelve).
- **Kommentszálak**: a designer válaszolhat a kommentekre (a válasz a widgetben is megjelenik, "csapat" jelvénnyel), és törölheti a válaszokat (két kattintással, véletlen törlés ellen). Az ügyfél válaszai is itt jelennek meg.
- **Komment törlése** (a képernyőképével és a válaszaival együtt) megerősítéssel.
- **Csapatmunka**: a tulajdonos meghívhatja a kollégáit e-mail-cím alapján. Ha a címhez van **megerősített** fiók, azonnal tag lesz; ha még nincs (vagy nincs megerősítve), **függő meghívó** és levél megy, és a regisztráció + e-mail-megerősítés után a kolléga automatikusan csatlakozik (a függő meghívók a Tagok fülön látszanak és visszavonhatók, projektenként legfeljebb 20). A tagok a visszajelzéseket kezelhetik (körök, kommentek, válaszok, export), de a projekt beállításait, a tokent és a tagokat nem; kiléphetnek a projektből. A tulajdonos a projektet **átadhatja** egy tagnak (a régi tulajdonos tag marad). A projektlistán megjelölve látszik, melyik projektben vagy tag, és ki a tulajdonosa.
- **Megtekintő szerepkör**: a meghívásnál a kolléga **tag** (kezelheti a visszajelzéseket) vagy **megtekintő** (mindent lát, de semmit nem módosíthat; csak a saját kilépése engedett) lehet. A megtekintő módosító kérésére a szerver 403-at ad, a felületen a kezelőelemek le vannak tiltva. A szerepkör a függő meghívóban is megmarad, és a regisztráció + megerősítés után lép életbe.
- **Belső megjegyzések és @említések**: a szálba a csapat **belső megjegyzést** is írhat, amelyet az ügyfél sehol nem lát (widget, nyilvános API, ügyfél-riport, értesítések), és nem kap róla levelet. A válaszban `@Teljes Név` megemlíti a csapattagot, aki e-mail értesítést kap (ha nem kapcsolta ki); a beszúrást gombok segítik. A belső riport és az export tartalmazza a belső megjegyzéseket, jelölve.
- **Hibajegy-követő (GitHub, Linear, Jira, bármi)**: a tulajdonos a projekt menüjében megad egy https URL-sablont a {title}, {body}, {url} helyőrzőkkel (pl. GitHubnál `https://github.com/szervezet/repo/issues/new?title={title}&body={body}`). A kommenteken megjelenik a **Hibajegy létrehozása** gomb, amely az előtöltött új-hibajegy oldalt nyitja meg. Nincs tárolt kulcs és nincs kimenő kérés: a böngésző nyitja meg a kitöltött címet.
- **Összefoglaló az ügyfélnek a kör lezárásakor**: a kör lezárásakor minden megerősített e-mail-címre egyetlen levél megy az ügyfél saját visszajelzéseiről (mi lett kész, mi nem). A leiratkozás az ügyfél minden visszajelzésére érvényes a projektben.
- **Widget jelszó**: a tulajdonos jelszóval védheti a widgetet. Védett projektnél az ügyfélnek előbb meg kell adnia a jelszót (12 órás hozzáférési tokent kap), addig a widget semmit nem mutat belőle, és minden widget-végpont 401-et ad. A jelszó csak hash-ként tárolódik; csere vagy törlés érvényteleníti a kiadott tokeneket. A találgatást IP- és tokenkorlát fékezi.
- **Export CSV-be**: egy kör vagy a teljes projekt kommentjei, magyar Excelben helyesen megnyíló formátumban (ékezetek, pontosvessző).
- **Nyelv**: a felület magyarul és angolul is használható (Beállítások, vagy a belépő oldal jobb felső sarkában). A választás a fiókhoz mentődik, így minden eszközön ugyanaz; a fiók **e-mailjei** is ezen a nyelven mennek (új visszajelzés, válasz, újranyitás, jóváhagyás, felelős kijelölése, összefoglaló, megerősítő és jelszó-visszaállító levél). Regisztrációkor a belépő oldalon éppen kiválasztott nyelv lesz a fiók nyelve. A szövegek magyar forrásszöveggel vannak a kódban (`t('…')`), az angol szótár a `web/src/ui/i18n-en.ts`; ami nincs lefordítva, magyarul marad. A bemutató oldal (landing) egyelőre csak magyar.
- Világos és sötét téma.

### Ügyfél (widget)

- **Beágyazás** egyetlen `<script>` címkével, regisztráció és telepítés nélkül; a widget Shadow DOM-ban fut, nem zavarja az oldal stílusait (~28,7 KB gzip).
- **Elemkiválasztás**: a gomb elindítja a kiválasztást, az egér alatti elem keretet kap, kattintásra kiválasztódik (Esc: mégse). **Területkijelölés**: egérrel téglalapot is lehet húzni (képnél, elrendezési hibánál pontosabb); a terület a legkisebb, egészében tartalmazó elemhez kötődik (a mérete az elem méretének százaléka), a képernyőképen és a megnyitott kommentnél szaggatott kerettel látszik, a dashboardon "kijelölt terület" jelvény jelzi. A widget a kattintást elnyeli, az oldal saját kezelője nem fut le.
- **Visszajelzés-űrlap**: név (megjegyzi a böngésző) és szöveg, opcionális képernyőkép.
- **Képernyőkép** a látható nézetről, a kiválasztott elem piros-fehér kerettel kiemelve. Ha nem sikerül elkészíteni, a komment akkor is elmegy, és az ügyfél jelzést kap.
- **Jelölések**: a már beküldött kommentek számozott jelölésként látszanak az oldalon (színük a státuszt mutatja), kattintásra megnyílik a szövegük és a hozzájuk tartozó **szál**. Követik az elemet, ha az elrendezés változik (pl. mobil nézetben).
- **Single-page alkalmazások**: a widget észleli az útvonalváltást (`pushState`/`replaceState`, böngésző vissza/előre, hash-útvonal), és az új "oldal" kommentjeit tölti be. A félbehagyott kommentelést megszakítja, a komment mindig azzal az oldallal kerül mentésre, amelyiken az ügyfél éppen van.
- **Megnyitás az oldalon** (a dashboardról): a komment mellett a gomb az ügyfél oldalát nyitja meg, ahol a widget a komment elemére görget, pulzáló kerettel kiemeli, és megnyitja a szálát.
- **Válasz a kommentre**: a kártyából az ügyfél is válaszolhat (név + szöveg), a csapat válaszai "csapat" jelvénnyel látszanak. Csak a nyitott kör kommentjeire lehet válaszolni.
- **Szerkesztés és visszavonás**: a saját, nemrég küldött kommentet az ügyfél **10 percig** módosíthatja vagy visszavonhatja (törölheti), fiók nélkül. A jogosultságot egy véletlen szerkesztési titok adja, amelyet a widget csak a komment létrehozásakor kap meg és a böngészőben őriz (az adatbázisban csak az SHA-256 hash-e van). Szerkeszteni csak nyitott kommentet lehet, visszavonni csak akkor, ha még nem válaszolt rá senki. A dashboardon a módosított komment "szerkesztve" jelvényt kap.
- **Képek csatolása**: az űrlapon legfeljebb 5 kép (PNG, JPEG, GIF, WebP, egyenként max. 3 MB) csatolható a kommenthez; a csapat a dashboardon a "Mellékletek" gombbal nézi meg őket.
- **Összes visszajelzés (Lista)**: a gomb mellett látszó "Lista" panel oldalak szerint csoportosítva mutatja a nyitott kör összes kommentjét állapottal; egy elemre kattintva a widget odaugrik (másik oldalra mélylinkkel tölt át).
- **Korábbi körök**: a panel második füle a lezárt köröket mutatja (a legutóbbi 10-et), csak olvasásra: kommentek, állapotuk és az utolsó válasz.
- **Elfogadás és visszanyitás**: a "Kész" kommentnél az ügyfél elfogadhatja a javítást, vagy visszanyithatja rövid indoklással (az indoklás a szálba kerül, és a csapat értesítést kap).
- **Oldal jóváhagyása**: ha egy oldal minden visszajelzése kész, az ügyfél az oldalt külön is jóváhagyhatja a Lista panelen, a teljes kör előtt. Új komment az oldalon vagy egy nem kész státusz érvényteleníti az oldal jóváhagyását; a dashboard az oldal fejlécén jelzi.
- **Kör jóváhagyása**: ha a nyitott kör minden kommentje kész, az ügyfél jóváhagyhatja a kört (a csapat levelet kap, a dashboardon "az ügyfél jóváhagyta" jelvény látszik). Új vagy újranyitott komment érvényteleníti a jóváhagyást.
- **E-mail értesítés az ügyfélnek**: az űrlapon megadható (nem kötelező) e-mail-cím. Ha a csapat válaszol, vagy késznek jelöli a kommentet, az ügyfél levelet kap a kommentre mutató linkkel és leiratkozó linkkel. A címet a widget API sosem adja vissza.
- Ha nincs nyitott kör, az ügyfél tájékoztató üzenetet kap. Rossz token vagy origin esetén a widget a vendégoldalon nem jelenik meg.
- **Mobil és érintés**: a kijelölés pointer-eseményekkel működik (egér, ujj, toll): koppintás egy elemre, ujjal húzott téglalap egy területre (kijelölés közben az oldal nem görgethető, a Mégse gomb kilép). Érintőképernyőn nagyobb jelölők és gombok, a beviteli mezők 16 px-esek (az iOS nem nagyít rájuk), a gombok követik a biztonságos területet (`safe-area-inset`). A widget minden hibaesetre magyar üzenetet ad (pl. túl sok kérés).

### Biztonság és működés

- **Token + origin-ellenőrzés**: a widget csak azon az origin-en működik, amit a projektnél megadtál; a CORS-fejléceket is csak erre adjuk, tokenenként feloldva.
- **Hozzáférés-védelem**: a designer csak a saját és a hozzá meghívott projekteket éri el (idegen erőforrásra `404`; a tag az owner-only műveletekre `403`-at kap), a képernyőképek JWT-vel védettek, a feltöltés típusát és méretét ellenőrizzük (PNG/JPEG, max. 3 MB, a fájl tartalmát is).
- **Kérésszám-korlát** a widget és a belépés/regisztráció végpontjain (komment-spam, jelszó-találgatás, preflight-árasztás ellen).
- **Production stack**: Docker Compose, Caddy automatikus HTTPS-sel, szigorú CSP és biztonsági fejlécek, titkok nélkül nem induló konfiguráció, nem root alkalmazás-konténer, mentő szkript.
- **CI**: GitHub Actions minden pushnál és pull requestnél: widget és alkalmazás típusellenőrzése és build, Docker image és compose-fájlok ellenőrzése.

### Még nincs meg

- Éles levélküldés (Brevo): az SMTP-beállítás és a feladó igazolása még hátra van, addig a levelek csak a fejlesztői Mailpitbe mennek.
- A bemutató oldal (landing) csak magyarul érhető el; a szerver néhány hibaüzenete (pl. az API `detail` mezője) magyar.

## Felépítés

| Hely | Tartalom |
|---|---|
| `web/` | A Tickoff alkalmazás: **Next.js 16** (App Router, Node szerver), TypeScript, **Drizzle ORM** + **MySQL 8.4**, a felület React 19 + [Mantine](https://mantine.dev) 9 |
| `web/src/app/api/` | Az API végpontjai (route handlerek): auth, fiók, projektek, tagok, körök, kommentek, widget API, nyilvános `/api/v1` |
| `web/src/lib/` | Az üzleti logika: hozzáférés, JWT, jelszavak, TOTP, e-mail, webhook (SSRF-védelemmel), összefoglaló, riport, CSV, kérésszám-korlát |
| `web/src/db/`, `web/drizzle/` | Séma, kapcsolat, migrációk futtatója és maguk a migrációk |
| `web/src/ui/` | A felület (landing, belépés, dashboard), kliens oldalon renderelve |
| `web/src/proxy.ts` | Kérésenként nonce-os, szigorú Content-Security-Policy (production) |
| `web/src/instrumentation.ts` | Induláskor elindítja az ütemezőt (összefoglaló e-mailek reggel 8-kor) |
| `widget/` | Beágyazható widget: React-szintaxis, buildkor Preactre aliasolva, Shadow DOM, egyetlen IIFE fájl; az alkalmazás a `/widget/tickoff-widget.js` alatt szolgálja ki |
| `docker-compose.yml` | Fejlesztői szolgáltatások: MySQL (port: `3308`) és a Mailpit levelezés-csapda |
| `web/Dockerfile`, `docker-compose.prod.yml`, `deploy/`, `.env.example` | Production stack: MySQL, az alkalmazás, Caddy (HTTPS), lásd az Üzemeltetés szakaszt |
| `scripts/backup.sh` | Mentés az éles stackről |

## Indítás

```bash
# 1) MySQL (3308) + Mailpit levelezés-csapda (http://127.0.0.1:8025, SMTP: 127.0.0.1:1025).
#    A Mailpit elkapja az alkalmazás összes levelét, valódi címzettnek semmi nem megy el.
docker compose up -d

# 2) Függőségek (a gyökérben a widgeté), majd az alkalmazás
npm install
cd web
cp .env.example .env.local                # DATABASE_URL, SMTP_HOST=127.0.0.1 stb.
npm install
npm run db:migrate                        # az adatbázis-séma létrehozása
npm run build:widget                      # a widget lefordítása és a /widget/tickoff-widget.js alá másolása (a gyökér npm install után)
npm run dev                               # http://localhost:3000

# 3) Widget demo oldal (http://localhost:5174/?token=PROJEKT_TOKEN), a gyökérből
npm run dev:widget
```

Ellenőrzés: `npm run typecheck` és `npm run build` a `web/` mappában. Séma-módosítás után: `npm run db:generate` (új migráció a `drizzle/` mappába), majd `npm run db:migrate`.

A widget kipróbálásához a projekt oldalának címe a dashboardon `http://localhost:5174` legyen, mert a CORS és az origin-ellenőrzés ehhez köti a kéréseket.


## Widget beágyazása

```html
<script src="https://…/tickoff-widget.js" data-token="PROJEKT_TOKEN" data-api="https://api.pelda.hu"></script>
```

A `data-api` elhagyható, ilyenkor a script saját origin-je az API címe. A widget a projekt megosztó tokenjével dolgozik, és csak azon az oldalon működik, amelynek origin-je (séma + host + port) egyezik a projektnél megadottal. Rossz token vagy origin esetén a widget nem jelenik meg, a vendégoldalon nincs hibaüzenet, csak egy figyelmeztetés a böngésző konzoljában.

**Az ügyfél oldaláról nézve:**

1. A jobb alsó **Visszajelzés** gomb elindítja az elemkiválasztást: az egér alatti elem keretet kap, kattintásra kiválasztódik (Esc: mégse). A kattintást a widget elnyeli, az oldal saját kattintás-kezelője nem fut le.
2. Egy űrlapon megadja a nevét (a böngésző megjegyzi) és a szöveget, opcionálisan képernyőképet csatol (Ctrl+Enter: küldés).
3. A kommentek számozott **jelölésként** látszanak az oldalon (piros: nyitott, narancs: folyamatban, zöld: kész), kattintásra megnyílik a szövegük és a szálban a válaszok, ahová az ügyfél is írhat. A jelölések követik az elemet, ha az elrendezés megváltozik (pl. mobil nézetben).

**Mit rögzít a komment:** az elem egyedi CSS-selectorát (a lehető legrövidebbet, `#id`-t preferálva), a kattintás helyét az elem méretének százalékában (`posX`/`posY`, 0–100), az oldal URL-jét (`origin + útvonal + query`), a viewport méretét, a user agentet (szerveroldalon a fejlécből) és a képernyőképet. A képernyőkép a látható nézet piros-fehér kerettel kiemelt elemmel; a widget saját felülete nincs rajta.

**Korlátok:**

- A jelölések csak a **nyitott kör** kommentjeit mutatják, lezárt körnél nincs jelölés és nem lehet újat küldeni (az ügyfél tájékoztató üzenetet kap).
- Az oldal URL-jébe a query is bekerül, ezért ne legyen titok az URL-ben (pl. token, jelszó-visszaállító kód).
- **Mi számít "oldalnak"** (az URL, amihez a kommentet kötjük): `origin + útvonal + query`. A hash csak akkor számít bele, ha útvonalnak látszik (`#/…` vagy `#!/…`): a hash-alapú single-page alkalmazásokban az különbözteti meg az oldalakat. A sima horgonyokat (`#kapcsolat`) figyelmen kívül hagyjuk, hogy az oldalon belüli ugrás ne számítson új oldalnak. Ha a saját útvonalozásod más módon különbözteti meg az oldalakat (pl. csak `localStorage`-ban vagy állapotban tárolja), a widget nem tudja megkülönböztetni őket.
- A widget a navigációt a `history.pushState`/`replaceState` becsomagolásával figyeli (az eredetit változatlanul meghívja). Ha az oldal más könyvtára is csomagolja ezeket, a kettő egymás mellett működik.
- **Mélylink**: `?tickoff-comment=<id>` az oldal URL-je mögött. A widget betöltéskor kiolvassa, és azonnal eltávolítja a címsorból (nem marad az előzményekben, és nem kerül új kommentek URL-jébe). Csak a nyitott kör kommentjeire működik: lezárt körnél, törölt kommentnél vagy más oldal kommentjénél a widget tájékoztató üzenetet ad. Ha az oldal az elemeket késve rajzolja ki, a widget néhány másodpercig újrapróbálja.
- A képernyőkép a görgetést eltolással kezeli, ezért görgetett oldalon a `position: fixed` elemek (pl. rögzített fejléc) elcsúszhatnak a képen. A kép best effort: ha nem sikerül (idegen domainről érkező képek, 10 mp időtúllépés, a böngészőlap a háttérben van), a komment akkor is mentődik, és az ügyfél jelzést kap.
- A widget mérete kb. 19,3 KB gzip.

## Adatmodell

`users` → `projects` (share token) → `rounds` → `comments` (selector, pozíció, viewport, user agent, státusz, képernyőkép útvonal) → `replies`, `attachments`; mellettük `project_members`, `project_invites`, `activity`, `api_keys` és a jelszó-visszaállító / megerősítő tokenek. A séma a [web/src/db/schema.ts](web/src/db/schema.ts) fájlban van, a migrációk a `web/drizzle/` mappában.

## Auth

JWT (HS256), állapotmentes. A designerek e-mail + jelszóval regisztrálnak és lépnek be, az ügyfelek nem (nekik a projekt share tokenje elég).

| Végpont | Leírás |
|---|---|
| `POST /api/auth/register` | `{email, password (8–72), name}` → `201 {token, user}`; `409` ha már van ilyen e-mail |
| `POST /api/auth/login` | `{email, password}` → `200 {token, user}`; `401` hibás adatokra |
| `GET /api/me` | `Authorization: Bearer <token>` → az aktuális felhasználó (`notifyEmail` is) |
| `POST /api/auth/login` | `{email, password}` → `{token, user}`; bekapcsolt kétlépcsős belépésnél `{twoFactorRequired: true, challenge}` (a kihívás 5 percig érvényes, API-hívásra nem használható) |
| `POST /api/auth/login/2fa` | `{challenge, code}` → `{token, user}`; `401` hibás kódra vagy lejárt kihívásra, `429` túl sok próbálkozásra |
| `POST /api/me/2fa/setup` / `enable` / `disable` | új titok és `otpauthUri` / megerősítés kóddal (a válasz az egyszeri `recoveryCodes`) / kikapcsolás `{password, code}` |
| `PATCH /api/me/digest` | `{frequency: OFF \| DAILY \| WEEKLY}`: összefoglaló e-mail gyakorisága |
| `PATCH /api/me` | `{notifyEmail: true \| false}`: az e-mail értesítések be- és kikapcsolása |
| `POST /api/auth/forgot-password` | `{email}` → mindig `204`, akár van ilyen fiók, akár nincs (nem derül ki, kinek van fiókja). Ha van, és be van állítva SMTP, visszaállító levelet küld |
| `POST /api/auth/reset-password` | `{token, password (8–72)}` → `204`; `400`, ha a token ismeretlen, lejárt vagy már használt |
| `DELETE /api/me` | `{password}` → `204`: a fiók **és a saját projektjei** (körökkel, kommentekkel, képernyőképekkel) véglegesen törlődnek. Hibás jelszóra `403` (nem 401, hogy a kliens ne tekintse lejárt munkamenetnek) |

A jelszavak bcrypt hash-ként tárolódnak. Konfiguráció: `TICKOFF_JWT_SECRET` (legalább 32 karakter, **élesben kötelező felülírni**), `TICKOFF_JWT_TTL` (alapérték: `12h`).

## Projektek

Minden `/api/projects` végpont tokent kér. Egy projekthez két szerepkör tartozik (a hozzáférést egyetlen helyen, a `src/lib/access.ts` ellenőrzi):

| | **Tulajdonos** | **Meghívott tag** |
|---|---|---|
| Projekt megtekintése, token látása | ✓ | ✓ |
| Körök nyitása/lezárása, kommentek, státusz, válasz, komment törlése, export | ✓ | ✓ |
| Projekt szerkesztése és törlése, token újragenerálása | ✓ | ✗ (`403`) |
| Tagok meghívása és eltávolítása | ✓ | ✗ (`403`), kivéve a saját kilépés |

Aki nem tulajdonos és nem tag, annak a projekt nem létezik: minden végpont `404`-et ad (hogy a létezése se derüljön ki). A tag az owner-only műveletekre `403`-at kap, mert látja a projektet.

| Végpont | Leírás |
|---|---|
| `GET /api/projects` | saját és tagként elérhető projektek, újabb elöl; mindegyiknél `role` (`OWNER` / `MEMBER`) és `ownerName` |
| `POST /api/projects` | `{name, siteUrl (http/https)}` → `201`; automatikusan létrejön az 1. kör |
| `GET /api/projects/{id}` | egy projekt (tag is) |
| `PUT /api/projects/{id}` | név és URL módosítása (csak tulajdonos) |
| `POST /api/projects/{id}/share-token` | új megosztó token; a régi azonnal érvénytelen, a vele beágyazott widgetek leállnak (a kommentek megmaradnak) (csak tulajdonos) |
| `DELETE /api/projects/{id}` | `204`; a körök, kommentek és tagságok az adatbázisban kaszkádolva törlődnek, a képernyőképek fájljai is; a tagoknak is megszűnik (csak tulajdonos) |

### Tagok

| Végpont | Leírás |
|---|---|
| `GET /api/projects/{id}/members` | a tulajdonos (elöl) és a tagok: `{userId, name, email, role}`; a projekt minden tagja látja |
| `POST /api/projects/{id}/members` | `{email, role?: MEMBER \| VIEWER}` → `201`: meghívás **megerősített fiókra** (e-mail alapján, kis- és nagybetűre érzéketlenül). `404`, ha nincs ilyen megerősített fiók (ilyenkor a kliens a lenti függő meghívót küldi), `409`, ha már tag vagy ő a tulajdonos. Csak tulajdonos; IP-nként 20/perc, mert a válaszból a fiókok létezése kideríthető |
| `POST /api/projects/{id}/members/{userId}/transfer-ownership` | `200` + a tagok frissített listája: a projekt átadása egy **meglévő tagnak** (csak tulajdonos). Az új tulajdonos mindent megkap, a régi tag marad (a visszajelzéseket tovább kezelheti, de a beállításokat már nem). `409`, ha a célpont nem tag. A visszaadást csak az új tulajdonos kezdeményezheti |
| `DELETE /api/projects/{id}/members/{userId}` | `204`: a tulajdonos bárkit eltávolíthat, a tag csak saját magát (kilépés). A tulajdonos nem távolítható el (`409`), ha nincs rá szükség, a projektet kell törölni |

A tagság az adatbázisban a projekthez és a felhasználóhoz is kaszkádol: a tag fiókjának törlésekor a tagságai megszűnnek (a más projektekben írt válaszai megmaradnak a nevével), a tulajdonos fiókjának törlésekor a projekt a tagok számára is megszűnik.

## Körök

Egy projektnek egyszerre legfeljebb egy nyitott köre van. Új kört csak az előző lezárása után lehet nyitni (különben `409`). A sorszámot a szerver adja, a párhuzamos kéréseket az egyedi index (`project_id`, `number`) védi.

| Végpont | Leírás |
|---|---|
| `GET /api/projects/{id}/rounds` | a projekt körei sorszám szerint |
| `PUT /api/projects/{id}/rounds/{roundId}/due-date` | `{dueDate: "ÉÉÉÉ-HH-NN" \| null}`: a nyitott kör határideje; `400`, ha egy napnál régebbi, `409` lezárt körre |
| `POST /api/projects/{id}/rounds?carryOver=` | új kör nyitása → `201`; `409`, ha van nyitott kör. `carryOver=true`: az előző kör nem kész (nyitott, folyamatban lévő) kommentjei átkerülnek az új körbe |
| `POST /api/projects/{id}/rounds/{roundId}/close` | kör lezárása → `200`; `409`, ha már le van zárva |

## Kommentek (designer oldal)

A widgetből beérkezett kommentek a bejelentkezett tulajdonos számára, projekt- és kör-szinten. Más projektjére itt is `404`.

| Végpont | Leírás |
|---|---|
| `GET /api/projects/{id}/rounds/{roundId}/comments` | a kör kommentjei, minden mezővel (selector, viewport, user agent, státusz) és a `replies` szállal (időrendben) |
| `PUT /api/projects/{id}/tracker` | `{url}`: hibajegy-követő sablon (csak a tulajdonos), üres/`null` kikapcsolja; `400`, ha nem https, vagy hiányzik a `{title}` |
| `PUT /api/projects/{id}/widget-access` | `{password (4–72) \| null}`: a widget jelszavas védelme (csak a tulajdonos) |
| `GET /api/projects/{id}/rounds/{roundId}/page-approvals` | az ügyfél által oldalanként jóváhagyott oldalak |
| `POST /api/projects/{id}/comments/{commentId}/replies` | `{body (max. 4000), internal?: boolean}` → `201`: válasz a designer nevében (lezárt kör kommentjére is). Egy kommenthez legfeljebb 200 válasz fűzhető, utána `409` |
| `DELETE /api/projects/{id}/comments/{commentId}/replies/{replyId}` | `204` |
| `PATCH /api/projects/{id}/comments/{commentId}` | `{status: OPEN \| IN_PROGRESS \| DONE}`; érvénytelen értékre `400` |
| `GET /api/projects/{id}/members/invites` | a függő meghívók (csak a tulajdonos) |
| `POST /api/projects/{id}/members/invites` | `{email}` → `201`: meghívó még nem megerősítetten regisztrált kollégának (levelet kap). `503`, ha nincs e-mail-küldés beállítva; `409`, ha már meghívták / tag, vagy 20 függő meghívó van; IP-nként 20/perc |
| `DELETE /api/projects/{id}/members/invites/{inviteId}` | `204`: a meghívó visszavonása |
| `PUT /api/projects/{id}/widget-appearance` | `{color: "#rrggbb" \| null, position: RIGHT \| LEFT, lang: hu \| en}`: a widget megjelenése és nyelve (csak a tulajdonos); `400` érvénytelen vagy túl világos színre |
| `PUT /api/projects/{id}/archive` | `{archived: true \| false}`: archiválás / visszaállítás (csak a tulajdonos). Archivált projektnél a widget végpontjai `404`-et adnak |
| `PUT /api/projects/{id}/webhook` | `{url}`: webhook beállítása (csak a tulajdonos), üres/`null` kikapcsolja; `400`, ha a cím nem nyilvános https-cím |
| `POST /api/projects/{id}/webhook/test` | teszt-üzenet a webhookra → `{ok, status, error}`; `409`, ha nincs beállítva; IP-nként 5/perc |
| `GET /api/projects/{id}/rounds/{roundId}/report?internal=` | nyomtatható HTML-riport a körről (`internal=true`: belső változat); a dashboard JWT-vel kéri le és blobként nyitja meg |
| `GET /api/projects/{id}/activity?before=` | a tevékenységnapló (újabb elöl, 50 bejegyzés; a `before` az utolsó kapott azonosító) |
| `PUT /api/projects/{id}/comments/{commentId}/triage` | `{priority: LOW \| NORMAL \| HIGH \| URGENT, labels: [..]}`: belső prioritás és címkék |
| `PUT /api/projects/{id}/comments/{commentId}/assignee` | `{userId}`: felelős kijelölése, `null` törli. `400`, ha a felhasználó nem a projekt csapatának tagja |
| `GET /api/projects/{id}/comments/{commentId}/attachments/{attachmentId}` | a melléklet képe; `404`, ha nincs. A komment listaelemében az `attachments` tömb tartalmazza az azonosítókat |
| `GET /api/projects/{id}/comments/{commentId}/screenshot` | a képernyőkép (PNG/JPEG); `404`, ha nincs |
| `DELETE /api/projects/{id}/comments/{commentId}` | `204`; a képernyőkép fájlja is törlődik |
| `GET /api/projects/{id}/comments/export[?roundId=]` | CSV a projekt (vagy egy kör) kommentjeiről: pontosvessző, UTF-8 BOM (magyar Excelhez), a cellák védettek a CSV-injection ellen (az `=`, `+`, `-`, `@` kezdetű szöveg elé aposztróf kerül), az időpontok budapesti idő szerint (`TICKOFF_EXPORT_ZONE`-nal állítható); a "Válaszok" oszlopban a szál egy cellában, soronként "Név (csapat): szöveg" |

A körlistában minden körnél ott van a `commentCount` és az `openCommentCount`. A képernyőképet JWT védi, ezért a dashboard fejléccel kéri le, és `blob:` URL-ként jeleníti meg (nem `<img src>`-vel). A dashboardon a kommentek oldalanként (`pageUrl`) csoportosítva látszanak.

## Nyilvános API (API-kulccsal)

Csak olvasható, a kulcs tulajdonosának projektjeire. Hitelesítés: `Authorization: Bearer tk_…` (kulcsot a dashboard fiók menüjében lehet létrehozni). Érvénytelen kulcsra `401`, nem hozzáférő projektre `404`; IP-nként 60 kérés/perc.

| Végpont | Leírás |
|---|---|
| `GET /api/v1/projects` | a kulcs tulajdonosának projektjei: `id`, `name`, `siteUrl`, `archived`, `createdAt` |
| `GET /api/v1/projects/{id}/comments?status=&round=&limit=&offset=` | a projekt kommentjei (kör és idő szerint): szerző, szöveg, oldal, selector, státusz, prioritás, címkék, felelős neve, ügyfél-elfogadás, válaszok száma. Szűrhető `status` (`OPEN`, `IN_PROGRESS`, `DONE`) és `round` (kör száma) szerint; `limit` alapból 200, legfeljebb 500 |

A válasz nem tartalmaz ügyfél-e-mailt, megosztó tokent és webhook-adatot.

```bash
curl -H "Authorization: Bearer tk_…" https://app.pelda.hu/api/v1/projects
```

A kulcsok kezelése (`GET`/`POST`/`DELETE /api/me/api-keys`) csak bejelentkezéssel (JWT) érhető el, API-kulccsal nem.

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
| `POST /api/widget/{token}/comments/{id}/replies` | `{authorName, body}` → `201`: az ügyfél válasza. `409`, ha nincs nyitott kör, ha a komment lezárt körhöz tartozik, vagy ha a szál betelt (200 válasz). A `GET .../comments` válasza a `replies` szálat is tartalmazza |
| `POST /api/widget/{token}/comments/{id}/attachments` | melléklet: nyers kép a törzsben (PNG/JPEG/GIF/WebP, max. 3 MB) → `201`; `409`, ha lezárt körhöz tartozik vagy már van 5 melléklete; `413` túl nagy; `400`, ha a tartalom nem támogatott kép (a típust az első bájtok döntik el, az SVG nem engedélyezett) |
| `POST /api/widget/{token}/comments/{id}/edit` | `{body, editToken}`: a saját komment szövegének módosítása a létrehozás utáni 10 percben → `200`; `403` rossz titok, `409` lejárt határidő vagy nem nyitott komment |
| `POST /api/widget/{token}/comments/{id}/withdraw` | `{editToken}`: a saját komment törlése ugyanazzal a határidővel → `204`; `409`, ha már válaszoltak rá |
| `GET /api/widget/{token}/history` | a lezárt körök (a legutóbbi 10, legújabb elöl) kommentjei szálastul, csak olvasásra |
| `POST /api/widget/{token}/comments/{id}/approve` | az ügyfél elfogadja a "Kész" kommentet → `200`; `409`, ha nem kész vagy lezárt körhöz tartozik |
| `POST /api/widget/{token}/comments/{id}/reopen` | `{authorName, reason?}`: a "Kész" komment visszanyitása, a szálba "Visszanyitva: …" bejegyzés kerül, a csapat értesítést kap → `200`; `409` ugyanúgy |
| `POST /api/widget/{token}/page/approve` | `{authorName, pageUrl}`: egy oldal jóváhagyása a nyitott körben → `200` (a kör adata az `approvedPages` listával); `409`, ha az oldalnak nincs kommentje vagy van nem kész |
| `POST /api/widget/{token}/unlock` | `{password}`: jelszóval védett widget feloldása → `{accessToken}`; `403` hibás jelszóra, `429` találgatásra. A token az `X-Tickoff-Access` fejlécben megy a többi kérésre; a `GET /project` védett, fel nem oldott projektnél `locked: true`-val csak a megjelenés adatait adja |
| `POST /api/widget/{token}/round/approve` | `{authorName}`: a nyitott kör jóváhagyása → `200`; `409`, ha nincs komment vagy van nem kész |
| `POST /api/widget/{token}/comments/{id}/screenshot` | képernyőkép: nyers `image/png` vagy `image/jpeg` a törzsben, max. 3 MB → `204`; `413` túl nagy, `415` rossz típus, `400` ha a tartalom nem kép (a fájl első bájtjait ellenőrizzük), `409` ha már van képe |

Komment törzse: `{authorName, body, pageUrl, cssSelector?, posX?, posY?, areaWidth?, areaHeight?, viewportWidth?, viewportHeight?, customerEmail?}`. A user agentet a szerver a fejlécből veszi.

A komment létrehozásának válasza tartalmazza az `editToken` és `editableUntil` mezőt (csak ott, a listákban nem).

A képernyőképek a `TICKOFF_STORAGE_DIR` könyvtárban vannak (Dockerben a `screenshots` kötet), az adatbázisban csak a relatív útvonal.

## E-mail

Az alkalmazás két célra küld levelet: **jelszó-visszaállítás** és **értesítés** az ügyfelektől érkező új kommentről és válaszról (a csapat minden olyan tagjának, aki nem kapcsolta ki). A levelek egyszerű szöveges üzenetek.

**Beállítás** (környezeti változók, éles üzemben a `.env`-ben): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_STARTTLS`, `TICKOFF_MAIL_FROM`. **`SMTP_HOST` nélkül a levelek nem mennek el** (induláskor figyelmeztetés van a naplóban): az elfelejtett jelszó nem állítható vissza, és nincs értesítés. Fejlesztéskor a `docker compose` Mailpit-et indít, amely minden levelet elkap, és a http://127.0.0.1:8025 címen mutatja.

**Jelszó-visszaállítás:**

- A link tokenje véletlen (256 bit), az adatbázisban **csak az SHA-256 hash-e** van, egy óráig érvényes, és egyszer használható. Újabb kérés érvényteleníti a korábbi linkeket.
- A kérés válasza mindig ugyanaz (`204`): nem derül ki, hogy létezik-e a fiók. Fiókonként óránként legfeljebb 3 levél megy (levélbombázás ellen), IP-nként 5 kérés/perc.
- A dashboard a tokent azonnal eltávolítja a címsorból (előzmények, Referer, megosztott képernyő ellen).
- Sikeres visszaállítás után a fiók **minden korábbi bejelentkezése érvénytelen** (minden kérésnél ellenőrzi az alkalmazás, hogy a token a jelszócsere előtt készült-e). Ez a törölt felhasználók tokenjeire is igaz.

**Értesítések:** a levél a komment mentésének sikeres lezárása után megy el, külön szálon (a widget kérése nem vár az SMTP-szerverre, és annak hibája nem bukatja el), a sor korlátos. Címzettenként legfeljebb 10 levél egyszerre, utána percenként 1, így egy támadó sem tudja a csapat postafiókját és az SMTP-hírnevet elárasztani. A tárgy sortörés-mentesített (a projektnév nem injektálhat levélfejlécet).

**Értesítések az ügyfélnek:** ha az ügyfél megadta az e-mail-címét a komment beküldésekor, a csapat válaszáról és a "Kész" állapotról levelet kap. A levélben a kommentre mutató mélylink és egy leiratkozó link van (`/api/notifications/unsubscribe/{token}`, 128 bites titok, IP-nként korlátozva); a leiratkozás törli a címet. A cím a kommenthez tartozik, nem fiókhoz, és csak a levélküldéshez használjuk. Címenként ugyanaz a korlát él, mint a csapat tagjainál (10 egyszerre, utána percenként 1). **Az ügyfél címét meg kell erősíteni**: a komment beküldésekor megerősítő levél megy (`/api/notifications/confirm/{token}`), és értesítés csak a megerősítés után érkezik. A link megnyitása csak egy oldalt mutat, a megerősítést a gomb (POST) végzi, így a levélkezelők előolvasása nem erősíti meg a címet. Aki valaki más címét adja meg, az a címzettnek legfeljebb egy megerősítő levelet küld (címenként korlátozva), további levél nem megy, amíg ő nem erősít. A migráció előtti, címmel rendelkező kommentek megerősítettnek számítanak. SMTP nélkül nincs megerősítés, így értesítés sem.

## Webhook

Események: `comment.created`, `reply.created` (ügyfél-válasz), `comment.reopened`, `round.approved`, `test`. A kérés `POST`, `Content-Type: application/json`, fejlécei: `X-Tickoff-Event`, `X-Tickoff-Signature` (`sha256=` + a nyers törzs HMAC-SHA256-ja a projekt titkával), `User-Agent: Tickoff-Webhook`. A küldés a mentés után, a háttérben történik. **Átmeneti hibánál** (nincs válasz, időtúllépés, `408`, `429`, `5xx`) a rendszer 10 mp, 1 perc és 5 perc múlva újrapróbálja (összesen 4 kísérlet); végleges hibánál (más `4xx`, érvénytelen cím) nem. A végeredmény a **kézbesítési naplóba** kerül (`webhook_deliveries`, 30 napig őrzi), a tulajdonos a webhook-ablakban látja a legutóbbi 20-at (`GET /api/projects/{id}/webhook/deliveries`). A várakozó újrapróbálkozások a folyamat memóriájában élnek, újraindításkor elvesznek (a naplóba ilyenkor nem kerül bejegyzés), ezért a webhook továbbra is legjobb szándékú értesítés. A címet nem naplózzuk: abban titok lehet. Fogadóként számíts arra, hogy ugyanaz az esemény többször is megérkezhet.

**Biztonság (SSRF):** a szerver a felhasználó által megadott címre küld kérést, ezért a cím csak **nyilvános https-cím** lehet, nem tartalmazhat felhasználónevet, és a név minden feloldott címe nyilvános kell legyen (nem loopback, privát, link-local, CGNAT, többesküldéses, IPv6 egyedi helyi). Az ellenőrzés mentéskor és minden küldés előtt újra lefut, a küldő nem követ átirányítást, a kapcsolat és a válasz ideje korlátos, a válasz törzsét nem olvassuk. Fejlesztéshez a `TICKOFF_WEBHOOK_ALLOW_PRIVATE=true` engedélyezi a helyi http-címeket (a dev `docker-compose.yml`-ben be van kapcsolva, élesben nem szabad). Ismert korlát: a feloldás és a kapcsolódás között a DNS elméletileg megváltozhat (DNS-rebinding), ezt a küldés előtti újraellenőrzés csökkenti, de nem zárja ki teljesen; magasabb biztonsági igénynél kimenő proxy mögé érdemes tenni.

## E-mail-megerősítés

Regisztrációkor a fiók megerősítetlen, és levelet kap egy egyszer használatos linkkel (24 óráig érvényes, a token csak hash-ként van tárolva, újabb kérés lecseréli, percenként legfeljebb egy levél megy). A dashboard fent figyelmeztet és újraküldést kínál (`POST /api/me/verification`); a link beváltása `POST /api/auth/verify-email` (`400` érvénytelen vagy lejárt tokenre). **Megerősítés nélkül a fiókra szóló meghívók nem lépnek életbe**, mert különben bárki bejuthatna egy projektbe egy másik címmel regisztrálva. A meglévő fiókokat a migráció megerősítettnek jelöli. **SMTP nélkül** a megerősítés nem lehetséges, ezért ilyenkor a fiók azonnal megbízható (senki nem reked ki), de a függő meghívók sem küldhetők (`503`).

## Kérésszám-korlát

A visszaélések ellen (komment-spam, jelszó-találgatás, preflight-árasztás) az alkalmazás memóriabeli **token bucket** korlátozót használ (`src/lib/rate-limit.ts`). Túllépéskor `429 Too Many Requests` jön `Retry-After` fejléccel (másodpercben, mikor lesz újra token).

| Mire | Kulcs | Kapacitás / feltöltés |
|---|---|---|
| Widget írás (komment + képernyőkép + válasz, közös keret) | IP | 20 / 20 percenként |
| | token | 120 / 120 percenként |
| Widget olvasás (`GET /api/widget/{token}/**`) | IP | 60 / 120 percenként |
| | token | 120 / 600 percenként |
| Widget összes kérése, **a preflightot is** beleértve | IP | 200 / 300 percenként |
| `POST /api/auth/login` | IP | 10 / 10 percenként |
| `POST /api/auth/register` | IP | 5 / 5 percenként |
| `POST /api/auth/forgot-password` | IP | 5 / 5 percenként (fiókonként ezen felül óránként legfeljebb 3 levél) |
| `POST /api/auth/reset-password` | IP | 10 / 10 percenként |
| `DELETE /api/me` (fiók törlése, jelszót kér) | IP | 5 / 5 percenként |
| `POST /api/projects/{id}/members` (tag meghívása) | IP | 20 / 20 percenként |

A korlát memóriában él, a kulcsok száma korlátos. Kikapcsolás: `TICKOFF_RATE_LIMIT_ENABLED=false`. A widget a `429`-es válaszra barátságos üzenetet mutat.

**Üzemeltetési tudnivalók:**

- **Proxy mögött** a kliens IP-je az `X-Forwarded-For` fejlécből jön (`src/lib/http.ts`). A mellékelt Caddy a kapott kérések fejlécét felülírja, tehát a kliens által hamisított érték hatástalan; az alkalmazás portja nincs kiadva, így a proxyt nem lehet megkerülni. Saját proxynál ugyanezt biztosítsd.
- **Egy példányra** működik. Több példányos telepítésnél minden példánynak saját vödrei vannak, ezért a hatékony korlát a példányszám-szorosa; pontos korláthoz közös tároló (pl. Redis) kell.

## Beállítások (környezeti változók)

| Változó | Jelentés |
|---|---|
| `DATABASE_URL` | MySQL kapcsolat (`mysql://user:jelszó@host:3306/tickoff`) |
| `TICKOFF_JWT_SECRET` | A tokenek aláírása, legalább 32 karakter; production módban a fejlesztői alapérték nem használható |
| `TICKOFF_JWT_TTL` | A bejelentkezés érvényessége (alapból `12h`) |
| `DASHBOARD_ORIGIN` | A nyilvános cím (a levelekben szereplő linkekhez) |
| `TICKOFF_STORAGE_DIR` | A képernyőképek és mellékletek helye (Dockerben kötet) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_STARTTLS`, `TICKOFF_MAIL_FROM` | E-mail; `SMTP_HOST` nélkül nem megy levél |
| `TICKOFF_REGISTRATION_ENABLED` | Nyilvános regisztráció (alapból `true`) |
| `TICKOFF_EXPORT_ZONE` | Időzóna az exportokhoz és az összefoglaló időzítéséhez (alapból `Europe/Budapest`) |
| `TICKOFF_RATE_LIMIT_ENABLED` | A kérésszám-korlát (alapból be van kapcsolva) |
| `TICKOFF_WEBHOOK_ALLOW_PRIVATE` | **Csak fejlesztéshez**: helyi (privát) webhook-címek engedélyezése; élesben ne állítsd be |

## Adatátvétel a régi (Java) változatból

A Tickoff korábban Spring Boot + Vite alapú volt; ennek utolsó állapota a `java-legacy` git címkén érhető el. A mostani alkalmazás ugyanazt az API-szerződést követi, és a régi adatbázis átvihető: a jelszó-hash-ek, a kétlépcsős belépés adatai és a tokenek formátuma azonos, így a felhasználók a jelszavukkal lépnek be, a beágyazott widgetek pedig módosítás nélkül működnek tovább (ha a `TICKOFF_JWT_SECRET` is ugyanaz, a bejelentkezett munkamenetek is megmaradnak).

1. Töltsd be a régi adatbázis dumpját egy ideiglenes adatbázisba az új MySQL-ben (pl. `tickoff_java`).
2. Indítsd az alkalmazást egyszer, hogy a migrációk létrehozzák a sémát (az adatbázis üres marad).
3. Futtasd az importot (a cél üres kell legyen, különben megáll; a forrás nem módosul):

```bash
docker compose -f docker-compose.prod.yml run --rm -e SOURCE_DATABASE_URL="mysql://root:ROOT_JELSZÓ@mysql:3306/tickoff_java" app node import.cjs
```

   A script táblánként kiírja a sorszámokat, és megáll, ha az átvitel után bármelyik nem egyezik. Fejlesztésben: `cd web && SOURCE_DATABASE_URL=… npx tsx scripts/import-from-java.ts`.
4. A képernyőképek könyvtárát (`/data/screenshots`) ugyanazzal a szerkezettel és a 10001-es felhasználóval másold át az új kötetre.

## Üzemeltetés (production)

A production stack három konténer: **MySQL** (csak belső hálózaton), **app** (a Next.js alkalmazás: felület, API és a widget kiszolgálása; nem root felhasználó, csak belső hálózaton) és **caddy** (automatikus HTTPS, a kéréseket az alkalmazásnak adja tovább). Kívülről egyedül a Caddy érhető el, a 80-as és 443-as porton.

### Első indítás

Előfeltétel: egy szerver Dockerrel, és egy domain, aminek a DNS-e a szerverre mutat (a Let's Encrypt-hez a 80-as és 443-as portnak elérhetőnek kell lennie).

```bash
cp .env.example .env
# töltsd ki: domain, e-mail, jelszavak, JWT-titok, SMTP-szerver. Erős titkok:  openssl rand -base64 36
docker compose -f docker-compose.prod.yml up -d --build
```

A kötelező változók hiányában a compose érthető hibával megáll, az alkalmazás pedig production módban a fejlesztői JWT-titkkal nem indul el. Indításkor az alkalmazás előbb lefuttatja a függő adatbázis-migrációkat, aztán elindul. Az első indításkor a tanúsítvány kérése pár másodpercet vesz igénybe; az állapot: `https://<domain>/api/health`.

**SMTP-szerver nélkül a jelszó-visszaállítás és az értesítések nem működnek** (lásd az E-mail szakaszt): add meg az `SMTP_*` változókat a `.env`-ben, és a feladó domainjére állítsd be az SPF/DKIM rekordokat, különben a levelek spamként érkeznek.

1. Nyisd meg a `https://<domain>` címet, és **regisztráld a saját fiókodat**.
2. Állítsd a `.env`-ben `TICKOFF_REGISTRATION_ENABLED=false` értékre, és `docker compose -f docker-compose.prod.yml up -d` (újraindul az alkalmazás). Így idegenek nem tudnak fiókot létrehozni. Ha egy kolléga is kell, kapcsold vissza ideiglenesen.
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

Az adatbázis-séma az alkalmazás indulásakor automatikusan frissül (Drizzle-migrációk, `web/drizzle/`). A felület fájljainak nevébe hash kerül, ezért egy új kiadás azonnal érvényesül a böngészőkben.

### Mentés és visszaállítás

```bash
scripts/backup.sh /var/backups/tickoff     # adatbázis-dump + képernyőképek (időzítsd cronnal)
```

A mentés ideiglenes fájlba készül, és csak ép állapotban kerül a helyére, hibánál nem marad töredék. **Másold a mentéseket a szerveren kívülre is**, és időnként próbáld ki a visszaállítást.

```bash
# adatbázis (a dump DROP TABLE-lel kezdi a táblákat, tehát meglévő adatra is visszaállítható; előtte érdemes leállítani az alkalmazást)
gunzip -c db-ÉÉÉÉHHNN-ÓÓPPMM.sql.gz | docker compose -f docker-compose.prod.yml exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot tickoff'
# képernyőképek
docker compose -f docker-compose.prod.yml exec -T app sh -c 'tar -C /data -xzf -' < screenshots-ÉÉÉÉHHNN-ÓÓPPMM.tar.gz
```

### Mi van beállítva

- **HTTPS** automatikusan (Let's Encrypt), HSTS, `nosniff`, `Referrer-Policy`; a `Server` fejléc elrejtve. A tanúsítványok kötetben vannak, újraindításkor nem vesznek el.
- **Content-Security-Policy**: az alkalmazás kérésenként új nonce-szal állítja be (`src/proxy.ts`), nincs beágyazás (`frame-ancestors 'none'`); a hash-elt statikus fájlok `immutable` gyorsítótárral mennek.
- **Kérésméret**: az `/api` kérések legfeljebb 4 MB-osak (a képernyőkép 3 MB), a nagyobbat a Caddy `413`-mal elutasítja.
- **Alkalmazás**: nem root felhasználóval fut, az adatbázis és az alkalmazás portja nincs kiadva.
- **Kérésszám-korlát** és a valódi kliens-IP kezelése proxy mögött: lásd a Kérésszám-korlát szakaszt.

### Amit érdemes tudni

- A widget **az ügyfél saját oldalán fut**: ha annak szigorú Content-Security-Policy-ja van, engedélyeznie kell a `<domain>` script-forrást és `connect-src`-t.
- Egy szerveren, egy példányban gondolkodik (a kérésszám-korlát és az ütemező folyamaton belüli, a képernyőképek helyi köteten vannak). Több példányhoz közös tároló és külső ütemező kell.
- A felület kliens oldalon renderelődik, így a landing keresőoptimalizálása korlátozott.
- A JWT-titok cseréje mindenkit kijelentkeztet. A `MYSQL_*` jelszavakat csak úgy lehet utólag cserélni, ha az adatbázisban is átírod őket (a változó csak az első létrehozáskor érvényesül).

## CI (GitHub Actions)

A `.github/workflows/ci.yml` minden `main`-re érkező pushnál és minden pull requestnél lefut, három párhuzamos jobbal:

| Job | Mit csinál |
|---|---|
| **Widget** | `npm ci`, majd `npm run build`: típusellenőrzés (`tsc`) és `vite build` |
| **Alkalmazás** | `web/`: `npm ci`, `npm run typecheck`, `npm run build` |
| **Docker** | Az alkalmazás image-ének építése (`web/Dockerfile`), a dev és a prod compose-fájl ellenőrzése |

Titkot nem használ. Egy ágon egyszerre csak a legfrissebb futás számít (a régebbit megszakítja).

## Következő lépések

A "Még nincs meg" lista (a Funkciók szakasz végén) a hátralévő ötletek gyűjtője. Nagyobb, még nem megoldott tervek:

- Éles levélküldés: a Brevo beállítása (SMTP-belépés, igazolt feladó), lásd az E-mail szakaszt.
- Több példányos üzemeltetés: közös kérésszám-korlát tároló (Redis), külső ütemező és objektumtároló a képernyőképeknek.
