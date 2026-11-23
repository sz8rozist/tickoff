import { useState } from 'react';
import { Alert, Avatar, Button, Group, SegmentedControl, Stack, Switch, Text, Title, useMantineColorScheme } from '@mantine/core';
import { api, type User } from './api';
import { t, useLang } from './i18n';

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
  const { lang, setLang } = useLang();

  // A nyelvet előbb a fiókra mentjük, aztán váltunk: a felület újraépül, és az új nyelven tölti be a fiókot
  async function changeLang(next: 'hu' | 'en') {
    setError(null);
    try {
      await api.account.setLang(next);
      setLang(next);
    } catch {
      setError(t('A beállítás mentése nem sikerült.'));
    }
  }

  async function run(action: Promise<User>) {
    setError(null);
    try {
      onUser(await action);
    } catch {
      setError(t('A beállítás mentése nem sikerült.'));
    }
  }

  return (
    <Stack gap="lg" maw={760}>
      <div>
        <Title order={2}>{t('Beállítások')}</Title>
        <Text size="sm" c="dimmed">
          {t('A fiókod és az értesítéseid')}</Text>
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
          {t('Értesítések')}</Text>
        <Row title={t('E-mail értesítések')} hint={t('Új komment, válasz vagy rád bízott feladat esetén')}>
          <Switch
            aria-label={t('E-mail értesítések')}
            checked={user.notifyEmail}
            onChange={(e) => void run(api.account.setNotifyEmail(e.currentTarget.checked))}
          />
        </Row>
        <Row title={t('Összefoglaló e-mail')} hint={t('A projektek állása egy levélben')}>
          <SegmentedControl
            size="xs"
            aria-label={t('Összefoglaló e-mail gyakorisága')}
            value={user.digestFrequency}
            onChange={(v) => void run(api.account.setDigest(v as 'OFF' | 'DAILY' | 'WEEKLY'))}
            data={[
              { value: 'OFF', label: t('Ki') },
              { value: 'DAILY', label: t('Naponta') },
              { value: 'WEEKLY', label: t('Hetente') },
            ]}
          />
        </Row>
      </div>

      <div className="panel-card">
        <Text fw={600} mb="xs">
          {t('Megjelenés')}</Text>
        <Row title={t('Nyelv')} hint={t('A felület és a csapatnak küldött e-mailek nyelve')}>
          <SegmentedControl
            size="xs"
            aria-label={t('Nyelv')}
            value={lang}
            onChange={(v) => void changeLang(v as 'hu' | 'en')}
            data={[
              { value: 'hu', label: 'Magyar' },
              { value: 'en', label: 'English' },
            ]}
          />
        </Row>
        <Row title={t('Téma')} hint={t('Az automatikus a rendszer beállítását követi')}>
          <SegmentedControl
            size="xs"
            aria-label={t('Téma')}
            value={colorScheme}
            onChange={(v) => setColorScheme(v as 'auto' | 'light' | 'dark')}
            data={[
              { value: 'auto', label: t('Auto') },
              { value: 'light', label: t('Világos') },
              { value: 'dark', label: t('Sötét') },
            ]}
          />
        </Row>
      </div>

      <div className="panel-card">
        <Text fw={600} mb="xs">
          {t('Biztonság és integráció')}</Text>
        <Row title={t('Kétlépcsős belépés')} hint={user.twoFactorEnabled ? t('Be van kapcsolva') : t('Hitelesítő alkalmazással')}>
          <Button size="xs" variant="light" onClick={onTwoFactor}>
            {user.twoFactorEnabled ? t('Kezelés') : t('Bekapcsolás')}
          </Button>
        </Row>
        <Row title={t('API-kulcsok')} hint={t('Csak olvasható hozzáférés az /api/v1 végpontokhoz')}>
          <Button size="xs" variant="light" onClick={onApiKeys}>
            {t('Megnyitás')}</Button>
        </Row>
      </div>

      <div className="panel-card danger">
        <Text fw={600} mb="xs" c="red">
          {t('Veszélyes zóna')}</Text>
        <Row title={t('Fiók törlése')} hint={t('A saját projektjeid is véglegesen törlődnek')}>
          <Button size="xs" color="red" variant="light" onClick={onDeleteAccount}>
            {t('Fiók törlése')}</Button>
        </Row>
      </div>
    </Stack>
  );
}
