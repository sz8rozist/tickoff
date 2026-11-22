import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Checkbox, Group, Loader, Modal, Progress, Stack, Text } from '@mantine/core';
import { api, ApiError, type Member, type Round } from './api';
import { CommentsPanel } from './CommentsPanel';
import { saveBlob } from './download';

function describe(e: unknown): string {
  if (e instanceof ApiError && e.status === 409) {
    return 'A körök állapota közben megváltozott, frissítettük a listát.';
  }
  return 'Nem sikerült, próbáld újra később.';
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('hu-HU');

export function RoundsPanel({ projectId, currentUserId }: { projectId: number; currentUserId: number }) {
  const [rounds, setRounds] = useState<Round[] | null>(null);
  // A felelős-választóhoz: a csapat tagjai (egyszer töltjük le, minden kör kommentjei ezt használják)
  const [team, setTeam] = useState<Member[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newRoundOpen, setNewRoundOpen] = useState(false);
  const [carryOver, setCarryOver] = useState(true);

  const reload = () => api.rounds.list(projectId).then(setRounds);

  useEffect(() => {
    api.members.list(projectId).then(setTeam).catch(() => undefined);
  }, [projectId]);

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
  // Az utolsó (lezárt) kör még nem kész kommentjei: ezeket lehet átvinni az új körbe
  const last = rounds[rounds.length - 1];
  const unresolved = last && last.status === 'CLOSED' ? last.openCommentCount : 0;

  return (
    <Stack gap="sm">
      {rounds.map((r) => (
        <div key={r.id} className="round-row" data-open={r.status === 'OPEN'}>
          <Group justify="space-between" gap="sm">
            <Group gap="sm">
              <Text fw={700}>{r.number}. kör</Text>
              {r.status === 'OPEN' ? (
                <Badge color="teal" variant="light">
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
              {r.approvedAt && (
                <Badge color="teal" variant="filled" title={`Jóváhagyta: ${r.approvedBy ?? ''}`}>
                  ✓ az ügyfél jóváhagyta{r.approvedBy ? ` (${r.approvedBy})` : ''}
                </Badge>
              )}
            </Group>
            <Group gap={4}>
              <Button size="compact-xs" variant="subtle" onClick={() => toggle(r.id)}>
                {expanded.has(r.id) ? 'Kommentek elrejtése' : 'Kommentek'}
              </Button>
              {r.commentCount > 0 && (
                <Button size="compact-xs" variant="subtle" color="gray" disabled={busy} onClick={() => exportCsv(r.id)}>
                  Export (CSV)
                </Button>
              )}
              {r.status === 'OPEN' && (
                <Button size="compact-xs" variant="default" disabled={busy} onClick={() => run(() => api.rounds.close(projectId, r.id))}>
                  Kör lezárása
                </Button>
              )}
            </Group>
          </Group>
          {r.commentCount > 0 && (
            <Progress
              mt="xs"
              size={5}
              color="teal"
              value={((r.commentCount - r.openCommentCount) / r.commentCount) * 100}
              aria-label="Lezárt kommentek aránya"
            />
          )}
          {expanded.has(r.id) && (
            <CommentsPanel
              projectId={projectId}
              roundId={r.id}
              roundOpen={r.status === 'OPEN'}
              team={team}
              currentUserId={currentUserId}
              onChanged={() => void reload()}
            />
          )}
        </div>
      ))}
      {!open && (
        <div>
          <Button
            size="xs"
            disabled={busy}
            onClick={() => (unresolved > 0 ? setNewRoundOpen(true) : run(() => api.rounds.open(projectId)))}
          >
            Új kör nyitása
          </Button>
        </div>
      )}
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}

      <Modal opened={newRoundOpen} onClose={() => setNewRoundOpen(false)} title="Új kör nyitása" centered>
        <Stack>
          <Text size="sm">
            Az előző körben {unresolved} komment még nincs kész. A widget csak a nyitott kör kommentjeit mutatja, ezért ha
            nem viszed át őket, az ügyfélnek újra be kell küldenie, ami még aktuális.
          </Text>
          <Checkbox
            checked={carryOver}
            onChange={(e) => setCarryOver(e.currentTarget.checked)}
            label={`A nem kész kommentek átvitele az új körbe (${unresolved} db)`}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setNewRoundOpen(false)}>
              Mégse
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                setNewRoundOpen(false);
                void run(() => api.rounds.open(projectId, carryOver));
              }}
            >
              Kör nyitása
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
