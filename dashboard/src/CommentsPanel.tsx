import { useEffect, useState } from 'react';
import {
  Alert,
  Anchor,
  Avatar,
  Badge,
  Button,
  Code,
  Group,
  Image,
  Loader,
  Modal,
  SegmentedControl,
  Stack,
  Text,
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
    // A megosztó token a widget indításához kell, a listában csak zajt (és titkot) mutatna
    u.searchParams.delete('token');
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

/**
 * Mélylink az ügyfél oldalára: a widget a komment helyére görget, kiemeli az elemet, és megnyitja a szálat.
 * A paraméter a query-hez kerül (a hash-t, ha van, nem bántjuk: hash-alapú útvonalaknál az az oldalt azonosítja).
 */
function deepLink(pageUrl: string, commentId: number): string | null {
  try {
    const url = new URL(pageUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.searchParams.set('tickoff-comment', String(commentId));
    return url.toString();
  } catch {
    return null;
  }
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
  roundOpen,
  onChanged,
}: {
  projectId: number;
  roundId: number;
  /** A widget csak a nyitott kör kommentjeit mutatja, ezért a "megnyitás az oldalon" csak ott értelmes. */
  roundOpen: boolean;
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
    <Stack gap="md" mt="md">
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}
      {[...byPage.entries()].map(([url, items]) => (
        <Stack key={url} gap="xs">
          <Group gap="xs" wrap="nowrap">
            <Anchor
              className="page-pill"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              underline="never"
              title={url}
            >
              {pagePath(url)}
            </Anchor>
            <Text size="xs" c="dimmed">
              {items.length} komment
            </Text>
          </Group>
          {items.map((c) => (
            <div key={c.id} className="comment-card" data-status={c.status}>
              <Stack gap={8}>
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <Group gap="xs" wrap="nowrap">
                    <Avatar size={28} radius="xl" color="gray" variant="light">
                      {(c.authorName.trim()[0] ?? '?').toUpperCase()}
                    </Avatar>
                    <div>
                      <Text size="sm" fw={600} lh={1.2}>
                        {c.authorName}
                      </Text>
                      <Text size="xs" c="dimmed" lh={1.2}>
                        {dateTime(c.createdAt)}
                      </Text>
                    </div>
                  </Group>
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
                  {c.customerApprovedAt && (
                    <Badge size="sm" color="teal" variant="light">
                      ✓ az ügyfél elfogadta
                    </Badge>
                  )}
                  {c.notifiesCustomer && (
                    <Badge size="sm" color="gray" variant="light" title="Az ügyfél e-mailben értesül a válaszokról és a kész állapotról">
                      értesítést kér
                    </Badge>
                  )}
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
                  {roundOpen && deepLink(c.pageUrl, c.id) && (
                    <Button
                      component="a"
                      href={deepLink(c.pageUrl, c.id)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="compact-xs"
                      variant="light"
                    >
                      Megnyitás az oldalon
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
            </div>
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
