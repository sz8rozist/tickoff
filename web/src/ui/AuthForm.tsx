import { useState } from 'react';
import { Alert, Anchor, Button, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { api, ApiError, type User } from './api';
import { PATH_LOGIN, PATH_REGISTER } from './route';
import { t } from './i18n';

type Mode = 'login' | 'register' | 'forgot';

function errorMessage(e: unknown, mode: Mode): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return t('Hibás e-mail vagy jelszó.');
    if (e.status === 409) return t('Ezzel az e-mail címmel már van fiók.');
    if (e.status === 403 && mode === 'register') return t('A regisztráció jelenleg le van tiltva.');
    if (e.status === 429) return t('Túl sok próbálkozás. Várj egy percet, és próbáld újra.');
    if (e.status === 400)
      return mode === 'register'
        ? t('Ellenőrizd az adatokat: érvényes e-mail és legalább 8 karakteres jelszó kell.')
        : mode === 'forgot'
          ? t('Adj meg egy érvényes e-mail címet.')
          : t('Add meg az e-mail címet és a jelszót.');
  }
  return t('A szerver nem elérhető, próbáld újra később.');
}

const TITLES = (): Record<Mode, string> => ({
  login: t('Üdv újra!'),
  register: t('Fiók létrehozása'),
  forgot: t('Elfelejtett jelszó'),
});

const SUBTITLES = (): Record<Mode, string> => ({
  login: t('Lépj be, és nézd meg, mi érkezett az ügyfeleidtől.'),
  register: t('Pár perc, és az első ügyfeled már küldheti a visszajelzéseit.'),
  forgot: t('Küldünk egy linket, amivel új jelszót adhatsz meg.'),
});

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
  // Kétlépcsős belépés: a jelszó után a kihívás és a beírandó kód
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const form = useForm({
    initialValues: { name: '', email: '', password: '' },
    validate: {
      name: (v) => (mode === 'register' && v.trim() === '' ? t('A név kötelező') : null),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : t('Érvényes e-mail címet adj meg')),
      password: (v) =>
        mode === 'forgot'
          ? null
          : mode === 'register' && v.length < 8
            ? t('Legalább 8 karakter kell')
            : v === ''
              ? t('A jelszó kötelező')
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
      if (mode === 'login') {
        const result = await api.login(values.email, values.password);
        if ('challenge' in result) {
          setChallenge(result.challenge);
          return;
        }
        onAuth(result.user);
        return;
      }
      onAuth(await api.register(values.email, values.password, values.name));
    } catch (err) {
      setError(errorMessage(err, mode));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge || code.trim() === '') return;
    setError(null);
    setBusy(true);
    try {
      onAuth(await api.login2fa(challenge, code.trim()));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // A kihívás 5 percig érvényes: ha lejárt, újra kell kezdeni a jelszóval
        setError(t('Hibás kód, vagy lejárt a belépési kísérlet. Próbáld újra, szükség esetén a jelszóval elölről.'));
      } else if (err instanceof ApiError && err.status === 429) {
        setError(t('Túl sok próbálkozás. Várj egy percet, és próbáld újra.'));
      } else {
        setError(t('A szerver nem elérhető, próbáld újra később.'));
      }
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

  if (challenge) {
    return (
      <div>
        <Title order={1} className="auth-title">
          {t('Második lépés')}</Title>
        <Text c="dimmed" mt={6} mb="xl">
          {t('Add meg a hitelesítő alkalmazásod 6 jegyű kódját. Ha nincs nálad a telefon, használhatsz helyreállító kódot.')}</Text>
        <form onSubmit={submitCode}>
          <Stack gap="md">
            <TextInput
              size="md"
              label={t('Kód')}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
              autoComplete="one-time-code"
              inputMode="text"
              maxLength={20}
              data-autofocus
              autoFocus
            />
            {error && (
              <Alert color="red" role="alert">
                {error}
              </Alert>
            )}
            <Button type="submit" size="md" fullWidth loading={busy} disabled={code.trim() === ''}>
              {t('Belépés')}</Button>
            <Text size="sm" ta="center">
              <Anchor
                component="button"
                type="button"
                onClick={() => {
                  setChallenge(null);
                  setCode('');
                  setError(null);
                }}
              >
                {t('Vissza')}</Anchor>
            </Text>
          </Stack>
        </form>
      </div>
    );
  }

  return (
    <div>
      <Title order={1} className="auth-title">
        {TITLES()[mode]}
      </Title>
      <Text c="dimmed" mt={6} mb="xl">
        {SUBTITLES()[mode]}
      </Text>

      <form onSubmit={form.onSubmit(submit)}>
        <Stack gap="md">
          {mode === 'forgot' && reminderSent ? (
            <>
              <Alert color="green" role="status" title={t('Elküldtük')}>
                {t('Ha van ilyen fiók, elküldtük a jelszó-visszaállító linket. A levél pár percen belül megérkezik, a link egy óráig érvényes.')}</Alert>
              <Text size="sm" ta="center">
                <Anchor component="button" type="button" onClick={() => switchTo('login')}>
                  {t('Vissza a belépéshez')}</Anchor>
              </Text>
            </>
          ) : (
            <>
              {mode === 'register' && (
                <TextInput
                  size="md"
                  label={t('Név')}
                  placeholder={t('Kovács Anna')}
                  maxLength={120}
                  autoComplete="name"
                  {...form.getInputProps('name')}
                />
              )}
              <TextInput
                size="md"
                label={t('E-mail')}
                placeholder={t('te@ceged.hu')}
                autoComplete="email"
                {...form.getInputProps('email')}
              />
              {mode !== 'forgot' && (
                <PasswordInput
                  size="md"
                  label={t('Jelszó')}
                  description={mode === 'register' ? t('Legalább 8 karakter') : undefined}
                  maxLength={72}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  {...form.getInputProps('password')}
                />
              )}
              {mode === 'login' && (
                <Text size="sm" ta="right" mt={-8}>
                  <Anchor component="button" type="button" onClick={() => switchTo('forgot')}>
                    {t('Elfelejtett jelszó')}</Anchor>
                </Text>
              )}
              {error && (
                <Alert color="red" role="alert">
                  {error}
                </Alert>
              )}
              <Button type="submit" size="md" fullWidth loading={busy}>
                {mode === 'login' ? t('Belépés') : mode === 'register' ? t('Fiók létrehozása') : t('Link küldése')}
              </Button>
              {mode === 'register' && (
                <Text size="xs" c="dimmed" ta="center">
                  {t('A regisztráció után e-mailben megerősítő linket küldünk a címedre.')}</Text>
              )}
              <Text size="sm" ta="center" c="dimmed">
                {mode === 'login' ? t('Még nincs fiókod? ') : mode === 'register' ? t('Már van fiókod? ') : ''}
                <Anchor
                  component="button"
                  type="button"
                  onClick={() => switchTo(mode === 'register' ? 'login' : mode === 'forgot' ? 'login' : 'register')}
                >
                  {mode === 'login' ? t('Regisztrálj') : mode === 'register' ? t('Lépj be') : t('Vissza a belépéshez')}
                </Anchor>
              </Text>
            </>
          )}
        </Stack>
      </form>
    </div>
  );
}
