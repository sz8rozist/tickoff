import { useEffect, useState } from 'react';
import {
  Alert,
  Anchor,
  Button,
  Card,
  Code,
  Group,
  Image,
  Loader,
  Modal,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { api, type Comment, type CommentStatus } from './api';
import { Thread } from './Thread';

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Nyitott' },
  { value: 'IN_PROGRESS', label: 'Folyamatban' },
  { value: 'DONE', label: 'Kész' },
];

const dateTime = (iso: string) => new Date(iso).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' });

/** Egy URL "útvonal?lekérdezés" része; érvénytelen URL esetén az eredeti szöveg. */
function pagePath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search || '/';
  } catch {
    return url;
  }
}

/** Rövid, olvasható böngésző/rendszer leírás a user agentből (nem teljes értékű elemző). */
function describeAgent(ua: string | null): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : null;
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null;
  return [browser, os].filter(Boolean).join(' · ') || null;
}

function environment(c: Comment): string {
  const parts: string[] = [];
  if (c.viewportWidth && c.viewportHeight) parts.push(`${c.viewportWidth}×${c.viewportHeight}`);
  const agent = describeAgent(c.userAgent);
  if (agent) parts.push(agent);
  return parts.join(' · ');
}

export function CommentsPanel({
  projectId,
  roundId,
  onChanged,
}: {
  projectId: number;
  roundId: number;
  /** A státuszváltás után a körök számlálóit frissíteni kell. */
  onChanged: () => void;
}) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [shot, setShot] = useState<{ comment: Comment; url: string | null; failed: boolean } | null>(null);
  // A `deleting` a bezáródó animáció alatt is megmarad, hogy a szöveg ne ürüljön ki.
  const [deleting, setDeleting] = useState<Comment | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    api.comments.list(projectId, roundId).then(setComments).catch(() => setError('A kommentek betöltése nem sikerült.'));
  }, [projectId, roundId]);

  // A képernyőkép object URL-jét felszabadítjuk, amikor lecserélődik vagy bezáródik.
  useEffect(() => {
    const url = shot?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [shot?.url]);

  async function changeStatus(c: Comment, status: CommentStatus) {
    setError(null);
    setBusyId(c.id);
    try {
      const updated = await api.comments.setStatus(projectId, c.id, status);
      setComments((prev) => prev?.map((x) => (x.id === c.id ? updated : x)) ?? null);
      onChanged();
    } catch {
      setError('A státusz módosítása nem sikerült.');
    } finally {
      setBusyId(null);
    }
  }

  async function addReply(c: Comment, body: string) {
    const reply = await api.comments.reply(projectId, c.id, body);
    setComments((prev) => prev?.map((x) => (x.id === c.id ? { ...x, replies: [...x.replies, reply] } : x)) ?? null);
  }

  async function removeReply(c: Comment, replyId: number) {
    await api.comments.removeReply(projectId, c.id, replyId);
    setComments(
      (prev) => prev?.map((x) => (x.id === c.id ? { ...x, replies: x.replies.filter((r) => r.id !== replyId) } : x)) ?? null,
    );
  }

  async function confirmDelete() {
    if (!deleting) return;
    setError(null);
    setBusyId(deleting.id);
    try {
      await api.comments.remove(projectId, deleting.id);
      setComments((prev) => prev?.filter((x) => x.id !== deleting.id) ?? null);
      onChanged();
    } catch {
      setError('A komment törlése nem sikerült.');
    } finally {
      setBusyId(null);
      setDeleteOpen(false);
    }
  }

  async function showScreenshot(c: Comment) {
    setShot({ comment: c, url: null, failed: false });
    try {
      const blob = await api.comments.screenshot(projectId, c.id);
      setShot({ comment: c, url: URL.createObjectURL(blob), failed: false });
    } catch {
      setShot({ comment: c, url: null, failed: true });
    }
  }

  if (!comments) {
    return error ? (
      <Alert color="red" role="alert">
        {error}
      </Alert>
    ) : (
      <Loader size="xs" />
    );
  }

  if (comments.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Ebben a körben még nincs komment.
      </Text>
    );
  }

  // Oldalanként csoportosítjuk: "a második oldalon az a gomb" típusú visszajelzések így egy helyen vannak.
  const byPage = new Map<string, Comment[]>();
  for (const c of comments) {
    byPage.set(c.pageUrl, [...(byPage.get(c.pageUrl) ?? []), c]);
  }

  return (
    <Stack gap="md" mt="xs">
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}
      {[...byPage.entries()].map(([url, items]) => (
        <Stack key={url} gap="xs">
          <Title order={5}>
            <Anchor href={url} target="_blank" rel="noopener noreferrer" inherit>
              {pagePath(url)}
            </Anchor>{' '}
            <Text span size="sm" c="dimmed" fw={400}>
              ({items.length})
            </Text>
          </Title>
          {items.map((c) => (
            <Card key={c.id} withBorder padding="sm" radius="sm">
              <Stack gap={6}>
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <Text size="sm" fw={600}>
                    {c.authorName}{' '}
                    <Text span size="xs" c="dimmed" fw={400}>
                      {dateTime(c.createdAt)}
                    </Text>
                  </Text>
                  <SegmentedControl
                    size="xs"
                    data={STATUS_OPTIONS}
                    value={c.status}
                    disabled={busyId === c.id}
                    onChange={(v) => changeStatus(c, v as CommentStatus)}
                    aria-label="Státusz"
                  />
                </Group>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {c.body}
                </Text>
                <Group gap="xs">
                  {c.cssSelector && <Code>{c.cssSelector}</Code>}
                  {environment(c) && (
                    <Text size="xs" c="dimmed">
                      {environment(c)}
                    </Text>
                  )}
                  {c.hasScreenshot && (
                    <Button size="compact-xs" variant="light" onClick={() => showScreenshot(c)}>
                      Képernyőkép
                    </Button>
                  )}
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    color="red"
                    onClick={() => {
                      setDeleting(c);
                      setDeleteOpen(true);
                    }}
                  >
                    Törlés
                  </Button>
                </Group>
                <Thread
                  replies={c.replies}
                  onAdd={(body) => addReply(c, body)}
                  onRemove={(replyId) => removeReply(c, replyId)}
                />
              </Stack>
            </Card>
          ))}
        </Stack>
      ))}

      <Modal opened={deleteOpen} onClose={() => setDeleteOpen(false)} title="Komment törlése" centered>
        <Stack>
          <Text size="sm">
            Biztosan törlöd {deleting?.authorName} kommentjét? A képernyőképe is törlődik, ez nem vonható vissza.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteOpen(false)}>
              Mégse
            </Button>
            <Button color="red" loading={busyId !== null && busyId === deleting?.id} onClick={confirmDelete}>
              Törlés
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={shot !== null} onClose={() => setShot(null)} title="Képernyőkép" size="xl" centered>
        {shot?.failed && <Alert color="red">A képernyőkép betöltése nem sikerült.</Alert>}
        {shot && !shot.failed && !shot.url && <Loader size="sm" />}
        {shot?.url && <Image src={shot.url} alt={`Képernyőkép: ${shot.comment.body.slice(0, 60)}`} fit="contain" />}
      </Modal>
    </Stack>
  );
}
