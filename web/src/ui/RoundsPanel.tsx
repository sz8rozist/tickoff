import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Checkbox, Group, Loader, Modal, Progress, Stack, Text, TextInput } from '@mantine/core';
import { api, ApiError, type Member, type Round } from './api';
import { CommentsPanel } from './CommentsPanel';
import { saveBlob } from './download';
import { locale, t } from './i18n';

function describe(e: unknown): string {
  if (e instanceof ApiError && e.status === 409) {
    return t('A körök állapota közben megváltozott, frissítettük a listát.');
  }
  return t('Nem sikerült, próbáld újra később.');
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale());

export function RoundsPanel({
  projectId,
  currentUserId,
  onActivity,
}: {
  projectId: number;
  currentUserId: number;
  /** A körök vagy kommentek állapota megváltozott: a projekt összesítőjét frissíteni kell. */
  onActivity?: () => void;
}) {
  const [rounds, setRounds] = useState<Round[] | null>(null);
  // A felelős-választóhoz: a csapat tagjai (egyszer töltjük le, minden kör kommentjei ezt használják)
  const [team, setTeam] = useState<Member[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newRoundOpen, setNewRoundOpen] = useState(false);
  const [carryOver, setCarryOver] = useState(true);

  const reload = () =>
    api.rounds.list(projectId).then((list) => {
      setRounds(list);
      onActivity?.();
    });

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
      .catch(() => setError(t('A körök betöltése nem sikerült.')));
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

  /** A riportot lekérjük (JWT kell hozzá), és új lapon nyitjuk meg; onnan nyomtatható vagy PDF-be menthető. */
  async function openReport(roundId: number, internal: boolean) {
    setError(null);
    // Az új lapot a kattintás pillanatában nyitjuk (a böngésző a háttérből indított ablakot blokkolná)
    const tab = window.open('', '_blank');
    try {
      const blob = await api.rounds.report(projectId, roundId, internal);
      const url = URL.createObjectURL(new Blob([blob], { type: 'text/html;charset=utf-8' }));
      if (tab) tab.location.href = url;
      else window.open(url, '_blank');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      tab?.close();
      setError(t('A riport elkészítése nem sikerült, próbáld újra később.'));
    }
  }

  async function exportCsv(roundId: number) {
    setError(null);
    try {
      const { blob, filename } = await api.comments.exportCsv(projectId, roundId);
      saveBlob(blob, filename);
    } catch {
      setError(t('Az export nem sikerült, próbáld újra később.'));
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
              <Text fw={600}>{r.number}{t('. kör')}</Text>
              {r.status === 'OPEN' ? (
                <Badge color="green" variant="light">
                  {t('nyitott')}</Badge>
              ) : (
                <Badge color="gray" variant="light">
                  {t('lezárva ·')}{' '}{fmt(r.closedAt!)}
                </Badge>
              )}
              <Text size="xs" c="dimmed">
                {r.commentCount} {t('komment')}{r.commentCount > 0 && t(' · {openCommentCount} nyitott', { openCommentCount: r.openCommentCount })}
              </Text>
              {r.approvedAt && (
                <Badge color="green" variant="filled" title={t('Jóváhagyta: {approvedBy}', { approvedBy: r.approvedBy ?? '' })}>
                  {t('✓ az ügyfél jóváhagyta')}{r.approvedBy ? ` (${r.approvedBy})` : ''}
                </Badge>
              )}
            </Group>
            <Group gap={4}>
              <Button size="compact-xs" variant="subtle" onClick={() => toggle(r.id)}>
                {expanded.has(r.id) ? t('Kommentek elrejtése') : 'Kommentek'}
              </Button>
              {r.commentCount > 0 && (
                <>
                  <Button size="compact-xs" variant="subtle" color="gray" disabled={busy} onClick={() => exportCsv(r.id)}>
                    {t('Export (CSV)')}</Button>
                  <Button size="compact-xs" variant="subtle" onClick={() => void openReport(r.id, false)}>
                    {t('Riport')}</Button>
                  <Button size="compact-xs" variant="subtle" color="gray" onClick={() => void openReport(r.id, true)}>
                    {t('Belső riport')}</Button>
                </>
              )}
              {r.status === 'OPEN' && (
                <Button size="compact-xs" variant="default" disabled={busy} onClick={() => run(() => api.rounds.close(projectId, r.id))}>
                  {t('Kör lezárása')}</Button>
              )}
            </Group>
          </Group>
          {r.status === 'OPEN' && (
            <Group gap="xs" mt="xs">
              <TextInput
                type="date"
                size="xs"
                label={t('Határidő')}
                value={r.dueDate ?? ''}
                disabled={busy}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  void run(() => api.rounds.setDueDate(projectId, r.id, v === '' ? null : v));
                }}
                style={{ maxWidth: 170 }}
              />
              {r.dueDate && new Date(r.dueDate + 'T23:59:59') < new Date() && (
                <Badge color="red" variant="light" mt={18}>
                  {t('lejárt')}</Badge>
              )}
              <Text size="xs" c="dimmed" mt={18}>
                {t('Az ügyfél a widgetben látja. Tájékoztató: a lejárta nem zárja le a kört.')}</Text>
            </Group>
          )}
          {r.commentCount > 0 && (
            <Progress
              mt="xs"
              size={5}
              color="green"
              value={((r.commentCount - r.openCommentCount) / r.commentCount) * 100}
              aria-label={t('Lezárt kommentek aránya')}
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
            {t('Új kör nyitása')}</Button>
        </div>
      )}
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}

      <Modal opened={newRoundOpen} onClose={() => setNewRoundOpen(false)} title={t('Új kör nyitása')} centered>
        <Stack>
          <Text size="sm">
            {t('Az előző körben')}{' '}{unresolved} {t('komment még nincs kész. A widget csak a nyitott kör kommentjeit mutatja, ezért ha nem viszed át őket, az ügyfélnek újra be kell küldenie, ami még aktuális.')}</Text>
          <Checkbox
            checked={carryOver}
            onChange={(e) => setCarryOver(e.currentTarget.checked)}
            label={t('A nem kész kommentek átvitele az új körbe ({unresolved} db)', { unresolved: unresolved })}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setNewRoundOpen(false)}>
              {t('Mégse')}</Button>
            <Button
              disabled={busy}
              onClick={() => {
                setNewRoundOpen(false);
                void run(() => api.rounds.open(projectId, carryOver));
              }}
            >
              {t('Kör nyitása')}</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
