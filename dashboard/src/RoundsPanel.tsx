import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Group, Loader, Stack, Text } from '@mantine/core';
import { api, ApiError, type Round } from './api';

function describe(e: unknown): string {
  if (e instanceof ApiError && e.status === 409) {
    return 'A körök állapota közben megváltozott, frissítettük a listát.';
  }
  return 'Nem sikerült, próbáld újra később.';
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('hu-HU');

export function RoundsPanel({ projectId }: { projectId: number }) {
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = () => api.rounds.list(projectId).then(setRounds);

  useEffect(() => {
    reload().catch(() => setError('A körök betöltése nem sikerült.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

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
        <Group key={r.id} gap="sm">
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
          {r.status === 'OPEN' && (
            <Button size="compact-xs" variant="default" disabled={busy} onClick={() => run(() => api.rounds.close(projectId, r.id))}>
              Kör lezárása
            </Button>
          )}
        </Group>
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
