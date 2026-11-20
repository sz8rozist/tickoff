/** A "megmutatás az oldalon" mélylink query paramétere: ?tickoff-comment=<komment azonosítója>. */
export const FOCUS_PARAM = 'tickoff-comment';

/**
 * Az aktuális "oldal" azonosítója: origin + útvonal + query. A mélylink paramétere nem része (az nem az oldalhoz tartozik).
 * A hash csak akkor kerül bele, ha útvonalnak látszik (#/... vagy #!/...): a hash-alapú single-page alkalmazásokban az
 * különbözteti meg az oldalakat. A sima horgonyokat (#kapcsolat) figyelmen kívül hagyjuk, hogy az oldalon belüli
 * ugrás ne számítson új oldalnak.
 */
export function pageUrl(): string {
  let search = location.search;
  if (search.includes(FOCUS_PARAM)) {
    const params = new URLSearchParams(search);
    params.delete(FOCUS_PARAM);
    const rest = params.toString();
    search = rest ? `?${rest}` : '';
  }
  const hash = /^#!?\//.test(location.hash) ? location.hash : '';
  return location.origin + location.pathname + search + hash;
}

/** A mélylinkből a komment azonosítója, vagy null. */
export function readFocusId(): number | null {
  const value = new URLSearchParams(location.search).get(FOCUS_PARAM);
  return value !== null && /^\d{1,12}$/.test(value) ? Number(value) : null;
}

/** Eltávolítja a mélylink paraméterét a címsorból, hogy ne maradjon az előzményekben, és ne kerüljön új kommentek URL-jébe. */
export function stripFocusParam() {
  if (!location.search.includes(FOCUS_PARAM)) return;
  const params = new URLSearchParams(location.search);
  params.delete(FOCUS_PARAM);
  const rest = params.toString();
  history.replaceState(history.state, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
}
