import { useEffect, useState } from 'react';
import { Alert, Button, Code, CopyButton, Group, Loader, Modal, Stack, Text, TextInput } from '@mantine/core';
import { api, ApiError, type ApiKeyInfo } from './api';

const dateTime = (iso: string) => new Date(iso).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' });

/** Az API-kulcsok kezelése: a nyilvános, csak olvasható API-hoz (más rendszerek integrálásához). */
export function ApiKeysModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [keys, setKeys] = useState<ApiKeyInfo[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A frissen létrehozott kulcs: csak most látható, bezáráskor eltűnik
  const [created, setCreated] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    setError(null);
    setCreated(null);
    api.apiKeys.list().then(setKeys).catch(() => setError('A kulcsok betöltése nem sikerült.'));
  }, [opened]);

  async function create() {
    if (name.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      const k = await api.apiKeys.create(name.trim());
      setCreated(k.key);
      setKeys((prev) => [k, ...(prev ?? [])]);
      setName('');
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? 'Legfeljebb 10 kulcs lehet. Törölj egyet.' : 'A kulcs létrehozása nem sikerült.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setError(null);
    try {
      await api.apiKeys.remove(id);
      setKeys((prev) => prev?.filter((k) => k.id !== id) ?? null);
    } catch {
      setError('A kulcs törlése nem sikerült.');
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="API-kulcsok" size="lg" centered>
      <Stack>
        <Text size="sm">
          Az API-kulccsal más rendszerek <b>csak olvashatják</b> a projektjeid visszajelzéseit (
          <Code>GET /api/v1/projects</Code>, <Code>GET /api/v1/projects/&#123;id&#125;/comments</Code>). A kulcs a te
          jogaiddal dolgozik, ezért kezeld jelszóként.
        </Text>

        {created && (
          <Alert color="green" title="Másold ki most, később nem látható">
            <Group gap="xs" wrap="nowrap">
              <Code style={{ wordBreak: 'break-all' }}>{created}</Code>
              <CopyButton value={created}>
                {({ copied, copy }) => (
                  <Button size="compact-xs" variant="light" onClick={copy}>
                    {copied ? 'Másolva' : 'Másolás'}
                  </Button>
                )}
              </CopyButton>
            </Group>
          </Alert>
        )}

        <Group align="flex-end" wrap="nowrap">
          <TextInput
            label="Új kulcs neve"
            placeholder="pl. Jira-integráció"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button loading={busy} disabled={name.trim() === ''} onClick={create}>
            Létrehozás
          </Button>
        </Group>

        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        {!keys ? (
          <Loader size="xs" />
        ) : keys.length === 0 ? (
          <Text size="sm" c="dimmed">
            Még nincs API-kulcsod.
          </Text>
        ) : (
          <Stack gap="xs">
            {keys.map((k) => (
              <Group key={k.id} justify="space-between" wrap="nowrap">
                <div>
                  <Text size="sm" fw={600}>
                    {k.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    <Code>{k.prefix}…</Code> · létrehozva: {dateTime(k.createdAt)} ·{' '}
                    {k.lastUsedAt ? `utoljára: ${dateTime(k.lastUsedAt)}` : 'még nem használták'}
                  </Text>
                </div>
                <Button size="compact-xs" variant="subtle" color="red" onClick={() => void remove(k.id)}>
                  Törlés
                </Button>
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
