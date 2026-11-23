import { useState } from 'react';
import { Alert, Avatar, Button, Group, SegmentedControl, Stack, Switch, Text, Title, useMantineColorScheme } from '@mantine/core';
import { api, type User } from './api';

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="setting-row">
      <div style={{ minWidth: 0 }}>
        <Text size="sm" fw={500}>
          {title}
        </Text>
        {hint && (
          <Text size="xs" c="dimmed">
            {hint}
          </Text>
        )}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

/** A fiók beállításai: értesítések, téma, biztonság, API-kulcsok, törlés. */
export function SettingsPage({
  user,
  onUser,
  onTwoFactor,
  onApiKeys,
  onDeleteAccount,
}: {
  user: User;
  onUser: (u: User) => void;
  onTwoFactor: () => void;
  onApiKeys: () => void;
  onDeleteAccount: () => void;
}) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [error, setError] = useState<string | null>(null);

  async function run(action: Promise<User>) {
    setError(null);
    try {
      onUser(await action);
    } catch {
      setError('A beállítás mentése nem sikerült.');
    }
  }

  return (
    <Stack gap="lg" maw={760}>
      <div>
        <Title order={2}>Beállítások</Title>
        <Text size="sm" c="dimmed">
          A fiókod és az értesítéseid
        </Text>
      </div>
      {error && (
        <Alert color="red" role="alert" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div className="panel-card">
        <Group gap="md" wrap="nowrap">
          <Avatar color="brand" variant="filled" radius="xl" size={48}>
            {(user.name.trim()[0] ?? '?').toUpperCase()}
          </Avatar>
          <div>
            <Text fw={600}>{user.name}</Text>
            <Text size="sm" c="dimmed">
              {user.email}
            </Text>
          </div>
        </Group>
      </div>

      <div className="panel-card">
        <Text fw={600} mb="xs">
          Értesítések
        </Text>
        <Row title="E-mail értesítések" hint="Új komment, válasz vagy rád bízott feladat esetén">
          <Switch
            aria-label="E-mail értesítések"
            checked={user.notifyEmail}
            onChange={(e) => void run(api.account.setNotifyEmail(e.currentTarget.checked))}
          />
        </Row>
        <Row title="Összefoglaló e-mail" hint="A projektek állása egy levélben">
          <SegmentedControl
            size="xs"
            aria-label="Összefoglaló e-mail gyakorisága"
            value={user.digestFrequency}
            onChange={(v) => void run(api.account.setDigest(v as 'OFF' | 'DAILY' | 'WEEKLY'))}
            data={[
              { value: 'OFF', label: 'Ki' },
              { value: 'DAILY', label: 'Naponta' },
              { value: 'WEEKLY', label: 'Hetente' },
            ]}
          />
        </Row>
      </div>

      <div className="panel-card">
        <Text fw={600} mb="xs">
          Megjelenés
        </Text>
        <Row title="Téma" hint="Az automatikus a rendszer beállítását követi">
          <SegmentedControl
            size="xs"
            aria-label="Téma"
            value={colorScheme}
            onChange={(v) => setColorScheme(v as 'auto' | 'light' | 'dark')}
            data={[
              { value: 'auto', label: 'Auto' },
              { value: 'light', label: 'Világos' },
              { value: 'dark', label: 'Sötét' },
            ]}
          />
        </Row>
      </div>

      <div className="panel-card">
        <Text fw={600} mb="xs">
          Biztonság és integráció
        </Text>
        <Row title="Kétlépcsős belépés" hint={user.twoFactorEnabled ? 'Be van kapcsolva' : 'Hitelesítő alkalmazással'}>
          <Button size="xs" variant="light" onClick={onTwoFactor}>
            {user.twoFactorEnabled ? 'Kezelés' : 'Bekapcsolás'}
          </Button>
        </Row>
        <Row title="API-kulcsok" hint="Csak olvasható hozzáférés az /api/v1 végpontokhoz">
          <Button size="xs" variant="light" onClick={onApiKeys}>
            Megnyitás
          </Button>
        </Row>
      </div>

      <div className="panel-card danger">
        <Text fw={600} mb="xs" c="red">
          Veszélyes zóna
        </Text>
        <Row title="Fiók törlése" hint="A saját projektjeid is véglegesen törlődnek">
          <Button size="xs" color="red" variant="light" onClick={onDeleteAccount}>
            Fiók törlése
          </Button>
        </Row>
      </div>
    </Stack>
  );
}
