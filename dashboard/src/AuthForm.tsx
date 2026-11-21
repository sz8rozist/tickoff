import { useState } from 'react';
import { Alert, Anchor, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { api, ApiError, type User } from './api';

type Mode = 'login' | 'register' | 'forgot';

function errorMessage(e: unknown, mode: Mode): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Hibás e-mail vagy jelszó.';
    if (e.status === 409) return 'Ezzel az e-mail címmel már van fiók.';
    if (e.status === 403 && mode === 'register') return 'A regisztráció jelenleg le van tiltva.';
    if (e.status === 429) return 'Túl sok próbálkozás. Várj egy percet, és próbáld újra.';
    if (e.status === 400)
      return mode === 'register'
        ? 'Ellenőrizd az adatokat: érvényes e-mail és legalább 8 karakteres jelszó kell.'
        : mode === 'forgot'
          ? 'Adj meg egy érvényes e-mail címet.'
          : 'Add meg az e-mail címet és a jelszót.';
  }
  return 'A szerver nem elérhető, próbáld újra később.';
}

const TITLES: Record<Mode, string> = {
  login: 'Belépés',
  register: 'Regisztráció',
  forgot: 'Elfelejtett jelszó',
};

export function AuthForm({ onAuth }: { onAuth: (user: User) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A "jelszó-emlékeztető elküldve" állapot: a szöveg szándékosan nem árulja el, hogy van-e ilyen fiók
  const [reminderSent, setReminderSent] = useState(false);

  const form = useForm({
    initialValues: { name: '', email: '', password: '' },
    validate: {
      name: (v) => (mode === 'register' && v.trim() === '' ? 'A név kötelező' : null),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Érvényes e-mail címet adj meg'),
      password: (v) =>
        mode === 'forgot'
          ? null
          : mode === 'register' && v.length < 8
            ? 'Legalább 8 karakter kell'
            : v === ''
              ? 'A jelszó kötelező'
              : null,
    },
  });

  async function submit(values: typeof form.values) {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'forgot') {
        await api.forgotPassword(values.email);
        setReminderSent(true);
        return;
      }
      const user =
        mode === 'login'
          ? await api.login(values.email, values.password)
          : await api.register(values.email, values.password, values.name);
      onAuth(user);
    } catch (err) {
      setError(errorMessage(err, mode));
    } finally {
      setBusy(false);
    }
  }

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
    setReminderSent(false);
    form.clearErrors();
  }

  return (
    <Paper withBorder shadow="lg" p="xl" radius="lg">
      <form onSubmit={form.onSubmit(submit)}>
        <Stack>
          <Title order={2} size="h3">
            {TITLES[mode]}
          </Title>

          {mode === 'forgot' && reminderSent ? (
            <>
              <Alert color="green" role="status">
                Ha van ilyen fiók, elküldtük a jelszó-visszaállító linket. A levél pár percen belül megérkezik, a link
                egy óráig érvényes.
              </Alert>
              <Text size="sm" ta="center">
                <Anchor component="button" type="button" onClick={() => switchTo('login')}>
                  Vissza a belépéshez
                </Anchor>
              </Text>
            </>
          ) : (
            <>
              {mode === 'register' && (
                <TextInput label="Név" maxLength={120} autoComplete="name" {...form.getInputProps('name')} />
              )}
              <TextInput label="E-mail" autoComplete="email" {...form.getInputProps('email')} />
              {mode === 'forgot' ? (
                <Text size="sm" c="dimmed">
                  Add meg a fiókod e-mail címét, és küldünk egy linket, amivel új jelszót adhatsz meg.
                </Text>
              ) : (
                <PasswordInput
                  label="Jelszó"
                  description={mode === 'register' ? 'Legalább 8 karakter' : undefined}
                  maxLength={72}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  {...form.getInputProps('password')}
                />
              )}
              {error && (
                <Alert color="red" role="alert">
                  {error}
                </Alert>
              )}
              <Button type="submit" loading={busy}>
                {mode === 'login' ? 'Belépés' : mode === 'register' ? 'Fiók létrehozása' : 'Link küldése'}
              </Button>
              {mode === 'login' && (
                <Text size="sm" ta="center">
                  <Anchor component="button" type="button" onClick={() => switchTo('forgot')}>
                    Elfelejtett jelszó
                  </Anchor>
                </Text>
              )}
              <Text size="sm" ta="center">
                <Anchor
                  component="button"
                  type="button"
                  onClick={() => switchTo(mode === 'register' ? 'login' : mode === 'forgot' ? 'login' : 'register')}
                >
                  {mode === 'login' ? 'Még nincs fiókom' : mode === 'register' ? 'Már van fiókom' : 'Vissza a belépéshez'}
                </Anchor>
              </Text>
            </>
          )}
        </Stack>
      </form>
    </Paper>
  );
}
