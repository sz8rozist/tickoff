import { useEffect, useState } from 'react';
import { Alert, Button, Code, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { api, ApiError, type Project } from './api';
import { t } from './i18n';

const GITHUB_TEMPLATE = 'https://github.com/SZERVEZET/REPO/issues/new?title={title}&body={body}';

function saveError(e: unknown): string {
  if (e instanceof ApiError && e.status === 400) return t('Érvénytelen sablon: https:// kezdetű legyen, és tartalmazza a {title} helyőrzőt.');
  if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return t('Ehhez csak a projekt tulajdonosa jogosult.');
  return t('A mentés nem sikerült, próbáld újra később.');
}

/**
 * A hibajegy-követő beállítása: egy URL-sablon, amelyből a komment mellett a "Hibajegy létrehozása" gomb előtöltött
 * új-hibajegy oldalt nyit. Nincs kulcs és nincs kimenő kérés: a böngésző nyitja meg a kitöltött címet.
 */
export function TrackerModal({
  project,
  opened,
  onClose,
  onChanged,
}: {
  project: Project | null;
  opened: boolean;
  onClose: () => void;
  onChanged: (updated: Project) => void;
}) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      setUrl(project?.trackerUrl ?? '');
      setError(null);
    }
  }, [opened, project?.id, project?.trackerUrl]);

  if (!project) return null;

  async function save(next: string | null) {
    if (!project) return;
    setBusy(true);
    setError(null);
    try {
      onChanged(await api.projects.setTracker(project.id, next));
      if (next === null) setUrl('');
    } catch (e) {
      setError(saveError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={t('Hibajegy-követő')} size="lg" centered>
      <Stack>
        <Text size="sm">
          {t('Add meg a követőd „új hibajegy” címét sablonként. A komment mellett megjelenik a Hibajegy létrehozása gomb, amely az előtöltött oldalt nyitja meg a böngészőben. Nincs kulcs, és a szerver nem hív meg semmit.')}
        </Text>
        <TextInput
          label={t('URL-sablon')}
          placeholder={GITHUB_TEMPLATE}
          value={url}
          maxLength={500}
          onChange={(e) => setUrl(e.currentTarget.value)}
          description={t('Helyőrzők: {title} (cím), {body} (leírás), {url} (a komment mélylinkje).')}
        />
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            {t('Minta:')}
          </Text>
          <Button size="compact-xs" variant="light" onClick={() => setUrl(GITHUB_TEMPLATE)}>
            GitHub
          </Button>
          <Text size="xs" c="dimmed">
            {t('Linear, Jira vagy más követő: másold be az új hibajegy oldalának címét, és a címben cseréld a szöveget a helyőrzőkre.')}
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          {t('Példa:')} <Code>https://github.com/szervezet/repo/issues/new?title={'{title}'}&body={'{body}'}</Code>
        </Text>
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        <Group>
          <Button loading={busy} disabled={url.trim() === '' || url.trim() === project.trackerUrl} onClick={() => save(url.trim())}>
            {t('Mentés')}
          </Button>
          {project.trackerUrl && (
            <Button variant="subtle" color="red" loading={busy} onClick={() => save(null)}>
              {t('Kikapcsolás')}
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
