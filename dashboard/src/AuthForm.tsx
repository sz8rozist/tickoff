import { useState } from 'react';
import { Alert, Anchor, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { api, ApiError, type User } from './api';

type Mode = 'login' | 'register';

function errorMessage(e: unknown, mode: Mode): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Hibás e-mail vagy jelszó.';
    if (e.status === 409) return 'Ezzel az e-mail címmel már van fiók.';
    if (e.status === 400)
      return mode === 'register'
        ? 'Ellenőrizd az adatokat: érvényes e-mail és legalább 8 karakteres jelszó kell.'
        : 'Add meg az e-mail címet és a jelszót.';
  }
  return 'A szerver nem elérhető, próbáld újra később.';
}

export function AuthForm({ onAuth }: { onAuth: (user: User) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm({
    initialValues: { name: '', email: '', password: '' },
    validate: {
      name: (v) => (mode === 'register' && v.trim() === '' ? 'A név kötelező' : null),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Érvényes e-mail címet adj meg'),
      password: (v) =>
        mode === 'register' && v.length < 8 ? 'Legalább 8 karakter kell' : v === '' ? 'A jelszó kötelező' : null,
    },
  });

  async function submit(values: typeof form.values) {
    setError(null);
    setBusy(true);
    try {
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

  function toggle() {
    setMode(mode === 'login' ? 'register' : 'login');
    setError(null);
    form.clearErrors();
  }

  return (
    <Paper withBorder shadow="sm" p="xl" radius="md">
      <form onSubmit={form.onSubmit(submit)}>
        <Stack>
          <Title order={2} size="h3">
            {mode === 'login' ? 'Belépés' : 'Regisztráció'}
          </Title>
          {mode === 'register' && (
            <TextInput
              label="Név"
              maxLength={120}
              autoComplete="name"
              {...form.getInputProps('name')}
            />
          )}
          <TextInput label="E-mail" autoComplete="email" {...form.getInputProps('email')} />
          <PasswordInput
            label="Jelszó"
            description={mode === 'register' ? 'Legalább 8 karakter' : undefined}
            maxLength={72}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            {...form.getInputProps('password')}
          />
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}
          <Button type="submit" loading={busy}>
            {mode === 'login' ? 'Belépés' : 'Fiók létrehozása'}
          </Button>
          <Text size="sm" ta="center">
            <Anchor component="button" type="button" onClick={toggle}>
              {mode === 'login' ? 'Még nincs fiókom' : 'Már van fiókom'}
            </Anchor>
          </Text>
        </Stack>
      </form>
    </Paper>
  );
}
