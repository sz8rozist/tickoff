import { useState } from 'react';
import { Alert, Anchor, Badge, Button, Code, CopyButton, Group, Stack, Tabs, Text, Title } from '@mantine/core';
import { api, type Project } from './api';
import { useDashboard } from './DashboardContext';
import { saveBlob } from './download';
import { ActivityPanel } from './ActivityPanel';
import { MembersPanel } from './MembersPanel';
import { RoundsPanel } from './RoundsPanel';
import { t } from './i18n';

/** A kiválasztott projekt munkafelülete: összesítő csempék, körök és kommentek, tagok, tevékenység. */
export function FeedbackPage({ currentUserId, onGoProjects }: { currentUserId: number; onGoProjects: () => void }) {
  const { selected: p, setProjects } = useDashboard();
  const [error, setError] = useState<string | null>(null);

  if (!p) {
    return (
      <div className="empty">
        <Text fw={600}>{t('Nincs kiválasztott projekt')}</Text>
        <Text size="sm" c="dimmed" mb="sm">
          {t('Hozz létre egy projektet, vagy válassz egyet a felső sávban.')}</Text>
        <Button onClick={onGoProjects}>{t('Projektek megnyitása')}</Button>
      </div>
    );
  }

  async function exportAll(project: Project) {
    setError(null);
    try {
      const { blob, filename } = await api.comments.exportCsv(project.id);
      saveBlob(blob, filename);
    } catch {
      setError(t('Az export nem sikerült, próbáld újra később.'));
    }
  }

  const s = p.stats;
  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
          <div className="project-mark lg" aria-hidden="true">
            {(p.name.trim()[0] ?? '?').toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <Title order={2} lineClamp={1}>
              {p.name}
            </Title>
            <Anchor href={p.siteUrl} target="_blank" rel="noopener noreferrer" size="sm" c="dimmed">
              {p.siteUrl}
            </Anchor>
          </div>
        </Group>
        <div className="token-bar">
          <Text size="xs" c="dimmed" fw={500}>
            {t('Megosztó token')}</Text>
          <Code>{p.shareToken}</Code>
          <CopyButton value={p.shareToken}>
            {({ copied, copy }) => (
              <Button variant="light" size="compact-xs" onClick={copy}>
                {copied ? t('Másolva') : t('Másolás')}
              </Button>
            )}
          </CopyButton>
          <Button variant="subtle" color="gray" size="compact-xs" onClick={() => void exportAll(p)}>
            {t('CSV export')}</Button>
        </div>
      </Group>

      {error && (
        <Alert color="red" role="alert" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div className="bento bento-4">
        <div className="tile">
          <Text className="tile-label">{t('Nyitott')}</Text>
          <div className="tile-value" style={{ color: s.open > 0 ? 'var(--mantine-color-orange-6)' : undefined }}>
            {s.open}
          </div>
        </div>
        <div className="tile">
          <Text className="tile-label">{t('Folyamatban')}</Text>
          <div className="tile-value" style={{ color: 'var(--mantine-color-brand-6)' }}>
            {s.inProgress}
          </div>
        </div>
        <div className="tile">
          <Text className="tile-label">{t('Megoldott')}</Text>
          <div className="tile-value" style={{ color: 'var(--mantine-color-green-6)' }}>
            {s.done}
          </div>
        </div>
        <div className="tile">
          <Text className="tile-label">{t('Aktuális kör')}</Text>
          <div className="tile-value">{s.roundNumber === null ? '–' : `${s.roundNumber}.`}</div>
          {s.approved && (
            <Badge color="green" variant="filled" size="sm">
              {t('✓ jóváhagyva')}</Badge>
          )}
        </div>
      </div>

      <div className="panel-card">
        <Tabs defaultValue="rounds" keepMounted={false} key={p.id}>
          <Tabs.List>
            <Tabs.Tab value="rounds">{t('Visszajelzések')}</Tabs.Tab>
            <Tabs.Tab value="members">{t('Tagok')}</Tabs.Tab>
            <Tabs.Tab value="activity">{t('Tevékenység')}</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="rounds" pt="md">
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
          <Tabs.Panel value="activity" pt="md">
            <ActivityPanel projectId={p.id} />
          </Tabs.Panel>
          <Tabs.Panel value="members" pt="md">
            <MembersPanel
              projectId={p.id}
              role={p.role}
              currentUserId={currentUserId}
              onLeft={() => setProjects((prev) => prev?.filter((x) => x.id !== p.id) ?? null)}
              onTransferred={(newOwnerName) =>
                setProjects((prev) => prev?.map((x) => (x.id === p.id ? { ...x, role: 'MEMBER', ownerName: newOwnerName } : x)) ?? null)
              }
            />
          </Tabs.Panel>
        </Tabs>
      </div>
    </Stack>
  );
}
