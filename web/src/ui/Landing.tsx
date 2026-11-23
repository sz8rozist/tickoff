import type { MouseEvent, ReactNode } from 'react';
import { Logo } from './Logo';
import { PATH_LOGIN, PATH_REGISTER } from './route';
import './landing.css';

const FEATURES = [
  {
    icon: '◎',
    title: 'Pontos jelölés',
    text: 'Az ügyfél arra az elemre kattint, amiről beszél, vagy téglalapot húz egy terület köré. Te látod a selectort, a nézetméretet és a böngészőt is.',
  },
  {
    icon: '▣',
    title: 'Képernyőkép és mellékletek',
    text: 'Minden komment kiemelt képernyőképpel érkezik, és az ügyfél képeket is csatolhat referenciának.',
  },
  {
    icon: '↻',
    title: 'Javítási körök',
    text: 'A visszajelzések körökbe rendeződnek. Lezárásnál a meg nem oldottak átvihetők a következő körbe.',
  },
  {
    icon: '✓',
    title: 'Jóváhagyás',
    text: 'A kész javítást az ügyfél elfogadja vagy visszanyitja, a végén pedig jóváhagyja az egész kört.',
  },
  {
    icon: '✉',
    title: 'Szálak és értesítések',
    text: 'Válaszolhattok egymásnak a kommenten belül. Az ügyfél e-mailt kap, ha válaszoltál vagy elkészültél.',
  },
  {
    icon: '☺',
    title: 'Csapatmunka',
    text: 'Hívd meg a kollégáidat, jelölj ki felelőst, szűrj és keress a kommentek között.',
  },
  {
    icon: '⚡',
    title: 'Slack és Discord',
    text: 'Webhookon át azonnal értesít, ha új visszajelzés érkezik, vagy az ügyfél jóváhagyott egy kört.',
  },
  {
    icon: '☎',
    title: 'Mobilon is működik',
    text: 'Az ügyfél telefonról is megjelölhet elemet vagy területet, a widget érintésre is kényelmes.',
  },
];

const STEPS = [
  {
    title: 'Beágyazod a widgetet',
    text: 'Egyetlen script-címke az ügyfél tesztoldalán. Nincs telepítés, nincs fiók az ügyfélnek.',
  },
  {
    title: 'Az ügyfél rákattint és ír',
    text: 'Megjelöli a hibás elemet, leírja, mit szeretne, és küldi. A képernyőképet a widget készíti.',
  },
  {
    title: 'Te kezeled és lezárod a kört',
    text: 'A dashboardon státusz, felelős, szál. Ha minden kész, az ügyfél jóváhagyja, te lezárod a kört.',
  },
];

function Cta({
  href,
  navigate,
  children,
  variant = 'primary',
}: {
  href: string;
  navigate: (to: string) => void;
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'light' | 'outline';
}) {
  function go(e: MouseEvent<HTMLAnchorElement>) {
    // Módosított kattintásnál (új lap) a böngésző dolgozik
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(href);
  }
  return (
    <a href={href} className={`lp-btn lp-btn-${variant}`} onClick={go}>
      {children}
    </a>
  );
}

/** A termék bemutató oldala (bejelentkezés előtt, a `/` címen). */
export function Landing({ navigate }: { navigate: (to: string) => void }) {
  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <a href="/" className="lp-brand" aria-label="Tickoff">
            <Logo size={32} />
            <span className="wordmark">Tickoff</span>
          </a>
          <nav className="lp-links" aria-label="Fő menü">
            <a href="#hogyan">Hogyan működik</a>
            <a href="#funkciok">Funkciók</a>
            <a href="#ugyfel">Ügyfeleknek</a>
          </nav>
          <div className="lp-nav-cta">
            <Cta href={PATH_LOGIN} navigate={navigate} variant="ghost">
              Belépés
            </Cta>
            <Cta href={PATH_REGISTER} navigate={navigate}>
              Regisztráció
            </Cta>
          </div>
        </div>
      </header>

      <main>
        {/* Nyitó rész */}
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-grid">
            <div>
              <span className="lp-pill">Weboldal-projektekhez, ügyfeleknek</span>
              <h1>
                Az ügyfél-visszajelzés, ami <span className="lp-grad">végre rendezett</span>.
              </h1>
              <p className="lp-lead">
                A megrendelő rákattint az oldal hibás elemére, és leírja, mit szeretne. Te egy átlátható listában látod,
                körről körre, képernyőképpel, státusszal. Nem e-mail-láncban, nem képernyőfotók között.
              </p>
              <div className="lp-hero-cta">
                <Cta href={PATH_REGISTER} navigate={navigate}>
                  Kezdjük el
                </Cta>
                <Cta href="#hogyan" navigate={() => document.getElementById('hogyan')?.scrollIntoView({ behavior: 'smooth' })} variant="light">
                  Hogyan működik?
                </Cta>
              </div>
              <ul className="lp-checks">
                <li>Egy script-címke a beágyazáshoz</li>
                <li>Az ügyfélnek nincs szüksége fiókra</li>
                <li>Magyar felület, világos és sötét téma</li>
              </ul>
            </div>

            <HeroMock />
          </div>
        </section>

        {/* Hogyan működik */}
        <section id="hogyan" className="lp-section">
          <div className="lp-wrap">
            <h2>Három lépés, és megvan az első kör</h2>
            <p className="lp-sub">Percek alatt beállítható, az ügyfelednek pedig semmit nem kell megtanulnia.</p>
            <ol className="lp-steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="lp-step-n">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
            <div className="lp-code" aria-label="Beágyazási példa">
              <span className="lp-code-bar">az ügyfél tesztoldalán</span>
              <code>
                {'<script src="https://app.pelda.hu/widget/tickoff-widget.js"'}
                <br />
                {'        data-token="PROJEKT_TOKEN"></script>'}
              </code>
            </div>
          </div>
        </section>

        {/* Funkciók */}
        <section id="funkciok" className="lp-section lp-alt">
          <div className="lp-wrap">
            <h2>Minden, ami a visszajelzési körhöz kell</h2>
            <p className="lp-sub">Az első kommenttől a jóváhagyásig ugyanazon a felületen maradsz.</p>
            <div className="lp-grid">
              {FEATURES.map((f) => (
                <article key={f.title} className="lp-card">
                  <span className="lp-ico" aria-hidden="true">
                    {f.icon}
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Az ügyfél szemszöge */}
        <section id="ugyfel" className="lp-section">
          <div className="lp-wrap lp-two">
            <div>
              <h2>Az ügyfélnek egyszerű, neked pontos</h2>
              <p className="lp-sub left">
                Az ügyfél a saját oldalán dolgozik, ugyanabban a böngészőben, ahol a változtatásokat nézi. Semmit nem kell
                telepítenie vagy megtanulnia.
              </p>
              <ul className="lp-list">
                <li>
                  <strong>Egy gombnyomás a visszajelzés.</strong> A jobb alsó gomb elindítja a jelölést.
                </li>
                <li>
                  <strong>Látja, mi lett belőle.</strong> A kommentek az oldalon maradnak, állapotuk színnel látszik.
                </li>
                <li>
                  <strong>Ő zárja a kört.</strong> Elfogadja a kész javítást, vagy visszanyitja, ha mégsem jó.
                </li>
                <li>
                  <strong>Vissza tudja vonni.</strong> Elírás esetén rövid ideig szerkesztheti a saját kommentjét.
                </li>
              </ul>
            </div>
            <SafetyCard />
          </div>
        </section>

        {/* Záró felhívás */}
        <section className="lp-cta-band">
          <div className="lp-wrap">
            <h2>Kevesebb levelezés, gyorsabb körök</h2>
            <p>Hozd létre az első projektet, és add át az ügyfélnek a widgetet.</p>
            <div className="lp-hero-cta center">
              <Cta href={PATH_REGISTER} navigate={navigate} variant="light">
                Fiók létrehozása
              </Cta>
              <Cta href={PATH_LOGIN} navigate={navigate} variant="outline">
                Van már fiókom
              </Cta>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <span className="lp-brand">
            <Logo size={24} />
            <span className="wordmark">Tickoff</span>
          </span>
          <span>Ügyfél-visszajelzés weboldal-projektekhez.</span>
        </div>
      </footer>
    </div>
  );
}

/** A hero ábrája: egy böngészőablak, rajta jelölőkkel és egy megnyitott komment-buborékkal (tiszta HTML/CSS). */
function HeroMock() {
  return (
    <div className="lp-mock" aria-hidden="true">
      <div className="lp-mock-bar">
        <i />
        <i />
        <i />
        <span>kavezo.pelda.hu/etlap</span>
      </div>
      <div className="lp-mock-page">
        <div className="lp-mock-nav" />
        <div className="lp-mock-h">Reggeli menü</div>
        <div className="lp-mock-line" />
        <div className="lp-mock-line short" />
        <div className="lp-mock-btn">Asztalfoglalás</div>
        <span className="lp-pin p1">1</span>
        <span className="lp-pin p2">2</span>
        <span className="lp-area" />
        <div className="lp-bubble">
          <div className="lp-bubble-meta">Anna · 2 perce</div>
          <div>A gomb mobilon túl kicsi, nagyobb kellene.</div>
          <div className="lp-bubble-tags">
            <span>Folyamatban</span>
            <span className="ok">csapat válaszolt</span>
          </div>
        </div>
      </div>
      <div className="lp-mock-dock">
        <span className="ghost">Lista · 4</span>
        <span className="fab">✓ Visszajelzés</span>
      </div>
    </div>
  );
}

function SafetyCard() {
  return (
    <div className="lp-safety">
      <h3>Biztonságos alapokon</h3>
      <ul>
        <li>A widget csak a projekthez megadott oldalon működik, a megosztó token pedig bármikor cserélhető.</li>
        <li>Kérésszám-korlát védi a nyilvános végpontokat a spam ellen.</li>
        <li>A képek tartalmát a szerver ellenőrzi, a jelszavak hash-elve tárolódnak.</li>
        <li>A projekt adatai csak a csapat tagjai számára láthatók.</li>
      </ul>
    </div>
  );
}
