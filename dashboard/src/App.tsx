import { useEffect, useState } from 'react';
import { Button, Center, Container, Group, Loader, Switch, Text, Title } from '@mantine/core';
import { api, ApiError, getToken, type User } from './api';
import { AuthForm } from './AuthForm';
import { DeleteAccountModal } from './DeleteAccountModal';
import { ProjectsPage } from './ProjectsPage';
import { ResetPasswordPage } from './ResetPasswordPage';

const RESET_PARAM = 'reset-token';

/** A jelszó-visszaállító linkből érkező token (tiszta olvasás: a címsorból törlés külön, effectben történik). */
function readResetToken(): string | null {
  return new URLSearchParams(window.location.search).get(RESET_PARAM);
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [notifyError, setNotifyError] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(readResetToken);
  // Ha van mentett token, először megnézzük, érvényes-e.
  const [loading, setLoading] = useState<boolean>(() => getToken() !== null);

  // A token a címsorban maradna (előzmények, Referer, megosztott képernyő): azonnal eltávolítjuk, a state-ben megvan.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has(RESET_PARAM)) {
      url.searchParams.delete(RESET_PARAM);
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  }, []);

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
      <Container size={420} py={80}>
        <Title order={1} ta="center" mb="xl">
          Tickoff
        </Title>
        <ResetPasswordPage
          token={resetToken}
          onDone={() => {
            // A jelszócsere után a régi bejelentkezések érvénytelenek: tiszta lappal indulunk
            api.logout();
            setUser(null);
            setResetToken(null);
          }}
        />
      </Container>
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
      <Container size={420} py={80}>
        <Title order={1} ta="center" mb="xl">
          Tickoff
        </Title>
        <AuthForm onAuth={setUser} />
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={1}>Tickoff</Title>
        <Group gap="sm">
          <Switch
            size="xs"
            label="E-mail értesítések"
            checked={user.notifyEmail}
            onChange={(e) => void toggleNotify(e.currentTarget.checked)}
            error={notifyError ? 'A beállítás mentése nem sikerült' : undefined}
          />
          <Text size="sm" c="dimmed">
            {user.name} ({user.email})
          </Text>
          <Button variant="default" size="xs" onClick={logout}>
            Kilépés
          </Button>
          <Button variant="subtle" color="red" size="xs" onClick={() => setDeleteAccountOpen(true)}>
            Fiók törlése
          </Button>
        </Group>
      </Group>
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
  );
}
