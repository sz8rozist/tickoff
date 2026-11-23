import { useState } from 'react';
import { Alert, Button, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { api, ApiError } from './api';
import { t } from './i18n';

/** Új jelszó megadása az e-mailben kapott link tokenjével. */
export function ResetPasswordPage({ token, onDone }: { token: string; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const form = useForm({
    initialValues: { password: '', confirm: '' },
    validate: {
      password: (v) => (v.length < 8 ? t('Legalább 8 karakter kell') : null),
      confirm: (v, values) => (v !== values.password ? t('A két jelszó nem egyezik') : null),
    },
  });

  async function submit(values: typeof form.values) {
    setError(null);
    setBusy(true);
    try {
      await api.resetPassword(token, values.password);
      setDone(true);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 400
          ? t('Ez a link érvénytelen, lejárt vagy már felhasználták. Kérj új visszaállító linket a belépő oldalon.')
          : e instanceof ApiError && e.status === 429
            ? t('Túl sok próbálkozás. Várj egy percet, és próbáld újra.')
            : t('A jelszó megváltoztatása nem sikerült, próbáld újra később.'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Title order={1} className="auth-title">
        {t('Új jelszó')}</Title>
      <Text c="dimmed" mt={6} mb="xl">
        {t('Add meg az új jelszavad, és újra beléphetsz.')}</Text>
      <Stack>
        {done ? (
          <>
            <Alert color="green" role="status">
              {t('A jelszavad megváltozott. Biztonsági okból minden korábbi bejelentkezésed megszűnt, jelentkezz be az új jelszóval.')}</Alert>
            <Button onClick={onDone}>{t('Tovább a belépéshez')}</Button>
          </>
        ) : (
          <form onSubmit={form.onSubmit(submit)}>
            <Stack>
              <PasswordInput
                size="md"
                label={t('Új jelszó')}
                description={t('Legalább 8 karakter')}
                maxLength={72}
                autoComplete="new-password"
                data-autofocus
                {...form.getInputProps('password')}
              />
              <PasswordInput
                size="md"
                label={t('Új jelszó újra')}
                maxLength={72}
                autoComplete="new-password"
                {...form.getInputProps('confirm')}
              />
              {error && (
                <Alert color="red" role="alert">
                  {error}
                </Alert>
              )}
              <Button type="submit" size="md" fullWidth loading={busy}>
                {t('Jelszó megváltoztatása')}</Button>
              <Text size="xs" c="dimmed" ta="center">
                {t('A link egy óráig érvényes, és csak egyszer használható.')}</Text>
            </Stack>
          </form>
        )}
      </Stack>
    </div>
  );
}
