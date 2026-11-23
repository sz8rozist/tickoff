import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Group, Loader, Modal, Stack, Text, TextInput, Select } from '@mantine/core';
import { api, ApiError, type Invite, type InviteRole, type Member, type ProjectRole } from './api';
import { t } from './i18n';

function inviteError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 409) return t('Őt már meghívtad, vagy már tagja a projektnek, vagy túl sok a függő meghívó.');
    if (e.status === 503) return t('Még nem regisztrált kolléga meghívásához be kell állítani az e-mail-küldést (SMTP).');
    if (e.status === 400) return t('Adj meg egy érvényes e-mail címet.');
    if (e.status === 429) return t('Túl sok próbálkozás. Várj egy percet, és próbáld újra.');
  }
  return t('A meghívás nem sikerült, próbáld újra később.');
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
  onTransferred,
}: {
  projectId: number;
  role: ProjectRole;
  currentUserId: number;
  /** A kilépés után a projekt már nem látható a felhasználónak. */
  onLeft: () => void;
  /** Az átadás után a felhasználó már csak tag: a projekt szerepköre és tulajdonosa frissül. */
  onTransferred: (newOwnerName: string) => void;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [pending, setPending] = useState<Invite[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  // Eltávolításnál második kattintás kell: elkerüli a véletlen eltávolítást
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  // Az átadási célpont a bezáródó animáció alatt is megmarad, hogy a szöveg ne ürüljön ki
  const [transferTarget, setTransferTarget] = useState<Member | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const isOwner = role === 'OWNER';
  const [inviteRole, setInviteRole] = useState<InviteRole>('MEMBER');

  useEffect(() => {
    api.members.list(projectId).then(setMembers).catch(() => setError(t('A tagok betöltése nem sikerült.')));
  }, [projectId]);

  // A függő meghívókat csak a tulajdonos látja
  useEffect(() => {
    if (role === 'OWNER') api.members.invites(projectId).then(setPending).catch(() => undefined);
  }, [projectId, role]);

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (email.trim() === '') return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const member = await api.members.add(projectId, email.trim(), inviteRole);
      setMembers((prev) => [...(prev ?? []), member]);
      setEmail('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Nincs megerősített fiók ezzel a címmel: függő meghívót küldünk, ami a regisztráció és megerősítés után lép életbe
        try {
          const created = await api.members.invite(projectId, email.trim(), inviteRole);
          setPending((prev) => [...prev, created]);
          setEmail('');
          setNotice(t('Még nincs megerősített fiókja, ezért meghívó levelet küldtünk. Ha regisztrál és megerősíti a címét, automatikusan csatlakozik.'));
        } catch (err2) {
          setError(inviteError(err2));
        }
      } else {
        setError(inviteError(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function cancelInvite(invite: Invite) {
    setError(null);
    try {
      await api.members.cancelInvite(projectId, invite.id);
      setPending((prev) => prev.filter((i) => i.id !== invite.id));
    } catch {
      setError(t('A meghívó visszavonása nem sikerült.'));
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
      setError(t('Az eltávolítás nem sikerült.'));
    }
  }

  async function transfer() {
    if (!transferTarget) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.members.transferOwnership(projectId, transferTarget.userId);
      setMembers(updated);
      onTransferred(transferTarget.name);
    } catch {
      setError(t('Az átadás nem sikerült, próbáld újra később.'));
    } finally {
      setBusy(false);
      setTransferOpen(false);
    }
  }

  async function leave() {
    setBusy(true);
    try {
      await api.members.remove(projectId, currentUserId);
      onLeft();
    } catch {
      setError(t('A kilépés nem sikerült, próbáld újra később.'));
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
            {m.userId === currentUserId ? t(' (te)') : ''}
          </Text>
          <Text size="xs" c="dimmed">
            {m.email}
          </Text>
          <Badge size="xs" variant="light" color={m.role === 'OWNER' ? 'blue' : 'gray'}>
            {m.role === 'OWNER' ? t('tulajdonos') : m.role === 'VIEWER' ? t('megtekintő') : t('tag')}
          </Badge>
          {isOwner && m.role !== 'OWNER' && (
            <>
              <Button
                size="compact-xs"
                variant="subtle"
                onClick={() => {
                  setTransferTarget(m);
                  setTransferOpen(true);
                }}
              >
                {t('Átadás')}</Button>
              <Button size="compact-xs" variant="subtle" color="red" onClick={() => remove(m)}>
                {confirmId === m.userId ? 'Biztosan?' : t('Eltávolítás')}
              </Button>
            </>
          )}
        </Group>
      ))}

      {isOwner && pending.length > 0 && (
        <Stack gap={4}>
          <Text size="xs" c="dimmed" fw={600}>
            {t('Függő meghívók')}</Text>
          {pending.map((i) => (
            <Group key={i.id} gap="xs">
              <Text size="sm">{i.email}</Text>
              <Badge size="xs" variant="light" color="yellow">
                {t('vár a regisztrációra')}</Badge>
              {i.role === 'VIEWER' && (
                <Badge size="xs" variant="light" color="gray">
                  {t('megtekintő')}
                </Badge>
              )}
              <Button size="compact-xs" variant="subtle" color="red" onClick={() => cancelInvite(i)}>
                {t('Visszavonás')}</Button>
            </Group>
          ))}
        </Stack>
      )}

      {isOwner ? (
        <form onSubmit={invite}>
          <Group gap="xs" align="flex-start">
            <TextInput
              placeholder={t('kollega@pelda.hu')}
              aria-label={t('A meghívandó kolléga e-mail címe')}
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              size="xs"
              w={240}
              type="email"
            />
            <Select
              size="xs"
              w={150}
              aria-label={t('Szerepkör')}
              allowDeselect={false}
              data={[
                { value: 'MEMBER', label: t('Tag') },
                { value: 'VIEWER', label: t('Megtekintő') },
              ]}
              value={inviteRole}
              onChange={(v) => setInviteRole(v === 'VIEWER' ? 'VIEWER' : 'MEMBER')}
            />
            <Button type="submit" size="xs" loading={busy} disabled={email.trim() === ''}>
              {t('Meghívás')}</Button>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            {t('A tagok a visszajelzéseket kezelhetik (körök, kommentek, válaszok, export), a projekt beállításait nem. A megtekintők mindent láthatnak, de semmit nem módosíthatnak. Ha a kollégának még nincs fiókja, meghívó levelet kap, és a regisztráció után automatikusan csatlakozik.')}</Text>
        </form>
      ) : (
        <div>
          <Button size="compact-xs" variant="subtle" color="red" onClick={() => setLeaveOpen(true)}>
            {t('Kilépés a projektből')}</Button>
        </div>
      )}

      {notice && (
        <Alert color="green" role="status">
          {notice}
        </Alert>
      )}
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}

      <Modal opened={transferOpen} onClose={() => setTransferOpen(false)} title={t('Projekt átadása')} centered>
        <Stack>
          <Text size="sm">
            {t('Átadod a projektet neki:')}{' '}<b>{transferTarget?.name}</b> ({transferTarget?.email}{t('). Ő lesz a tulajdonos: ő szerkesztheti és törölheti a projektet, újragenerálhatja a tokent, és kezelheti a tagokat. Te tag maradsz, a visszajelzéseket továbbra is kezelheted, de ezeket már nem. A visszaadást csak ő kezdeményezheti.')}</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setTransferOpen(false)}>
              {t('Mégse')}</Button>
            <Button color="orange" loading={busy} onClick={transfer}>
              {t('Projekt átadása')}</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={leaveOpen} onClose={() => setLeaveOpen(false)} title={t('Kilépés a projektből')} centered>
        <Stack>
          <Text size="sm">
            {t('Biztosan kilépsz a projektből? Utána nem látod a visszajelzéseit, amíg a tulajdonos újra meg nem hív.')}</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setLeaveOpen(false)}>
              {t('Mégse')}</Button>
            <Button color="red" loading={busy} onClick={leave}>
              {t('Kilépés')}</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
