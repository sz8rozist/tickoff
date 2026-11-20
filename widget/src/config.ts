export const HOST_ID = 'tickoff-widget-host';

export interface Config {
  token: string;
  apiBase: string;
}

/**
 * A beállításokat a script tag attribútumaiból olvassuk:
 *   <script src="https://…/tickoff-widget.js" data-token="PROJEKT_TOKEN" data-api="https://api.tickoff.example"></script>
 * A `data-api` elhagyható: ilyenkor a script saját origin-jét használjuk.
 *
 * A `document.currentScript` csak a script első, szinkron futása közben érhető el, ezért ezt a függvényt
 * a modul betöltésekor kell meghívni, nem később (pl. DOMContentLoaded-ben).
 */
export function readConfig(): Config | null {
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector<HTMLScriptElement>('script[data-token]');

  let token = script?.dataset.token ?? '';
  let apiBase = script?.dataset.api ?? '';

  if (import.meta.env.DEV) {
    // Fejlesztői demo oldal: ?token=… az URL-ben, az API alapból a helyi backend.
    token = token || new URLSearchParams(location.search).get('token') || '';
    apiBase = apiBase || 'http://127.0.0.1:8080';
  }

  if (!apiBase && script?.src) {
    try {
      apiBase = new URL(script.src).origin;
    } catch {
      /* érvénytelen src: lent kezeljük */
    }
  }

  if (!token || !apiBase) {
    console.warn('[Tickoff] Hiányzik a data-token (vagy az API címe), a widget nem indul el.');
    return null;
  }
  return { token, apiBase: apiBase.replace(/\/+$/, '') };
}
