import { useEffect, useState } from 'react';
import {
  Alert,
  Anchor,
  Avatar,
  Badge,
  Button,
  Checkbox,
  Code,
  Drawer,
  Group,
  Image,
  Loader,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Table,
  TagsInput,
} from '@mantine/core';
import { api, type Comment, type CommentStatus, type Member, type Priority } from './api';
import { fold, useDashboard } from './DashboardContext';
import { Thread } from './Thread';

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Nyitott' },
  { value: 'IN_PROGRESS', label: 'Folyamatban' },
  { value: 'DONE', label: 'Kész' },
];

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'URGENT', label: 'Sürgős' },
  { value: 'HIGH', label: 'Magas' },
  { value: 'NORMAL', label: 'Normál' },
  { value: 'LOW', label: 'Alacsony' },
];

const PRIORITY_COLOR: Record<Priority, string> = { URGENT: 'red', HIGH: 'orange', NORMAL: 'gray', LOW: 'gray' };
const STATUS_COLOR: Record<CommentStatus, string> = { OPEN: 'orange', IN_PROGRESS: 'brand', DONE: 'green' };

const PRIORITY_RANK: Record<Priority, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

const SORT_OPTIONS = [
  { value: 'PRIORITY', label: 'Prioritás szerint' },
  { value: 'OLDEST', label: 'Legrégebbi elöl' },
  { value: 'NEWEST', label: 'Legújabb elöl' },
  { value: 'STATUS', label: 'Státusz szerint' },
  { value: 'REPLIES', label: 'Legtöbb válasz elöl' },
];

/** A "teendő" sorrendje: előbb a nyitott, aztán a folyamatban lévő, végül a kész. */
const STATUS_RANK: Record<CommentStatus, number> = { OPEN: 0, IN_PROGRESS: 1, DONE: 2 };

const STATUS_FILTER = [{ value: 'ALL', label: 'Mind' }, ...STATUS_OPTIONS];

const ASSIGNEE_FILTER = [
  { value: 'ALL', label: 'Bárki' },
  { value: 'ME', label: 'Hozzám rendelt' },
  { value: 'NONE', label: 'Gazdátlan' },
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
  team,
  currentUserId,
  onChanged,
}: {
  projectId: number;
  roundId: number;
  /** A csapat tagjai a felelős kijelöléséhez. */
  team: Member[];
  currentUserId: number;
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
  const [gallery, setGallery] = useState<{ comment: Comment; urls: string[]; failed: boolean } | null>(null);
  // A keresés a felső sávból jön (minden nézetben ugyanaz a mező)
  const { query, setQuery } = useDashboard();
  const [view, setViewState] = useState<'cards' | 'table'>(() => {
    try {
      return window.localStorage.getItem('tickoff.commentView') === 'table' ? 'table' : 'cards';
    } catch {
      return 'cards';
    }
  });
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [sort, setSort] = useState('OLDEST');
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  // A tömeges művelethez kijelölt kommentek
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');

  function setView(v: 'cards' | 'table') {
    setViewState(v);
    try {
      window.localStorage.setItem('tickoff.commentView', v);
    } catch {
      /* a választás csak a munkamenetre szól */
    }
  }

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

  // A mellékletek object URL-jeit felszabadítjuk, amikor lecserélődnek vagy a galéria bezárul.
  useEffect(() => {
    const urls = gallery?.urls ?? [];
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [gallery?.urls]);

  async function showAttachments(c: Comment) {
    setGallery({ comment: c, urls: [], failed: false });
    try {
      const blobs = await Promise.all(c.attachments.map((a) => api.comments.attachment(projectId, c.id, a.id)));
      setGallery({ comment: c, urls: blobs.map((b) => URL.createObjectURL(b)), failed: false });
    } catch {
      setGallery({ comment: c, urls: [], failed: true });
    }
  }

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

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  /** Egy művelet a kijelölt kommentek mindegyikén; a sikeres eredmények bekerülnek a listába, a hibákról összesítést adunk. */
  async function bulk(action: (c: Comment) => Promise<Comment>, failureMessage: string) {
    const targets = (comments ?? []).filter((c) => selected.has(c.id));
    if (targets.length === 0) return;
    setError(null);
    setBulkBusy(true);
    const results = await Promise.allSettled(targets.map(action));
    const updated = new Map<number, Comment>();
    let failed = 0;
    results.forEach((r) => {
      if (r.status === 'fulfilled') updated.set(r.value.id, r.value);
      else failed++;
    });
    setComments((prev) => prev?.map((x) => updated.get(x.id) ?? x) ?? null);
    // A sikeresen módosítottak kikerülnek a kijelölésből, a hibásak megmaradnak az újrapróbáláshoz
    setSelected((prev) => new Set([...prev].filter((id) => !updated.has(id))));
    if (failed > 0) setError(`${failureMessage} (${failed} komment)`);
    onChanged();
    setBulkBusy(false);
  }

  async function triage(c: Comment, priority: Priority, labels: string[]) {
    setError(null);
    setBusyId(c.id);
    try {
      const updated = await api.comments.triage(projectId, c.id, priority, labels);
      setComments((prev) => prev?.map((x) => (x.id === c.id ? updated : x)) ?? null);
    } catch {
      setError('A prioritás vagy a címkék mentése nem sikerült.');
    } finally {
      setBusyId(null);
    }
  }

  async function assign(c: Comment, userId: number | null) {
    setError(null);
    setBusyId(c.id);
    try {
      const updated = await api.comments.assign(projectId, c.id, userId);
      setComments((prev) => prev?.map((x) => (x.id === c.id ? updated : x)) ?? null);
    } catch {
      setError('A felelős kijelölése nem sikerült.');
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

  const needle = fold(query.trim());
  const visible = comments.filter((c) => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (assigneeFilter === 'ME' && c.assigneeId !== currentUserId) return false;
    if (assigneeFilter === 'NONE' && c.assigneeId !== null) return false;
    if (labelFilter !== null && !c.labels.includes(labelFilter)) return false;
    if (priorityFilter !== null && c.priority !== priorityFilter) return false;
    if (needle === '') return true;
    const haystack = fold(
      [c.authorName, c.body, pagePath(c.pageUrl), c.assigneeName ?? '', ...c.labels, ...c.replies.map((r) => r.body)].join(' '),
    );
    return haystack.includes(needle);
  });
  visible.sort((a, b) => {
    switch (sort) {
      case 'PRIORITY':
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt);
      case 'NEWEST':
        return b.createdAt.localeCompare(a.createdAt);
      case 'STATUS':
        return STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.createdAt.localeCompare(b.createdAt);
      case 'REPLIES':
        return b.replies.length - a.replies.length || a.createdAt.localeCompare(b.createdAt);
      default:
        return a.createdAt.localeCompare(b.createdAt);
    }
  });
  const selectedCount = comments.filter((c) => selected.has(c.id)).length;
  const allLabels = [...new Set(comments.flatMap((c) => c.labels))].sort();
  const filtering = statusFilter !== 'ALL' || assigneeFilter !== 'ALL' || labelFilter !== null || priorityFilter !== null || needle !== '';

  // Oldalanként csoportosítjuk: "a második oldalon az a gomb" típusú visszajelzések így egy helyen vannak.
  const byPage = new Map<string, Comment[]>();
  for (const c of visible) {
    byPage.set(c.pageUrl, [...(byPage.get(c.pageUrl) ?? []), c]);
  }

  const renderCard = (c: Comment) => (
<div className="comment-card" data-status={c.status}>
              <Stack gap={8}>
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <Group gap="xs" wrap="nowrap">
                    <Checkbox
                      size="xs"
                      aria-label={`Kijelölés: ${c.authorName} kommentje`}
                      checked={selected.has(c.id)}
                      onChange={() => toggleSelected(c.id)}
                    />
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
                <Group gap="xs" align="flex-start">
                <Select
                  size="xs"
                  w={130}
                  aria-label="Prioritás"
                  allowDeselect={false}
                  data={PRIORITY_OPTIONS}
                  value={c.priority}
                  disabled={busyId === c.id}
                  onChange={(v) => v && void triage(c, v as Priority, c.labels)}
                />
                <TagsInput
                  size="xs"
                  w={260}
                  placeholder="Címkék (Enter)"
                  aria-label="Címkék"
                  maxTags={5}
                  data={allLabels}
                  value={c.labels}
                  disabled={busyId === c.id}
                  onChange={(v) => void triage(c, c.priority, v)}
                />
                <Select
                  size="xs"
                  w={220}
                  placeholder="Nincs felelős"
                  aria-label="Felelős"
                  clearable
                  searchable
                  nothingFoundMessage="Nincs ilyen tag"
                  disabled={busyId === c.id}
                  data={team.map((m) => ({
                    value: String(m.userId),
                    label: m.userId === currentUserId ? `${m.name} (te)` : m.name,
                  }))}
                  value={c.assigneeId === null ? null : String(c.assigneeId)}
                  onChange={(v) => void assign(c, v === null ? null : Number(v))}
                />
                </Group>
                <Group gap="xs">
                  {c.cssSelector && <Code>{c.cssSelector}</Code>}
                  {(c.priority === 'URGENT' || c.priority === 'HIGH') && (
                    <Badge size="sm" color={c.priority === 'URGENT' ? 'red' : 'orange'} variant="filled">
                      {c.priority === 'URGENT' ? 'sürgős' : 'magas'}
                    </Badge>
                  )}
                  {c.editedAt && (
                    <Badge size="sm" color="yellow" variant="light" title={`Módosítva: ${dateTime(c.editedAt)}`}>
                      szerkesztve
                    </Badge>
                  )}
                  {c.areaWidth !== null && (
                    <Badge size="sm" color="gray" variant="light" title="Az ügyfél téglalappal jelölte ki a területet">
                      kijelölt terület
                    </Badge>
                  )}
                  {c.customerApprovedAt && (
                    <Badge size="sm" color="green" variant="light">
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
                  {c.attachments.length > 0 && (
                    <Button size="compact-xs" variant="light" onClick={() => showAttachments(c)}>
                      Mellékletek ({c.attachments.length})
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
  );

  const detail = detailId === null ? null : (comments.find((c) => c.id === detailId) ?? null);

  return (
    <Stack gap="md" mt="md">
      <Group gap="xs" align="center">
        <Select
          size="xs"
          w={170}
          aria-label="Rendezés"
          allowDeselect={false}
          data={SORT_OPTIONS}
          value={sort}
          onChange={(v) => setSort(v ?? 'OLDEST')}
        />
        {allLabels.length > 0 && (
          <Select
            size="xs"
            w={150}
            placeholder="Címke"
            aria-label="Szűrés címkére"
            clearable
            data={allLabels}
            value={labelFilter}
            onChange={setLabelFilter}
          />
        )}
        <SegmentedControl size="xs" data={STATUS_FILTER} value={statusFilter} onChange={setStatusFilter} aria-label="Szűrés státuszra" />
        <SegmentedControl size="xs" data={ASSIGNEE_FILTER} value={assigneeFilter} onChange={setAssigneeFilter} aria-label="Szűrés felelősre" />
        <Select
          size="xs"
          w={140}
          placeholder="Prioritás"
          aria-label="Szűrés prioritásra"
          clearable
          data={PRIORITY_OPTIONS}
          value={priorityFilter}
          onChange={setPriorityFilter}
        />
        <SegmentedControl
          size="xs"
          ml="auto"
          aria-label="Nézet"
          value={view}
          onChange={(v) => setView(v as 'cards' | 'table')}
          data={[
            { value: 'cards', label: 'Kártyák' },
            { value: 'table', label: 'Táblázat' },
          ]}
        />
      </Group>
      {filtering && (
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            {visible.length} / {comments.length} komment
          </Text>
          <Button
            size="compact-xs"
            variant="subtle"
            onClick={() => {
              setQuery('');
              setStatusFilter('ALL');
              setAssigneeFilter('ALL');
              setLabelFilter(null);
              setPriorityFilter(null);
            }}
          >
            Szűrők törlése
          </Button>
        </Group>
      )}
      {visible.length > 0 && (
        <Group gap="xs" align="center">
          <Checkbox
            size="xs"
            label={selectedCount > 0 ? `${selectedCount} kijelölve` : 'Kijelölés'}
            checked={selectedCount > 0 && visible.every((c) => selected.has(c.id))}
            indeterminate={selectedCount > 0 && !visible.every((c) => selected.has(c.id))}
            onChange={(e) =>
              setSelected(e.currentTarget.checked ? new Set([...selected, ...visible.map((c) => c.id)]) : new Set())
            }
          />
          {selectedCount > 0 && (
            <>
              <Text size="xs" c="dimmed">
                Státusz:
              </Text>
              {STATUS_OPTIONS.map((o) => (
                <Button
                  key={o.value}
                  size="compact-xs"
                  variant="light"
                  disabled={bulkBusy}
                  onClick={() =>
                    void bulk((c) => api.comments.setStatus(projectId, c.id, o.value as CommentStatus), 'A státusz módosítása nem sikerült')
                  }
                >
                  {o.label}
                </Button>
              ))}
              <Select
                size="xs"
                w={180}
                placeholder="Felelős kijelölése…"
                aria-label="Felelős a kijelölteknek"
                clearable
                disabled={bulkBusy}
                data={team.map((m) => ({ value: String(m.userId), label: m.userId === currentUserId ? `${m.name} (te)` : m.name }))}
                value={null}
                onChange={(v) =>
                  v !== null && void bulk((c) => api.comments.assign(projectId, c.id, Number(v)), 'A felelős kijelölése nem sikerült')
                }
              />
              <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setSelected(new Set())}>
                Kijelölés törlése
              </Button>
            </>
          )}
        </Group>
      )}
      {visible.length === 0 && (
        <Text size="sm" c="dimmed">
          Nincs a szűrésnek megfelelő komment.
        </Text>
      )}
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}
      {view === 'table' && visible.length > 0 && (
        <div className="panel-card flush">
          <Table.ScrollContainer minWidth={720}>
            <Table highlightOnHover className="data-table">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={36} />
                  <Table.Th>Visszajelzés</Table.Th>
                  <Table.Th>Oldal</Table.Th>
                  <Table.Th>Prioritás</Table.Th>
                  <Table.Th>Státusz</Table.Th>
                  <Table.Th>Felelős</Table.Th>
                  <Table.Th>Idő</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visible.map((c) => (
                  <Table.Tr key={c.id} className="row-link" onClick={() => setDetailId(c.id)}>
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        size="xs"
                        aria-label={`Kijelölés: ${c.authorName} kommentje`}
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelected(c.id)}
                      />
                    </Table.Td>
                    <Table.Td maw={340}>
                      <Text size="sm" fw={500} lineClamp={1}>
                        {c.body}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {c.authorName}
                        {c.replies.length > 0 ? ` · ${c.replies.length} válasz` : ''}
                      </Text>
                    </Table.Td>
                    <Table.Td maw={180}>
                      <Text size="xs" c="dimmed" lineClamp={1} title={c.pageUrl}>
                        {pagePath(c.pageUrl)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="light" color={PRIORITY_COLOR[c.priority]}>
                        {PRIORITY_OPTIONS.find((o) => o.value === c.priority)?.label}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="light" color={STATUS_COLOR[c.status]}>
                        {STATUS_OPTIONS.find((o) => o.value === c.status)?.label}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {c.assigneeName ?? '–'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {dateTime(c.createdAt)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </div>
      )}
      <Drawer opened={detail !== null} onClose={() => setDetailId(null)} position="right" size="lg" title="Visszajelzés részletei">
        {detail && renderCard(detail)}
      </Drawer>
      {view === 'cards' && [...byPage.entries()].map(([url, items]) => (
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
            <div key={c.id}>{renderCard(c)}</div>
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

      <Modal opened={gallery !== null} onClose={() => setGallery(null)} title="Mellékletek" size="xl" centered>
        {gallery?.failed && <Alert color="red">A mellékletek betöltése nem sikerült.</Alert>}
        {gallery && !gallery.failed && gallery.urls.length === 0 && <Loader size="sm" />}
        <Stack>
          {gallery?.urls.map((url, i) => (
            <Image key={url} src={url} alt={`${i + 1}. melléklet: ${gallery.comment.body.slice(0, 60)}`} fit="contain" />
          ))}
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
