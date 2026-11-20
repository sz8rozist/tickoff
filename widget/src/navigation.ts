const EVENT = 'tickoff:navigate';
let patched = false;

/**
 * A single-page alkalmazások az útvonalat a History API-val váltják (pushState / replaceState), ami nem vált ki
 * eseményt. Ezért a két metódust egyszer becsomagoljuk: az eredetit változatlanul meghívjuk, utána jelzünk.
 */
function patchHistory() {
  if (patched) return;
  patched = true;
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method];
    history[method] = function (this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event(EVENT));
      return result;
    };
  }
}

/** Meghívja a függvényt, amikor az oldal címe megváltozhatott. Visszaadja a leiratkozó függvényt. */
export function onNavigate(callback: () => void): () => void {
  patchHistory();
  const events = [EVENT, 'popstate', 'hashchange'];
  events.forEach((name) => window.addEventListener(name, callback));
  return () => events.forEach((name) => window.removeEventListener(name, callback));
}
