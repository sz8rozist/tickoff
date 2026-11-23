import { useState, type FormEvent } from 'react';
import { Alert, Button, Group, Modal, PasswordInput, Stack, Text } from '@mantine/core';
import { api, ApiError } from './api';
import { t } from './i18n';

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 403) return t('Hibás jelszó.');
    if (e.status === 429) return t('Túl sok próbálkozás. Várj egy percet, és próbáld újra.');
  }
  return t('A fiók törlése nem sikerült, próbáld újra később.');
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
    <Modal opened={opened} onClose={close} title={t('Fiók törlése')} centered>
      <form onSubmit={submit}>
        <Stack>
          <Text size="sm">
            {t('A fiókod és')}{' '}<b>{t('minden projekted')}</b> {t('(a körökkel, kommentekkel és képernyőképekkel együtt) véglegesen törlődik, a meghívott tagok számára is megszűnnek. Ez nem vonható vissza, és a projektjeidhez beágyazott widgetek leállnak. A más projektjeiben írt válaszaid megmaradnak, a neveddel.')}</Text>
          <PasswordInput
            label={t('Jelszó a megerősítéshez')}
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
              {t('Mégse')}</Button>
            <Button type="submit" color="red" loading={busy} disabled={password === ''}>
              {t('Fiók végleges törlése')}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
