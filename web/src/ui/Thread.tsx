import { useState, type FormEvent } from 'react';
import { Alert, Badge, Box, Button, Group, Stack, Text, Textarea } from '@mantine/core';
import { ApiError, type Reply } from './api';
import { locale, t } from './i18n';

const dateTime = (iso: string) => new Date(iso).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' });

function errorMessage(e: unknown): string {
  if (e instanceof ApiError && e.status === 409) return t('Ehhez a kommenthez már nem fűzhető több válasz.');
  if (e instanceof ApiError && e.status === 400) return t('A válasz nem lehet üres, és legfeljebb 4000 karakter lehet.');
  return t('A válasz elküldése nem sikerült, próbáld újra később.');
}

/** A komment válaszai időrendben, alatta a válasz-űrlap. */
export function Thread({
  replies,
  onAdd,
  onRemove,
}: {
  replies: Reply[];
  onAdd: (body: string) => Promise<void>;
  onRemove: (replyId: number) => Promise<void>;
}) {
  const [writing, setWriting] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Törlésnél második kattintás kell: elkerüli a véletlen törlést megerősítő ablak nélkül
  const [confirmId, setConfirmId] = useState<number | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (body.trim() === '') return;
    setError(null);
    setBusy(true);
    try {
      await onAdd(body.trim());
      setBody('');
      setWriting(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (confirmId !== id) {
      setConfirmId(id);
      window.setTimeout(() => setConfirmId((cur) => (cur === id ? null : cur)), 4000);
      return;
    }
    setConfirmId(null);
    try {
      await onRemove(id);
    } catch {
      setError(t('A válasz törlése nem sikerült.'));
    }
  }

  return (
    <Stack gap={6}>
      {replies.length > 0 && (
        <Stack gap={8} pl="sm" className="thread">
          {replies.map((r) => (
            <Box key={r.id}>
              <Group gap={6} align="center">
                <Text size="xs" fw={600}>
                  {r.authorName}
                </Text>
                {r.authorType === 'DESIGNER' && (
                  <Badge size="xs" variant="light">
                    {t('csapat')}</Badge>
                )}
                <Text size="xs" c="dimmed">
                  {dateTime(r.createdAt)}
                </Text>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="red"
                  onClick={() => remove(r.id)}
                  aria-label={t('Válasz törlése: {authorName}', { authorName: r.authorName })}
                >
                  {confirmId === r.id ? 'Biztosan?' : t('Törlés')}
                </Button>
              </Group>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {r.body}
              </Text>
            </Box>
          ))}
        </Stack>
      )}

      {error && !writing && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}

      {writing ? (
        <form onSubmit={submit}>
          <Stack gap="xs">
            <Textarea
              placeholder={t('Válasz írása…')}
              autosize
              minRows={2}
              maxRows={8}
              maxLength={4000}
              value={body}
              onChange={(e) => setBody(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void submit(e);
              }}
              data-autofocus
              autoFocus
            />
            {error && (
              <Alert color="red" role="alert">
                {error}
              </Alert>
            )}
            <Group gap="xs">
              <Button type="submit" size="xs" loading={busy} disabled={body.trim() === ''}>
                {t('Válasz küldése')}</Button>
              <Button
                size="xs"
                variant="default"
                disabled={busy}
                onClick={() => {
                  setWriting(false);
                  setError(null);
                }}
              >
                {t('Mégse')}</Button>
            </Group>
          </Stack>
        </form>
      ) : (
        <div>
          <Button size="compact-xs" variant="light" onClick={() => setWriting(true)}>
            {t('Válasz')}</Button>
        </div>
      )}
    </Stack>
  );
}
