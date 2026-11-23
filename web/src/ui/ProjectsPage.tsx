import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Modal,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { api, ApiError, type Project } from './api';
import { fold, useDashboard } from './DashboardContext';
import { saveBlob } from './download';
import { WebhookModal } from './WebhookModal';
import { WidgetAppearanceModal } from './WidgetAppearanceModal';

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
  onCancel: () => void;
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
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="sm">
        <TextInput label="Projekt neve" placeholder="Kávézó weboldal" maxLength={160} data-autofocus {...form.getInputProps('name')} />
        <TextInput label="Az oldal címe" placeholder="https://staging.ugyfel.hu" maxLength={500} {...form.getInputProps('siteUrl')} />
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onCancel}>
            Mégse
          </Button>
          <Button type="submit" loading={busy}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
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

/** Az összes aktív projekt összesítője: bento rács, hogy mennyi dolog vár a csapatra. */
function Overview({ projects, onOpen }: { projects: Project[]; onOpen: (p: Project) => void }) {
  const open = projects.reduce((n, p) => n + p.stats.open, 0);
  const inProgress = projects.reduce((n, p) => n + p.stats.inProgress, 0);
  const done = projects.reduce((n, p) => n + p.stats.done, 0);
  const awaiting = projects.filter((p) => p.stats.approved).length;
  const total = open + inProgress + done;
  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);
  const attention = projects
    .filter((p) => p.stats.open > 0)
    .sort((a, b) => b.stats.open - a.stats.open)
    .slice(0, 3);

  return (
    <div className="bento">
      <div className="tile tile-wide">
        <Text className="tile-label">Beérkezett visszajelzés</Text>
        <div className="tile-value">{total}</div>
        <div className="stack-bar" role="img" aria-label={`${open} nyitott, ${inProgress} folyamatban, ${done} megoldott`}>
          <span style={{ width: `${pct(open)}%`, background: 'var(--mantine-color-orange-5)' }} />
          <span style={{ width: `${pct(inProgress)}%`, background: 'var(--mantine-color-brand-6)' }} />
          <span style={{ width: `${pct(done)}%`, background: 'var(--mantine-color-green-6)' }} />
        </div>
        <Text size="xs" c="dimmed" mt={8}>
          {projects.length} aktív projektben
        </Text>
      </div>
      <div className="tile">
        <Text className="tile-label">Nyitott</Text>
        <div className="tile-value" style={{ color: open > 0 ? 'var(--mantine-color-orange-6)' : undefined }}>
          {open}
        </div>
        <Text size="xs" c="dimmed">
          {projects.filter((p) => p.stats.open > 0).length} projektben
        </Text>
      </div>
      <div className="tile">
        <Text className="tile-label">Folyamatban</Text>
        <div className="tile-value" style={{ color: 'var(--mantine-color-brand-6)' }}>
          {inProgress}
        </div>
        <Text size="xs" c="dimmed">
          dolgozunk rajta
        </Text>
      </div>
      <div className="tile">
        <Text className="tile-label">Megoldott</Text>
        <div className="tile-value" style={{ color: 'var(--mantine-color-green-6)' }}>
          {done}
        </div>
        <Text size="xs" c="dimmed">
          a nyitott körökben
        </Text>
      </div>
      <div className="tile">
        <Text className="tile-label">Jóváhagyott kör</Text>
        <div className="tile-value">{awaiting}</div>
        <Text size="xs" c="dimmed">
          lezárásra vár
        </Text>
      </div>
      <div className="tile tile-wide">
        <Text className="tile-label">Figyelmet igényel</Text>
        {attention.length === 0 ? (
          <Text size="sm" c="dimmed" mt={8}>
            Nincs nyitott visszajelzés. Minden rendben.
          </Text>
        ) : (
          <Stack gap={4} mt={6}>
            {attention.map((p) => (
              <button key={p.id} type="button" className="attention-row" onClick={() => onOpen(p)}>
                <span className="attention-name">{p.name}</span>
                <Badge size="sm" variant="light" color="orange">
                  {p.stats.open} nyitott
                </Badge>
              </button>
            ))}
          </Stack>
        )}
      </div>
    </div>
  );
}

function StatChips({ stats }: { stats: Project['stats'] }) {
  if (stats.roundNumber === null) {
    return (
      <Text size="xs" c="dimmed">
        Nincs nyitott kör.
      </Text>
    );
  }
  const total = stats.open + stats.inProgress + stats.done;
  return (
    <Stack gap={8}>
      <Group gap={6}>
        <Badge variant="outline" color="gray" size="sm">
          {stats.roundNumber}. kör
        </Badge>
        {total === 0 ? (
          <Text size="xs" c="dimmed">
            még nincs komment
          </Text>
        ) : (
          <>
            <Badge variant="light" color="orange" size="sm">
              {stats.open} nyitott
            </Badge>
            <Badge variant="light" color="brand" size="sm">
              {stats.inProgress} folyamatban
            </Badge>
            <Badge variant="light" color="green" size="sm">
              {stats.done} kész
            </Badge>
          </>
        )}
        {stats.approved && (
          <Badge color="green" variant="filled" size="sm">
            ✓ jóváhagyva
          </Badge>
        )}
      </Group>
      {total > 0 && (
        <div className="stack-bar thin" aria-hidden="true">
          <span style={{ width: `${(stats.open / total) * 100}%`, background: 'var(--mantine-color-orange-5)' }} />
          <span style={{ width: `${(stats.inProgress / total) * 100}%`, background: 'var(--mantine-color-brand-6)' }} />
          <span style={{ width: `${(stats.done / total) * 100}%`, background: 'var(--mantine-color-green-6)' }} />
        </div>
      )}
    </Stack>
  );
}

export function ProjectsPage({ onOpenProject }: { onOpenProject: () => void }) {
  const { projects, setProjects, loadError, select, selected, query } = useDashboard();
  // A szerkesztő/létrehozó ablak: "new" vagy a szerkesztett projekt
  const [formFor, setFormFor] = useState<'new' | Project | null>(null);
  const [formOpen, setFormOpen] = useState(false);
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
  const [appearanceFor, setAppearanceFor] = useState<Project | null>(null);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const archivedCount = projects?.filter((p) => p.archivedAt !== null).length ?? 0;
  const needle = fold(query.trim());
  const visible = (projects ?? []).filter(
    (p) => (showArchived || p.archivedAt === null) && (needle === '' || fold(`${p.name} ${p.siteUrl}`).includes(needle)),
  );

  function openForm(target: 'new' | Project) {
    setFormFor(target);
    setFormOpen(true);
  }

  async function saveForm(name: string, siteUrl: string) {
    if (formFor === 'new' || formFor === null) {
      const created = await api.projects.create({ name, siteUrl });
      setProjects((prev) => [created, ...(prev ?? [])]);
      select(created.id);
    } else {
      const id = formFor.id;
      const updated = await api.projects.update(id, { name, siteUrl });
      setProjects((prev) => prev?.map((p) => (p.id === id ? updated : p)) ?? null);
    }
    setFormOpen(false);
  }

  async function toggleArchive(p: Project) {
    setActionError(null);
    try {
      const updated = await api.projects.setArchived(p.id, p.archivedAt === null);
      setProjects((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? null);
    } catch (e) {
      setActionError(describe(e));
    }
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

  function open(p: Project) {
    select(p.id);
    onOpenProject();
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <div>
          <Title order={2}>Projektek</Title>
          <Text size="sm" c="dimmed">
            {projects ? `${projects.filter((p) => p.archivedAt === null).length} aktív projekt` : 'Betöltés…'}
          </Text>
        </div>
        <Button onClick={() => openForm('new')}>Új projekt</Button>
      </Group>

      {actionError && (
        <Alert color="red" role="alert" withCloseButton onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}
      {loadError && (
        <Alert color="red" role="alert">
          A projektek betöltése nem sikerült.
        </Alert>
      )}

      {projects && projects.some((p) => p.archivedAt === null) && (
        <Overview projects={projects.filter((p) => p.archivedAt === null)} onOpen={open} />
      )}

      {archivedCount > 0 && (
        <Switch
          checked={showArchived}
          onChange={(e) => setShowArchived(e.currentTarget.checked)}
          label={`Archivált projektek mutatása (${archivedCount})`}
        />
      )}

      {projects && projects.length === 0 && (
        <div className="empty">
          <Text fw={600}>Még nincs projekted</Text>
          <Text size="sm" c="dimmed" mb="sm">
            Hozd létre az elsőt, és add át az ügyfélnek a megosztó tokent.
          </Text>
          <Button onClick={() => openForm('new')}>Első projekt létrehozása</Button>
        </div>
      )}
      {projects && projects.length > 0 && visible.length === 0 && (
        <Text size="sm" c="dimmed">
          Nincs a keresésnek megfelelő projekt.
        </Text>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="md">
        {visible.map((p) => (
          <Card key={p.id} withBorder padding="lg" className="project-card" data-selected={selected?.id === p.id || undefined} style={p.archivedAt ? { opacity: 0.7 } : undefined}>
            <Stack gap="md" h="100%" justify="space-between">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    <div className="project-mark" aria-hidden="true">
                      {(p.name.trim()[0] ?? '?').toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <Group gap={6} wrap="nowrap">
                        <Title order={3} lineClamp={1}>
                          {p.name}
                        </Title>
                        {p.archivedAt && (
                          <Badge color="gray" variant="light" size="sm">
                            archivált
                          </Badge>
                        )}
                      </Group>
                      <Anchor href={p.siteUrl} target="_blank" rel="noopener noreferrer" size="xs" c="dimmed" lineClamp={1}>
                        {p.siteUrl}
                      </Anchor>
                    </div>
                  </Group>
                  {p.role === 'OWNER' ? (
                    <Menu position="bottom-end" withinPortal>
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray" size="md" aria-label={`${p.name} műveletei`}>
                          <DotsIcon />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item onClick={() => openForm(p)}>Szerkesztés</Menu.Item>
                        <Menu.Item onClick={() => void exportAll(p)}>Összes komment (CSV)</Menu.Item>
                        <Menu.Item
                          onClick={() => {
                            setRegenerating(p);
                            setRegenerateOpen(true);
                          }}
                        >
                          Új token generálása
                        </Menu.Item>
                        <Menu.Item onClick={() => void toggleArchive(p)}>
                          {p.archivedAt ? 'Visszaállítás az aktívak közé' : 'Archiválás'}
                        </Menu.Item>
                        <Menu.Item
                          onClick={() => {
                            setAppearanceFor(p);
                            setAppearanceOpen(true);
                          }}
                        >
                          A widget megjelenése és nyelve
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
                    <Badge variant="light" color="gray" size="sm" title={`Tulajdonos: ${p.ownerName}`}>
                      meghívott tag
                    </Badge>
                  )}
                </Group>
                <StatChips stats={p.stats} />
              </Stack>
              <Group justify="space-between" align="center">
                {p.role === 'MEMBER' ? (
                  <Text size="xs" c="dimmed">
                    Tulajdonos: {p.ownerName}
                  </Text>
                ) : (
                  <span />
                )}
                <Button size="compact-sm" variant="light" onClick={() => open(p)}>
                  Megnyitás
                </Button>
              </Group>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      <Modal
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        title={formFor === 'new' || formFor === null ? 'Új projekt' : 'Projekt szerkesztése'}
        centered
      >
        {formOpen && (
          <ProjectForm
            initial={formFor === 'new' || formFor === null ? undefined : formFor}
            submitLabel={formFor === 'new' || formFor === null ? 'Projekt létrehozása' : 'Mentés'}
            onSubmit={saveForm}
            onCancel={() => setFormOpen(false)}
          />
        )}
      </Modal>

      <WidgetAppearanceModal
        project={projects?.find((x) => x.id === appearanceFor?.id) ?? appearanceFor}
        opened={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
        onChanged={(updated) => setProjects((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? null)}
      />

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
