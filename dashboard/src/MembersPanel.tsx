import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Group, Loader, Modal, Stack, Text, TextInput } from '@mantine/core';
import { api, ApiError, type Member, type ProjectRole } from './api';

function inviteError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 404) return 'Ezzel az e-mail címmel nincs fiók. A kollégának előbb regisztrálnia kell.';
    if (e.status === 409) return 'Ő már tagja a projektnek.';
    if (e.status === 400) return 'Adj meg egy érvényes e-mail címet.';
    if (e.status === 429) return 'Túl sok próbálkozás. Várj egy percet, és próbáld újra.';
  }
  return 'A meghívás nem sikerült, próbáld újra később.';
}

/**
 * A projekt tagjai. A tulajdonos meghívhat és eltávolíthat, a tag csak a listát látja, és kiléphet.
 * Meghívni meglévő fiókot lehet (e-mail-cím alapján), a kollégának előbb regisztrálnia kell.
 */
export function MembersPanel({
  projectId,
  role,
  currentUserId,
  onLeft,
}: {
  projectId: number;
  role: ProjectRole;
  currentUserId: number;
  /** A kilépés után a projekt már nem látható a felhasználónak. */
  onLeft: () => void;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  // Eltávolításnál második kattintás kell: elkerüli a véletlen eltávolítást
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const isOwner = role === 'OWNER';

  useEffect(() => {
    api.members.list(projectId).then(setMembers).catch(() => setError('A tagok betöltése nem sikerült.'));
  }, [projectId]);

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (email.trim() === '') return;
    setError(null);
    setBusy(true);
    try {
      const member = await api.members.add(projectId, email.trim());
      setMembers((prev) => [...(prev ?? []), member]);
      setEmail('');
    } catch (err) {
      setError(inviteError(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(member: Member) {
    if (confirmId !== member.userId) {
      setConfirmId(member.userId);
      window.setTimeout(() => setConfirmId((cur) => (cur === member.userId ? null : cur)), 4000);
      return;
    }
    setConfirmId(null);
    setError(null);
    try {
      await api.members.remove(projectId, member.userId);
      setMembers((prev) => prev?.filter((m) => m.userId !== member.userId) ?? null);
    } catch {
      setError('Az eltávolítás nem sikerült.');
    }
  }

  async function leave() {
    setBusy(true);
    try {
      await api.members.remove(projectId, currentUserId);
      onLeft();
    } catch {
      setError('A kilépés nem sikerült, próbáld újra később.');
      setLeaveOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!members) {
    return error ? (
      <Alert color="red" role="alert">
        {error}
      </Alert>
    ) : (
      <Loader size="xs" />
    );
  }

  return (
    <Stack gap="xs" mt="xs">
      {members.map((m) => (
        <Group key={m.userId} gap="xs">
          <Text size="sm" fw={m.userId === currentUserId ? 600 : 400}>
            {m.name}
            {m.userId === currentUserId ? ' (te)' : ''}
          </Text>
          <Text size="xs" c="dimmed">
            {m.email}
          </Text>
          <Badge size="xs" variant="light" color={m.role === 'OWNER' ? 'blue' : 'gray'}>
            {m.role === 'OWNER' ? 'tulajdonos' : 'tag'}
          </Badge>
          {isOwner && m.role === 'MEMBER' && (
            <Button size="compact-xs" variant="subtle" color="red" onClick={() => remove(m)}>
              {confirmId === m.userId ? 'Biztosan?' : 'Eltávolítás'}
            </Button>
          )}
        </Group>
      ))}

      {isOwner ? (
        <form onSubmit={invite}>
          <Group gap="xs" align="flex-start">
            <TextInput
              placeholder="kollega@pelda.hu"
              aria-label="A meghívandó kolléga e-mail címe"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              size="xs"
              w={240}
              type="email"
            />
            <Button type="submit" size="xs" loading={busy} disabled={email.trim() === ''}>
              Meghívás
            </Button>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            A tagok a visszajelzéseket kezelhetik (körök, kommentek, válaszok, export), a projekt beállításait nem.
            A kollégának már lennie kell fiókjának.
          </Text>
        </form>
      ) : (
        <div>
          <Button size="compact-xs" variant="subtle" color="red" onClick={() => setLeaveOpen(true)}>
            Kilépés a projektből
          </Button>
        </div>
      )}

      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}

      <Modal opened={leaveOpen} onClose={() => setLeaveOpen(false)} title="Kilépés a projektből" centered>
        <Stack>
          <Text size="sm">
            Biztosan kilépsz a projektből? Utána nem látod a visszajelzéseit, amíg a tulajdonos újra meg nem hív.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setLeaveOpen(false)}>
              Mégse
            </Button>
            <Button color="red" loading={busy} onClick={leave}>
              Kilépés
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
