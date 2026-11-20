import { useEffect, useState } from 'react';
import {
  Alert,
  Anchor,
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

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  // A `deleting` a bezáródó animáció alatt is megmarad, hogy a szöveg ne ürüljön ki.
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
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
              </Group>

              <RoundsPanel projectId={p.id} />
            </Stack>
          )}
        </Card>
      ))}

      <Modal opened={deleteOpen} onClose={() => setDeleteOpen(false)} title="Projekt törlése" centered>
        <Stack>
          <Text size="sm">
            Biztosan törlöd a(z) „{deleting?.name}” projektet? A körei és kommentjei is törlődnek, ez nem vonható
            vissza.
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
