import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Group, Loader, Stack, Text } from '@mantine/core';
import { api, type ActivityEntry } from './api';
import { locale, t } from './i18n';

const dateTime = (iso: string) => new Date(iso).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' });

/** A projekt tevékenységnaplója: ki mit csinált, újabb elöl. 50 bejegyzésenként tölt tovább. */
export function ActivityPanel({ projectId }: { projectId: number }) {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.activity
      .list(projectId)
      .then((list) => {
        setEntries(list);
        setMore(list.length >= 50);
      })
      .catch(() => setError(true));
  }, [projectId]);

  async function loadMore() {
    if (!entries || entries.length === 0) return;
    setLoadingMore(true);
    try {
      const next = await api.activity.list(projectId, entries[entries.length - 1].id);
      setEntries([...entries, ...next]);
      setMore(next.length >= 50);
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  if (error && !entries) {
    return (
      <Alert color="red" role="alert">
        {t('A tevékenységnapló betöltése nem sikerült.')}</Alert>
    );
  }
  if (!entries) return <Loader size="xs" />;
  if (entries.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t('Még nincs rögzített tevékenység.')}</Text>
    );
  }

  return (
    <Stack gap="xs">
      {entries.map((e) => (
        <Group key={e.id} gap="xs" wrap="nowrap" align="flex-start">
          <Text size="xs" c="dimmed" w={96} style={{ flex: 'none' }}>
            {dateTime(e.createdAt)}
          </Text>
          <Badge size="xs" variant="light" color={e.actorType === 'CUSTOMER' ? 'gray' : 'brand'} style={{ flex: 'none' }}>
            {e.actorType === 'CUSTOMER' ? t('ügyfél') : 'csapat'}
          </Badge>
          <Text size="sm">
            <b>{e.actorName}</b> {e.summary}
          </Text>
        </Group>
      ))}
      {error && (
        <Alert color="red" role="alert">
          {t('A további bejegyzések betöltése nem sikerült.')}</Alert>
      )}
      {more && (
        <div>
          <Button size="compact-xs" variant="light" loading={loadingMore} onClick={loadMore}>
            {t('Régebbiek betöltése')}</Button>
        </div>
      )}
    </Stack>
  );
}
