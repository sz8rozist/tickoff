import { useState } from 'react';
import { Alert, Anchor, Button, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { api, ApiError, type User } from './api';
import { PATH_LOGIN, PATH_REGISTER } from './route';

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
  login: 'Üdv újra!',
  register: 'Fiók létrehozása',
  forgot: 'Elfelejtett jelszó',
};

const SUBTITLES: Record<Mode, string> = {
  login: 'Lépj be, és nézd meg, mi érkezett az ügyfeleidtől.',
  register: 'Pár perc, és az első ügyfeled már küldheti a visszajelzéseit.',
  forgot: 'Küldünk egy linket, amivel új jelszót adhatsz meg.',
};

export function AuthForm({
  onAuth,
  initialMode = 'login',
  onNavigate,
}: {
  onAuth: (user: User) => void;
  initialMode?: Mode;
  /** A belépés és a regisztráció külön címen él: váltáskor erre a függvényre bízzuk a navigációt. */
  onNavigate?: (path: string) => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
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
    if (next === 'login') onNavigate?.(PATH_LOGIN);
    if (next === 'register') onNavigate?.(PATH_REGISTER);
  }

  return (
    <div>
      <Title order={1} className="auth-title">
        {TITLES[mode]}
      </Title>
      <Text c="dimmed" mt={6} mb="xl">
        {SUBTITLES[mode]}
      </Text>

      <form onSubmit={form.onSubmit(submit)}>
        <Stack gap="md">
          {mode === 'forgot' && reminderSent ? (
            <>
              <Alert color="teal" role="status" title="Elküldtük">
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
                <TextInput
                  size="md"
                  label="Név"
                  placeholder="Kovács Anna"
                  maxLength={120}
                  autoComplete="name"
                  {...form.getInputProps('name')}
                />
              )}
              <TextInput
                size="md"
                label="E-mail"
                placeholder="te@ceged.hu"
                autoComplete="email"
                {...form.getInputProps('email')}
              />
              {mode !== 'forgot' && (
                <PasswordInput
                  size="md"
                  label="Jelszó"
                  description={mode === 'register' ? 'Legalább 8 karakter' : undefined}
                  maxLength={72}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  {...form.getInputProps('password')}
                />
              )}
              {mode === 'login' && (
                <Text size="sm" ta="right" mt={-8}>
                  <Anchor component="button" type="button" onClick={() => switchTo('forgot')}>
                    Elfelejtett jelszó
                  </Anchor>
                </Text>
              )}
              {error && (
                <Alert color="red" role="alert">
                  {error}
                </Alert>
              )}
              <Button type="submit" size="md" fullWidth loading={busy}>
                {mode === 'login' ? 'Belépés' : mode === 'register' ? 'Fiók létrehozása' : 'Link küldése'}
              </Button>
              {mode === 'register' && (
                <Text size="xs" c="dimmed" ta="center">
                  A regisztráció után e-mailben megerősítő linket küldünk a címedre.
                </Text>
              )}
              <Text size="sm" ta="center" c="dimmed">
                {mode === 'login' ? 'Még nincs fiókod? ' : mode === 'register' ? 'Már van fiókod? ' : ''}
                <Anchor
                  component="button"
                  type="button"
                  onClick={() => switchTo(mode === 'register' ? 'login' : mode === 'forgot' ? 'login' : 'register')}
                >
                  {mode === 'login' ? 'Regisztrálj' : mode === 'register' ? 'Lépj be' : 'Vissza a belépéshez'}
                </Anchor>
              </Text>
            </>
          )}
        </Stack>
      </form>
    </div>
  );
}
