import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type Project } from './api';

const SELECTED_KEY = 'tickoff.selectedProject';

interface DashboardState {
  /** Az összes elérhető projekt (archiváltak is); null, amíg tölt. */
  projects: Project[] | null;
  setProjects: (updater: (prev: Project[] | null) => Project[] | null) => void;
  loadError: boolean;
  /** A felső sávban kiválasztott projekt (a Visszajelzések és az Ügyfelek nézet erre vonatkozik). */
  selected: Project | null;
  select: (id: number | null) => void;
  /** A felső sáv keresője: minden nézet a saját tartalmát szűri vele. */
  query: string;
  setQuery: (q: string) => void;
}

const Ctx = createContext<DashboardState | null>(null);

function readSelected(): number | null {
  try {
    const v = window.localStorage.getItem(SELECTED_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [projects, setProjectsState] = useState<Project[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(readSelected);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.projects.list().then(setProjectsState).catch(() => setLoadError(true));
  }, []);

  const setProjects = useCallback((updater: (prev: Project[] | null) => Project[] | null) => setProjectsState(updater), []);

  const select = useCallback((id: number | null) => {
    setSelectedId(id);
    try {
      if (id === null) window.localStorage.removeItem(SELECTED_KEY);
      else window.localStorage.setItem(SELECTED_KEY, String(id));
    } catch {
      /* a böngésző tárolója nem elérhető: a választás csak a munkamenetre szól */
    }
  }, []);

  // A kiválasztott projekt az aktívak közül való; ha nincs vagy eltűnt (törölték, archiválták), az első aktív
  const selected = useMemo(() => {
    const active = (projects ?? []).filter((p) => p.archivedAt === null);
    return active.find((p) => p.id === selectedId) ?? active[0] ?? null;
  }, [projects, selectedId]);

  const value = useMemo(
    () => ({ projects, setProjects, loadError, selected, select, query, setQuery }),
    [projects, setProjects, loadError, selected, select, query],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboard(): DashboardState {
  const v = useContext(Ctx);
  if (!v) throw new Error('A DashboardProvider hiányzik');
  return v;
}

/** Ékezet- és kisbetű-független összehasonlításhoz (a keresés "kave"-ra is megtalálja a "Kávé"-t). */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
}
