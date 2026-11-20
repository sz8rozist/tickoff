import { useEffect, useState } from 'react';
import { Button, Center, Container, Group, Loader, Text, Title } from '@mantine/core';
import { api, ApiError, getToken, type User } from './api';
import { AuthForm } from './AuthForm';
import { DeleteAccountModal } from './DeleteAccountModal';
import { ProjectsPage } from './ProjectsPage';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  // Ha van mentett token, először megnézzük, érvényes-e.
  const [loading, setLoading] = useState<boolean>(() => getToken() !== null);

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
