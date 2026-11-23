import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Group,
  Menu,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { api, ApiError, type Project } from './api';
import { saveBlob } from './download';
import { MembersPanel } from './MembersPanel';
import { RoundsPanel } from './RoundsPanel';
import { WebhookModal } from './WebhookModal';

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
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
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
        </SimpleGrid>
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

/** A nyitott kör összesítője egy sorban: kommentek státuszonként és az ügyfél jóváhagyása. */
function StatsRow({ stats }: { stats: Project['stats'] }) {
  if (stats.roundNumber === null) {
    return (
      <Text size="xs" c="dimmed">
        Nincs nyitott kör. Nyiss egyet, hogy az ügyfél visszajelzést küldhessen.
      </Text>
    );
  }
  const total = stats.open + stats.inProgress + stats.done;
  return (
    <Group gap="xs">
      <Badge variant="outline" color="gray">
        {stats.roundNumber}. kör
      </Badge>
      {total === 0 ? (
        <Text size="xs" c="dimmed">
          még nincs komment
        </Text>
      ) : (
        <>
          <Badge variant="light" color="orange">
            {stats.open} nyitott
          </Badge>
          <Badge variant="light" color="brand">
            {stats.inProgress} folyamatban
          </Badge>
          <Badge variant="light" color="teal">
            {stats.done} kész
          </Badge>
        </>
      )}
      {stats.approved && (
        <Badge color="teal" variant="filled">
          ✓ az ügyfél jóváhagyta
        </Badge>
      )}
    </Group>
  );
}

function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

/** Az összes projekt összesítője: mennyi dolog vár a csapatra. */
function Overview({ projects }: { projects: Project[] }) {
  const open = projects.reduce((n, p) => n + p.stats.open, 0);
  const inProgress = projects.reduce((n, p) => n + p.stats.inProgress, 0);
  const awaiting = projects.filter((p) => p.stats.approved).length;
  const withOpen = projects.filter((p) => p.stats.open > 0).length;
  return (
    <SimpleGrid cols={{ base: 1, sm: 3 }}>
      <Paper withBorder p="md" shadow="xs">
        <Text size="xs" c="dimmed" fw={600}>
          NYITOTT VISSZAJELZÉS
        </Text>
        <Text fz={28} fw={800} lh={1.2}>
          {open}
        </Text>
        <Text size="xs" c="dimmed">
          {withOpen} projektben
        </Text>
      </Paper>
      <Paper withBorder p="md" shadow="xs">
        <Text size="xs" c="dimmed" fw={600}>
          FOLYAMATBAN
        </Text>
        <Text fz={28} fw={800} lh={1.2}>
          {inProgress}
        </Text>
        <Text size="xs" c="dimmed">
          dolgozunk rajta
        </Text>
      </Paper>
      <Paper withBorder p="md" shadow="xs">
        <Text size="xs" c="dimmed" fw={600}>
          JÓVÁHAGYOTT KÖR
        </Text>
        <Text fz={28} fw={800} lh={1.2}>
          {awaiting}
        </Text>
        <Text size="xs" c="dimmed">
          lezárásra vár
        </Text>
      </Paper>
    </SimpleGrid>
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
  // A webhook-ablak a bezáródó animáció alatt is a projektet mutatja
  const [webhookFor, setWebhookFor] = useState<Project | null>(null);
  const [webhookOpen, setWebhookOpen] = useState(false);

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
      <Group justify="space-between" align="baseline">
        <Title order={2}>Projektek</Title>
        {projects && projects.length > 0 && (
          <Text size="sm" c="dimmed">
            {projects.length} projekt
          </Text>
        )}
      </Group>

      <Paper withBorder p="lg" shadow="xs">
        <Text fw={700} mb="sm">
          Új projekt
        </Text>
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
      {projects && projects.length > 0 && <Overview projects={projects} />}
      {projects && projects.length === 0 && (
        <Paper withBorder p="xl" style={{ borderStyle: 'dashed' }}>
          <Text c="dimmed" ta="center">
            Még nincs projekted. Hozd létre az elsőt fent, és add át az ügyfélnek a megosztó tokent.
          </Text>
        </Paper>
      )}

      {projects?.map((p) => (
        <Card key={p.id} withBorder padding="lg">
          {editingId === p.id ? (
            <ProjectForm
              initial={p}
              submitLabel="Mentés"
              onSubmit={(n, u) => update(p.id, n, u)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <Stack gap="md">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
                  <div className="project-mark" aria-hidden="true">
                    {(p.name.trim()[0] ?? '?').toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <Title order={3} lineClamp={1}>
                      {p.name}
                    </Title>
                    <Anchor href={p.siteUrl} target="_blank" rel="noopener noreferrer" size="sm" c="dimmed">
                      {p.siteUrl}
                    </Anchor>
                  </div>
                </Group>
                {p.role === 'OWNER' ? (
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Projekt műveletei">
                        <DotsIcon />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item onClick={() => setEditingId(p.id)}>Szerkesztés</Menu.Item>
                      <Menu.Item
                        onClick={() => {
                          setRegenerating(p);
                          setRegenerateOpen(true);
                        }}
                      >
                        Új token generálása
                      </Menu.Item>
                      <Menu.Item
                        onClick={() => {
                          setWebhookFor(p);
                          setWebhookOpen(true);
                        }}
                      >
                        Webhook (Slack, Discord){p.webhookUrl ? ' ✓' : ''}
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item
                        color="red"
                        onClick={() => {
                          setDeleting(p);
                          setDeleteOpen(true);
                        }}
                      >
                        Projekt törlése
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                ) : (
                  // A tag a visszajelzéseket kezelheti, a projekt beállításait nem
                  <Stack gap={2} align="flex-end">
                    <Badge variant="light" color="grape">
                      meghívott tag
                    </Badge>
                    <Text size="xs" c="dimmed">
                      Tulajdonos: {p.ownerName}
                    </Text>
                  </Stack>
                )}
              </Group>

              <StatsRow stats={p.stats} />

              <div className="token-bar">
                <Text size="xs" c="dimmed" fw={600}>
                  Megosztó token
                </Text>
                <Code>{p.shareToken}</Code>
                <CopyButton value={p.shareToken}>
                  {({ copied, copy }) => (
                    <Button variant="light" size="compact-xs" onClick={copy}>
                      {copied ? 'Másolva' : 'Másolás'}
                    </Button>
                  )}
                </CopyButton>
                <Button variant="subtle" color="gray" size="compact-xs" ml="auto" onClick={() => exportAll(p)}>
                  Összes komment (CSV)
                </Button>
              </div>

              <Tabs defaultValue="rounds" keepMounted={false}>
                <Tabs.List>
                  <Tabs.Tab value="rounds">Körök</Tabs.Tab>
                  <Tabs.Tab value="members">Tagok</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="rounds" pt="sm">
                  <RoundsPanel
                    projectId={p.id}
                    currentUserId={currentUserId}
                    onActivity={() =>
                      void api.projects
                        .get(p.id)
                        .then((fresh) => setProjects((prev) => prev?.map((x) => (x.id === fresh.id ? { ...x, stats: fresh.stats } : x)) ?? null))
                        .catch(() => undefined)
                    }
                  />
                </Tabs.Panel>
                <Tabs.Panel value="members" pt="sm">
                  <MembersPanel
                    projectId={p.id}
                    role={p.role}
                    currentUserId={currentUserId}
                    onLeft={() => setProjects((prev) => prev?.filter((x) => x.id !== p.id) ?? null)}
                    onTransferred={(newOwnerName) =>
                      setProjects(
                        (prev) =>
                          prev?.map((x) => (x.id === p.id ? { ...x, role: 'MEMBER', ownerName: newOwnerName } : x)) ?? null,
                      )
                    }
                  />
                </Tabs.Panel>
              </Tabs>
            </Stack>
          )}
        </Card>
      ))}

      <WebhookModal
        project={projects?.find((x) => x.id === webhookFor?.id) ?? webhookFor}
        opened={webhookOpen}
        onClose={() => setWebhookOpen(false)}
        onChanged={(updated) => setProjects((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? null)}
      />

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
