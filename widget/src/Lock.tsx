import { useState } from 'react';
import { t } from './i18n';

/** Jelszóval védett widget: a gomb egy jelszókérő panelt nyit; a feloldás után a widget a megszokott módon indul. */
export function Lock({ onUnlock }: { onUnlock: (password: string) => Promise<'ok' | 'wrong' | 'limited' | 'error'> }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: Event) {
    e.preventDefault();
    if (password === '' || busy) return;
    setBusy(true);
    setError(null);
    const result = await onUnlock(password);
    setBusy(false);
    if (result === 'wrong') setError(t('Hibás jelszó.'));
    else if (result === 'limited') setError(t('Túl sok próbálkozás, várj egy kicsit, és próbáld újra.'));
    else if (result === 'error') setError(t('Nem sikerült, próbáld újra.'));
  }

  return (
    <>
      {open && (
        <form class="panel" role="dialog" aria-label={t('Jelszó a visszajelzéshez')} onSubmit={submit}>
          <h2>{t('Jelszó a visszajelzéshez')}</h2>
          <p class="hint">{t('Ezt a visszajelző felületet jelszó védi. Add meg a tőlünk kapott jelszót.')}</p>
          <label for="tk-pass">{t('Jelszó')}</label>
          <input
            id="tk-pass"
            type="password"
            value={password}
            maxLength={72}
            autocomplete="current-password"
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
          {error && (
            <p class="err" role="alert">
              {error}
            </p>
          )}
          <div class="actions">
            <button type="button" class="btn" onClick={() => setOpen(false)}>
              {t('Mégse')}
            </button>
            <button type="submit" class="btn primary" disabled={busy || password === ''}>
              {busy ? t('Küldés…') : t('Feloldás')}
            </button>
          </div>
        </form>
      )}
      <div class="dock">
        <button class="fab" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          🔒 {t('Visszajelzés')}
        </button>
      </div>
    </>
  );
}
