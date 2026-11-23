import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { en } from './i18n-en';

/**
 * Kétnyelvű felület. A forrásszövegek magyarul vannak a kódban: `t('Projektek')`. Angolul a szótár (i18n-en.ts) adja a
 * fordítást; ha egy szöveghez nincs fordítás, a magyar jelenik meg (a felület sosem marad üresen). Változó a szövegben:
 * `t('{n} projekt', { n: 3 })`.
 *
 * A `t` sima függvény (nem hook), hogy modul szinten és eseménykezelőkben is használható legyen. Nyelvváltáskor a
 * LangProvider újra létrehozza a gyerekeit (key), így minden felirat az új nyelven rajzolódik újra.
 */
export type Lang = 'hu' | 'en';

const STORAGE_KEY = 'tickoff.lang';
let current: Lang = 'hu';

function stored(): Lang {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'hu';
  } catch {
    return 'hu';
  }
}

export function currentLang(): Lang {
  return current;
}

/** A dátumok és számok nyelvi beállítása a felület nyelvéhez. */
export function locale(): string {
  return current === 'en' ? 'en-GB' : 'hu-HU';
}

export function t(text: string, vars?: Record<string, string | number>): string {
  let out = current === 'en' ? (en[text] ?? text) : text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const Ctx = createContext<LangState>({ lang: 'hu', setLang: () => undefined });

export function useLang(): LangState {
  return useContext(Ctx);
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    current = stored();
    return current;
  });

  const setLang = useCallback((next: Lang) => {
    current = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* a választás csak a munkamenetre szól */
    }
    document.documentElement.lang = next;
    setLangState(next);
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  // A key miatt nyelvváltáskor a teljes alatta lévő fa újraépül, így minden t() hívás az új nyelven fut le
  return (
    <Ctx.Provider value={value}>
      <div key={lang} style={{ display: 'contents' }}>
        {children}
      </div>
    </Ctx.Provider>
  );
}
