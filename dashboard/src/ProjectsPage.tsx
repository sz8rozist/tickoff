import { useEffect, useState } from 'react';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { api, ApiError, type Project } from './api';
import { saveBlob } from './download';
import { MembersPanel } from './MembersPanel';
import { RoundsPanel } from './RoundsPanel';

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm({
    initialValues: { name: initial?.name ?? '', siteUrl: initial?.siteUrl ?? '' },
    validate: {
      name: (v) => (v.trim() === '' ? 'A név kötelező' : null),
      siteUrl: (v) => (/^https?:\/\/\S+$/.test(v.trim()) ? null : 'http:// vagy https:// kezdetű cím kell'),
    },
  });

  async function submit(values: typeof form.values) {
    setError(null);
    setBusy(true);
    try {
      await onSubmit(values.name, values.siteUrl);
      if (!initial) form.reset();
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="sm">
        <Group align="flex-start" grow>
          <TextInput
            label="Projekt neve"
            placeholder="Kávézó weboldal"
            maxLength={160}
            {...form.getInputProps('name')}
          />
          <TextInput
            label="Az oldal címe"
            placeholder="https://staging.ugyfel.hu"
            maxLength={500}
            {...form.getInputProps('siteUrl')}
          />
        </Group>
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        <Group>
          <Button type="submit" loading={busy}>
            {submitLabel}
          </Button>
          {onCancel && (
            <Button variant="default" onClick={onCancel}>
              Mégse
            </Button>
          )}
        </Group>
      </Stack>
    </form>
  );
}

export function ProjectsPage({ currentUserId }: { currentUserId: number }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  // A `deleting` a bezáródó animáció alatt is megmarad, hogy a szöveg ne ürüljön ki.
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [regenerating, setRegenerating] = useState<Project | null>(null);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerateBusy, setRegenerateBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState<Set<number>>(new Set());

  useEffect(() => {
    api.projects.list().then(setProjects).catch(() => setLoadError(true));
  }, []);

  function toggleMembers(id: number) {
    setMembersOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  async function create(name: string, siteUrl: string) {
    const created = await api.projects.create({ name, siteUrl });
    setProjects((prev) => [created, ...(prev ?? [])]);
  }

  async function update(id: number, name: string, siteUrl: string) {
    const updated = await api.projects.update(id, { name, siteUrl });
    setProjects((prev) => prev?.map((p) => (p.id === id ? updated : p)) ?? null);
    setEditingId(null);
  }

  async function confirmRegenerate() {
    if (!regenerating) return;
    setActionError(null);
    setRegenerateBusy(true);
    try {
      const updated = await api.projects.regenerateToken(regenerating.id);
      setProjects((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? null);
    } catch (e) {
      setActionError(describe(e));
    } finally {
      setRegenerateBusy(false);
      setRegenerateOpen(false);
    }
  }

  async function exportAll(p: Project) {
    setActionError(null);
    try {
      const { blob, filename } = await api.comments.exportCsv(p.id);
      saveBlob(blob, filename);
    } catch {
      setActionError('Az export nem sikerült, próbáld újra később.');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setActionError(null);
    setDeleteBusy(true);
    try {
      await api.projects.remove(deleting.id);
      setProjects((prev) => prev?.filter((x) => x.id !== deleting.id) ?? null);
    } catch (e) {
      setActionError(describe(e));
    } finally {
      setDeleteBusy(false);
      setDeleteOpen(false);
    }
  }

  return (
    <Stack gap="lg">
      <Title order={2}>Projektek</Title>

      <Paper withBorder p="md" radius="md">
        <ProjectForm submitLabel="Projekt létrehozása" onSubmit={create} />
      </Paper>

      {actionError && (
        <Alert color="red" role="alert">
          {actionError}
        </Alert>
      )}
      {loadError && (
        <Alert color="red" role="alert">
          A projektek betöltése nem sikerült.
        </Alert>
      )}
      {projects && projects.length === 0 && (
        <Text c="dimmed">Még nincs projekted. Hozd létre az elsőt fent.</Text>
      )}

      {projects?.map((p) => (
        <Card key={p.id} withBorder radius="md" padding="md">
          {editingId === p.id ? (
            <ProjectForm
              initial={p}
              submitLabel="Mentés"
              onSubmit={(n, u) => update(p.id, n, u)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <Stack gap="xs">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Title order={3} size="h4">
                    {p.name}
                  </Title>
                  <Anchor href={p.siteUrl} target="_blank" rel="noopener noreferrer" size="sm">
                    {p.siteUrl}
                  </Anchor>
                </div>
                {p.role === 'OWNER' ? (
                  <Group gap="xs">
                    <Button variant="default" size="xs" onClick={() => setEditingId(p.id)}>
                      Szerkesztés
                    </Button>
                    <Button
                      variant="light"
                      color="red"
                      size="xs"
                      onClick={() => {
                        setDeleting(p);
                        setDeleteOpen(true);
                      }}
                    >
                      Törlés
                    </Button>
                  </Group>
                ) : (
                  // A tag a visszajelzéseket kezelheti, a projekt beállításait nem
                  <Group gap="xs">
                    <Badge variant="light" color="grape">
                      meghívott tag
                    </Badge>
                    <Text size="xs" c="dimmed">
                      Tulajdonos: {p.ownerName}
                    </Text>
                  </Group>
                )}
              </Group>

              <Group gap="xs">
                <Text size="xs" c="dimmed">
                  Megosztó token:
                </Text>
                <Code>{p.shareToken}</Code>
                <CopyButton value={p.shareToken}>
                  {({ copied, copy }) => (
                    <Button variant="subtle" size="compact-xs" onClick={copy}>
                      {copied ? 'Másolva' : 'Másolás'}
                    </Button>
                  )}
                </CopyButton>
                {p.role === 'OWNER' && (
                  <Button
                    variant="subtle"
                    color="orange"
                    size="compact-xs"
                    onClick={() => {
                      setRegenerating(p);
                      setRegenerateOpen(true);
                    }}
                  >
                    Új token
                  </Button>
                )}
                <Button variant="subtle" size="compact-xs" onClick={() => exportAll(p)}>
                  Összes komment (CSV)
                </Button>
                <Button variant="subtle" size="compact-xs" onClick={() => toggleMembers(p.id)}>
                  {membersOpen.has(p.id) ? 'Tagok elrejtése' : 'Tagok'}
                </Button>
              </Group>

              {membersOpen.has(p.id) && (
                <MembersPanel
                  projectId={p.id}
                  role={p.role}
                  currentUserId={currentUserId}
                  onLeft={() => setProjects((prev) => prev?.filter((x) => x.id !== p.id) ?? null)}
                />
              )}

              <RoundsPanel projectId={p.id} />
            </Stack>
          )}
        </Card>
      ))}

      <Modal opened={regenerateOpen} onClose={() => setRegenerateOpen(false)} title="Új megosztó token" centered>
        <Stack>
          <Text size="sm">
            Új tokent generálsz a(z) „{regenerating?.name}” projekthez. A <b>régi token azonnal érvénytelen</b>, ezért a
            vele beágyazott widgetek leállnak, amíg az ügyfél oldalába be nem írod az újat. A már beküldött kommentek
            megmaradnak.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRegenerateOpen(false)}>
              Mégse
            </Button>
            <Button color="orange" loading={regenerateBusy} onClick={confirmRegenerate}>
              Új token generálása
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={deleteOpen} onClose={() => setDeleteOpen(false)} title="Projekt törlése" centered>
        <Stack>
          <Text size="sm">
            Biztosan törlöd a(z) „{deleting?.name}” projektet? A körei és kommentjei is törlődnek, és a meghívott
            tagok számára is megszűnik. Ez nem vonható vissza.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteOpen(false)}>
              Mégse
            </Button>
            <Button color="red" loading={deleteBusy} onClick={confirmDelete}>
              Törlés
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
