import { useEffect, useState } from 'react';
import { Alert, Button, Group, Modal, PasswordInput, Stack, Text } from '@mantine/core';
import { api, ApiError, type Project } from './api';
import { t } from './i18n';

/**
 * A widget jelszavas védelme: bekapcsolva az ügyfélnek a widget használata előtt meg kell adnia a jelszót, és a widget
 * addig semmit nem mutat belőle (a megosztó token az oldal forrásában úgyis látszik, ez az utolsó kapu). A jelszót csak
 * hash-ként tároljuk, és nem olvasható vissza; csere vagy törlés után az ügyfeleknek újra be kell írniuk.
 */
export function WidgetAccessModal({
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
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      setPassword('');
      setError(null);
    }
  }, [opened, project?.id]);

  if (!project) return null;
  const protectedNow = project.widgetProtected;

  async function save(next: string | null) {
    if (!project) return;
    setBusy(true);
    setError(null);
    try {
      onChanged(await api.projects.setWidgetPassword(project.id, next));
      setPassword('');
      if (next === null) onClose();
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 400
          ? t('A jelszó 4–72 karakter legyen.')
          : t('A mentés nem sikerült, próbáld újra később.'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={t('Widget jelszó')} centered>
      <Stack>
        <Text size="sm">
          {t('Jelszóval védett widgetnél az ügyfélnek először meg kell adnia a jelszót. Addig a widget nem mutat visszajelzést, és nem fogad el újat.')}
        </Text>
        <Text size="sm" fw={500}>
          {protectedNow ? t('A védelem be van kapcsolva.') : t('A védelem ki van kapcsolva.')}
        </Text>
        <PasswordInput
          label={protectedNow ? t('Új jelszó') : t('Jelszó')}
          description={t('Add át az ügyfélnek a jelszót a megosztó tokentől külön. Nem olvasható vissza.')}
          value={password}
          maxLength={72}
          onChange={(e) => setPassword(e.currentTarget.value)}
          data-autofocus
        />
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        <Group>
          <Button loading={busy} disabled={password.length < 4} onClick={() => save(password)}>
            {protectedNow ? t('Jelszó cseréje') : t('Védelem bekapcsolása')}
          </Button>
          {protectedNow && (
            <Button variant="subtle" color="red" loading={busy} onClick={() => save(null)}>
              {t('Kikapcsolás')}
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
