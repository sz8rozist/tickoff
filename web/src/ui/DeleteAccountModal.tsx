import { useState, type FormEvent } from 'react';
import { Alert, Button, Group, Modal, PasswordInput, Stack, Text } from '@mantine/core';
import { api, ApiError } from './api';

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 403) return 'Hibás jelszó.';
    if (e.status === 429) return 'Túl sok próbálkozás. Várj egy percet, és próbáld újra.';
  }
  return 'A fiók törlése nem sikerült, próbáld újra később.';
}

export function DeleteAccountModal({
  opened,
  onClose,
  onDeleted,
}: {
  opened: boolean;
  onClose: () => void;
  /** A fiók törlése után a kliens kijelentkezik. */
  onDeleted: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    if (busy) return;
    setPassword('');
    setError(null);
    onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.account.remove(password);
      onDeleted();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal opened={opened} onClose={close} title="Fiók törlése" centered>
      <form onSubmit={submit}>
        <Stack>
          <Text size="sm">
            A fiókod és <b>minden projekted</b> (a körökkel, kommentekkel és képernyőképekkel együtt) véglegesen
            törlődik, a meghívott tagok számára is megszűnnek. Ez nem vonható vissza, és a projektjeidhez
            beágyazott widgetek leállnak. A más projektjeiben írt válaszaid megmaradnak, a neveddel.
          </Text>
          <PasswordInput
            label="Jelszó a megerősítéshez"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            autoComplete="current-password"
            data-autofocus
          />
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={close} disabled={busy}>
              Mégse
            </Button>
            <Button type="submit" color="red" loading={busy} disabled={password === ''}>
              Fiók végleges törlése
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
