import { useCallback, useEffect, useState } from 'react';

/** Az oldalak, amelyek a bejelentkezés előtt is elérhetők. A dashboard maga a `/` címen él, bejelentkezve. */
export const PATH_LOGIN = '/belepes';
export const PATH_REGISTER = '/regisztracio';

/**
 * Minimális útvonalkezelés (a History API-val, külön router nélkül): az aktuális útvonal, és egy függvény, amely
 * újratöltés nélkül átlép egy másikra. A böngésző vissza/előre gombja is működik.
 */
export function usePath(): [string, (to: string, replace?: boolean) => void] {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string, replace = false) => {
    if (replace) window.history.replaceState({}, '', to);
    else window.history.pushState({}, '', to);
    setPath(window.location.pathname);
    window.scrollTo(0, 0);
  }, []);

  return [path, navigate];
}
