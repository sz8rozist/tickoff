import type { MouseEvent, ReactNode } from 'react';
import { Text } from '@mantine/core';
import { Logo } from './Logo';
import { t, useLang } from './i18n';

const POINTS = () => [
  { title: t('Pontos jelölés'), text: t('Az ügyfél arra az elemre kattint, amiről beszél. Nincs több „a második gomb a harmadik szekcióban”.') },
  { title: t('Rendezett körök'), text: t('Minden javítási kör külön, státusszal, képernyőképpel, szálakkal.') },
  { title: t('Fiók nélkül az ügyfélnek'), text: t('Egy script-címke az oldalon, és az ügyfél már küldheti a visszajelzést.') },
];

/** A belépő, a regisztrációs és a jelszó-visszaállító oldal közös kerete: bal oldalt a márka, jobb oldalt az űrlap. */
export function AuthShell({ children, onHome }: { children: ReactNode; onHome?: () => void }) {
  function home(e: MouseEvent<HTMLAnchorElement>) {
    if (!onHome) return;
    e.preventDefault();
    onHome();
  }

  const { lang, setLang } = useLang();

  return (
    <div className="auth-split">
      <aside className="auth-brand">
        <a href="/" className="auth-brand-logo" onClick={home} aria-label={t('Tickoff, kezdőlap')}>
          <Logo size={40} />
          <span className="wordmark">{t('Tickoff')}</span>
        </a>

        <div className="auth-brand-body">
          <h2>{t('Az ügyfél-visszajelzés végre egy helyen.')}</h2>
          <ul>
            {POINTS().map((p) => (
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
          {t('Visszajelzések, körök, jóváhagyás: egyetlen áttekinthető felületen.')}</Text>
      </aside>

      <main className="auth-main">
        <div className="auth-lang" role="group" aria-label={t('Nyelv')}>
          {(
            [
              ['hu', 'HU'],
              ['en', 'EN'],
            ] as const
          ).map(([code, label]) => (
            <button key={code} type="button" data-active={lang === code || undefined} onClick={() => setLang(code)}>
              {label}
            </button>
          ))}
        </div>
        <div className="auth-inner">
          <a href="/" className="auth-mobile-logo" onClick={home} aria-label={t('Tickoff, kezdőlap')}>
            <Logo size={36} />
            <span className="wordmark">{t('Tickoff')}</span>
          </a>
          {children}
        </div>
      </main>
    </div>
  );
}
