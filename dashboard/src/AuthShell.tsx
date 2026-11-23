import type { MouseEvent, ReactNode } from 'react';
import { Text } from '@mantine/core';
import { Logo } from './Logo';

const POINTS = [
  { title: 'Pontos jelölés', text: 'Az ügyfél arra az elemre kattint, amiről beszél. Nincs több „a második gomb a harmadik szekcióban”.' },
  { title: 'Rendezett körök', text: 'Minden javítási kör külön, státusszal, képernyőképpel, szálakkal.' },
  { title: 'Fiók nélkül az ügyfélnek', text: 'Egy script-címke az oldalon, és az ügyfél már küldheti a visszajelzést.' },
];

/** A belépő, a regisztrációs és a jelszó-visszaállító oldal közös kerete: bal oldalt a márka, jobb oldalt az űrlap. */
export function AuthShell({ children, onHome }: { children: ReactNode; onHome?: () => void }) {
  function home(e: MouseEvent<HTMLAnchorElement>) {
    if (!onHome) return;
    e.preventDefault();
    onHome();
  }

  return (
    <div className="auth-split">
      <aside className="auth-brand">
        <a href="/" className="auth-brand-logo" onClick={home} aria-label="Tickoff, kezdőlap">
          <Logo size={40} />
          <span className="wordmark">Tickoff</span>
        </a>

        <div className="auth-brand-body">
          <h2>Az ügyfél-visszajelzés végre egy helyen.</h2>
          <ul>
            {POINTS.map((p) => (
              <li key={p.title}>
                <span className="tick" aria-hidden="true">
                  ✓
                </span>
                <span>
                  <strong>{p.title}</strong>
                  <br />
                  {p.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Text size="xs" className="auth-brand-foot">
          Visszajelzések, körök, jóváhagyás: egyetlen áttekinthető felületen.
        </Text>
      </aside>

      <main className="auth-main">
        <div className="auth-inner">
          <a href="/" className="auth-mobile-logo" onClick={home} aria-label="Tickoff, kezdőlap">
            <Logo size={36} />
            <span className="wordmark">Tickoff</span>
          </a>
          {children}
        </div>
      </main>
    </div>
  );
}
