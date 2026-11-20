import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Group, Loader, Stack, Text } from '@mantine/core';
import { api, ApiError, type Round } from './api';
import { CommentsPanel } from './CommentsPanel';
import { saveBlob } from './download';

function describe(e: unknown): string {
  if (e instanceof ApiError && e.status === 409) {
    return 'A körök állapota közben megváltozott, frissítettük a listát.';
  }
  return 'Nem sikerült, próbáld újra később.';
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('hu-HU');

export function RoundsPanel({ projectId }: { projectId: number }) {
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = () => api.rounds.list(projectId).then(setRounds);

  useEffect(() => {
    api.rounds
      .list(projectId)
      .then((list) => {
        setRounds(list);
        // Alapból a nyitott kör kommentjei látszanak.
        const open = list.find((r) => r.status === 'OPEN');
        if (open) setExpanded(new Set([open.id]));
      })
      .catch(() => setError('A körök betöltése nem sikerült.'));
  }, [projectId]);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await action();
      await reload();
    } catch (e) {
      setError(describe(e));
      // 409 esetén a szerver állapota a mérvadó
      await reload().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv(roundId: number) {
    setError(null);
    try {
      const { blob, filename } = await api.comments.exportCsv(projectId, roundId);
      saveBlob(blob, filename);
    } catch {
      setError('Az export nem sikerült, próbáld újra később.');
    }
  }

  if (!rounds) {
    return error ? (
      <Alert color="red" role="alert">
        {error}
      </Alert>
    ) : (
      <Loader size="xs" />
    );
  }

  const open = rounds.find((r) => r.status === 'OPEN');

  return (
    <Stack gap="xs" mt="xs">
      <Text fw={600} size="sm">
        Körök
      </Text>
      {rounds.map((r) => (
        <Stack key={r.id} gap={4}>
          <Group gap="sm">
            <Text size="sm" w={60}>
              {r.number}. kör
            </Text>
            {r.status === 'OPEN' ? (
              <Badge color="green" variant="light">
                nyitott
              </Badge>
            ) : (
              <Badge color="gray" variant="light">
                lezárva · {fmt(r.closedAt!)}
              </Badge>
            )}
            <Text size="xs" c="dimmed">
              {r.commentCount} komment
              {r.commentCount > 0 && ` · ${r.openCommentCount} nyitott`}
            </Text>
            <Button size="compact-xs" variant="subtle" onClick={() => toggle(r.id)}>
              {expanded.has(r.id) ? 'Kommentek elrejtése' : 'Kommentek'}
            </Button>
            {r.commentCount > 0 && (
              <Button size="compact-xs" variant="subtle" disabled={busy} onClick={() => exportCsv(r.id)}>
                Export (CSV)
              </Button>
            )}
            {r.status === 'OPEN' && (
              <Button size="compact-xs" variant="default" disabled={busy} onClick={() => run(() => api.rounds.close(projectId, r.id))}>
                Kör lezárása
              </Button>
            )}
          </Group>
          {expanded.has(r.id) && <CommentsPanel projectId={projectId} roundId={r.id} onChanged={() => void reload()} />}
        </Stack>
      ))}
      {!open && (
        <div>
          <Button size="xs" disabled={busy} onClick={() => run(() => api.rounds.open(projectId))}>
            Új kör nyitása
          </Button>
        </div>
      )}
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}
    </Stack>
  );
}
