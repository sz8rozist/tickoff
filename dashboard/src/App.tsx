import { useEffect, useState } from 'react';
import { Alert, Avatar, Box, Button, Center, Container, Group, Loader, Menu, Switch, Text, UnstyledButton } from '@mantine/core';
import { api, ApiError, getToken, type User } from './api';
import { AuthForm } from './AuthForm';
import { AuthShell } from './AuthShell';
import { Wordmark } from './Logo';
import { DeleteAccountModal } from './DeleteAccountModal';
import { ProjectsPage } from './ProjectsPage';
import { ResetPasswordPage } from './ResetPasswordPage';

const RESET_PARAM = 'reset-token';
const VERIFY_PARAM = 'verify-token';

/** A jelszó-visszaállító linkből érkező token (tiszta olvasás: a címsorból törlés külön, effectben történik). */
function readResetToken(): string | null {
  return new URLSearchParams(window.location.search).get(RESET_PARAM);
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [notifyError, setNotifyError] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(readResetToken);
  // Az e-mail-megerősítő linkből érkező token és az eredménye
  const [verifyToken] = useState<string | null>(() => new URLSearchParams(window.location.search).get(VERIFY_PARAM));
  const [verifyResult, setVerifyResult] = useState<'ok' | 'fail' | null>(null);
  const [resent, setResent] = useState(false);
  // Ha van mentett token, először megnézzük, érvényes-e.
  const [loading, setLoading] = useState<boolean>(() => getToken() !== null);

  // A token a címsorban maradna (előzmények, Referer, megosztott képernyő): azonnal eltávolítjuk, a state-ben megvan.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has(RESET_PARAM) || url.searchParams.has(VERIFY_PARAM)) {
      url.searchParams.delete(RESET_PARAM);
      url.searchParams.delete(VERIFY_PARAM);
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  }, []);

  // Megerősítő link: beváltjuk, és ha be vagyunk jelentkezve, frissítjük a felhasználót (a függő meghívók ilyenkor lépnek életbe)
  useEffect(() => {
    if (!verifyToken) return;
    api
      .verifyEmail(verifyToken)
      .then(() => {
        setVerifyResult('ok');
        if (getToken()) api.me().then(setUser).catch(() => undefined);
      })
      .catch(() => setVerifyResult('fail'));
  }, [verifyToken]);

  async function resendVerification() {
    try {
      await api.resendVerification();
      setResent(true);
    } catch {
      /* a következő próbálkozásnál újra lehet kérni */
    }
  }

  async function toggleNotify(checked: boolean) {
    setNotifyError(false);
    try {
      setUser(await api.account.setNotifyEmail(checked));
    } catch {
      setNotifyError(true);
    }
  }

  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(setUser)
      .catch((e) => {
        // Csak akkor dobjuk el a tokent, ha a szerver tényleg elutasította (lejárt/érvénytelen).
        if (e instanceof ApiError && e.status === 401) api.logout();
      })
      .finally(() => setLoading(false));
  }, []);

  function logout() {
    api.logout();
    setUser(null);
  }

  // A visszaállító linkről érkező felhasználó (be van-e jelentkezve vagy sem) először az új jelszót adja meg
  if (resetToken) {
    return (
      <AuthShell>
        <ResetPasswordPage
          token={resetToken}
          onDone={() => {
            // A jelszócsere után a régi bejelentkezések érvénytelenek: tiszta lappal indulunk
            api.logout();
            setUser(null);
            setResetToken(null);
          }}
        />
      </AuthShell>
    );
  }

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (!user) {
    return (
      <AuthShell>
        {verifyResult === 'ok' && (
          <Alert color="teal" mb="md" role="status">
            Az e-mail-címed megerősítve. Most már beléphetsz.
          </Alert>
        )}
        {verifyResult === 'fail' && (
          <Alert color="red" mb="md" role="alert">
            A megerősítő link érvénytelen vagy lejárt. Belépés után kérhetsz újat.
          </Alert>
        )}
        <AuthForm onAuth={setUser} />
      </AuthShell>
    );
  }

  return (
    <>
      <header className="app-header">
        <Container size="md" py="sm">
          <Group justify="space-between" wrap="nowrap">
            <Wordmark size={32} />
            <Menu position="bottom-end" width={280} withinPortal>
              <Menu.Target>
                <UnstyledButton aria-label="Fiók menü">
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" fw={500} className="user-name">
                      {user.name}
                    </Text>
                    <Avatar color="brand" variant="filled" radius="xl" size={34}>
                      {initials(user.name)}
                    </Avatar>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Box px="sm" py={6}>
                  <Text size="sm" fw={600}>
                    {user.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {user.email}
                  </Text>
                </Box>
                <Menu.Divider />
                <Menu.Item component="div" closeMenuOnClick={false}>
                  <Switch
                    size="sm"
                    label="E-mail értesítések"
                    checked={user.notifyEmail}
                    onChange={(e) => void toggleNotify(e.currentTarget.checked)}
                    error={notifyError ? 'A beállítás mentése nem sikerült' : undefined}
                  />
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item onClick={logout}>Kilépés</Menu.Item>
                <Menu.Item color="red" onClick={() => setDeleteAccountOpen(true)}>
                  Fiók törlése
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Container>
      </header>
      <Container size="md" py="xl">
      {verifyResult === 'ok' && (
        <Alert color="teal" mb="md" role="status" withCloseButton onClose={() => setVerifyResult(null)}>
          Az e-mail-címed megerősítve.
        </Alert>
      )}
      {verifyResult === 'fail' && (
        <Alert color="red" mb="md" role="alert" withCloseButton onClose={() => setVerifyResult(null)}>
          A megerősítő link érvénytelen vagy lejárt. Kérj újat lent.
        </Alert>
      )}
      {!user.emailVerified && (
        <Alert color="yellow" mb="md" title="Erősítsd meg az e-mail-címed">
          Küldtünk egy levelet a(z) {user.email} címre. A megerősítésig a hozzád érkező projektmeghívók nem lépnek életbe.{' '}
          {resent ? (
            'Új levelet küldtünk.'
          ) : (
            <Button size="compact-xs" variant="light" onClick={() => void resendVerification()}>
              Küldd újra
            </Button>
          )}
        </Alert>
      )}
      <ProjectsPage currentUserId={user.id} />
      <DeleteAccountModal
        opened={deleteAccountOpen}
        onClose={() => setDeleteAccountOpen(false)}
        onDeleted={() => {
          setDeleteAccountOpen(false);
          logout();
        }}
      />
      </Container>
    </>
  );
}
