import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type Project } from './api';

function describe(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 400) return 'Ellenőrizd az adatokat: a név kötelező, a címnek http:// vagy https://-sel kell kezdődnie.';
    if (e.status === 404) return 'A projekt nem található (lehet, hogy közben törölték).';
  }
  return 'Nem sikerült, próbáld újra később.';
}

function ProjectForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Project;
  submitLabel: string;
  onSubmit: (name: string, siteUrl: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [siteUrl, setSiteUrl] = useState(initial?.siteUrl ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit(name, siteUrl);
      if (!initial) {
        setName('');
        setSiteUrl('');
      }
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
      <input placeholder="Projekt neve" value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} />
      <input
        type="url"
        placeholder="https://staging.ugyfel.hu"
        value={siteUrl}
        onChange={(e) => setSiteUrl(e.target.value)}
        required
        maxLength={500}
      />
      {error && <p role="alert" style={{ color: '#b00020', margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={busy}>{submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel}>Mégse</button>}
      </div>
    </form>
  );
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    api.projects.list().then(setProjects).catch(() => setLoadError(true));
  }, []);

  async function create(name: string, siteUrl: string) {
    const created = await api.projects.create({ name, siteUrl });
    setProjects((prev) => [created, ...(prev ?? [])]);
  }

  async function update(id: number, name: string, siteUrl: string) {
    const updated = await api.projects.update(id, { name, siteUrl });
    setProjects((prev) => prev?.map((p) => (p.id === id ? updated : p)) ?? null);
    setEditingId(null);
  }

  async function remove(p: Project) {
    if (!window.confirm(`Biztosan törlöd a(z) „${p.name}” projektet? A körei és kommentjei is törlődnek.`)) return;
    setActionError(null);
    try {
      await api.projects.remove(p.id);
      setProjects((prev) => prev?.filter((x) => x.id !== p.id) ?? null);
    } catch (e) {
      setActionError(describe(e));
    }
  }

  return (
    <section>
      <h2>Projektek</h2>
      <ProjectForm submitLabel="Projekt létrehozása" onSubmit={create} />
      {actionError && <p role="alert" style={{ color: '#b00020' }}>{actionError}</p>}
      {loadError && <p role="alert" style={{ color: '#b00020' }}>A projektek betöltése nem sikerült.</p>}
      {projects && projects.length === 0 && <p>Még nincs projekted. Hozd létre az elsőt fent.</p>}
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12, marginTop: 24 }}>
        {projects?.map((p) => (
          <li key={p.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            {editingId === p.id ? (
              <ProjectForm
                initial={p}
                submitLabel="Mentés"
                onSubmit={(n, u) => update(p.id, n, u)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <strong>{p.name}</strong>
                <div style={{ color: '#555' }}>{p.siteUrl}</div>
                <div style={{ fontSize: 12, color: '#777', margin: '6px 0' }}>
                  Megosztó token: <code>{p.shareToken}</code>
                </div>
                <button onClick={() => setEditingId(p.id)}>Szerkesztés</button>{' '}
                <button onClick={() => remove(p)}>Törlés</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
