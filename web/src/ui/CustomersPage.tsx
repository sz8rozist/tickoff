import { useEffect, useMemo, useState } from 'react';
import { Alert, Avatar, Badge, Group, Loader, Stack, Table, Text, Title } from '@mantine/core';
import { api, type Comment } from './api';
import { fold, useDashboard } from './DashboardContext';

interface Customer {
  name: string;
  comments: number;
  open: number;
  pages: number;
  lastAt: string;
  notifies: boolean;
}

const dateTime = (iso: string) => new Date(iso).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' });

/** Az ügyfelek nem fiókok: a kommentek szerzőnevei alapján, a kiválasztott projekt összes körén át állítjuk össze őket. */
function summarize(comments: Comment[]): Customer[] {
  const byName = new Map<string, Customer & { pageSet: Set<string> }>();
  for (const c of comments) {
    const key = fold(c.authorName.trim());
    const cur = byName.get(key) ?? { name: c.authorName.trim(), comments: 0, open: 0, pages: 0, lastAt: c.createdAt, notifies: false, pageSet: new Set<string>() };
    cur.comments += 1;
    if (c.status !== 'DONE') cur.open += 1;
    cur.pageSet.add(c.pageUrl);
    if (c.createdAt > cur.lastAt) cur.lastAt = c.createdAt;
    if (c.notifiesCustomer) cur.notifies = true;
    byName.set(key, cur);
  }
  return [...byName.values()]
    .map(({ pageSet, ...rest }) => ({ ...rest, pages: pageSet.size }))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export function CustomersPage() {
  const { selected, query } = useDashboard();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [error, setError] = useState(false);
  const projectId = selected?.id ?? null;

  useEffect(() => {
    if (projectId === null) return;
    let cancelled = false;
    setComments(null);
    setError(false);
    api.rounds
      .list(projectId)
      .then((rounds) => Promise.all(rounds.map((r) => api.comments.list(projectId, r.id))))
      .then((lists) => {
        if (!cancelled) setComments(lists.flat());
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const customers = useMemo(() => (comments ? summarize(comments) : []), [comments]);
  const needle = fold(query.trim());
  const visible = customers.filter((c) => needle === '' || fold(c.name).includes(needle));

  if (!selected) {
    return (
      <div className="empty">
        <Text fw={600}>Nincs kiválasztott projekt</Text>
        <Text size="sm" c="dimmed">
          Az ügyfelek a projekt visszajelzéseiből jönnek létre. Válassz projektet a felső sávban.
        </Text>
      </div>
    );
  }

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Ügyfelek</Title>
        <Text size="sm" c="dimmed">
          {selected.name}: azok, akik visszajelzést küldtek a widgeten át
        </Text>
      </div>
      {error && (
        <Alert color="red" role="alert">
          Az ügyfelek betöltése nem sikerült.
        </Alert>
      )}
      {!comments && !error && <Loader size="sm" />}
      {comments && customers.length === 0 && (
        <div className="empty">
          <Text fw={600}>Még nem érkezett visszajelzés</Text>
          <Text size="sm" c="dimmed">
            Amint az ügyfél küld egy kommentet a widgeten, itt megjelenik.
          </Text>
        </div>
      )}
      {comments && customers.length > 0 && (
        <div className="panel-card flush">
          <Table.ScrollContainer minWidth={560}>
            <Table highlightOnHover className="data-table">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Ügyfél</Table.Th>
                  <Table.Th>Visszajelzés</Table.Th>
                  <Table.Th>Nyitott</Table.Th>
                  <Table.Th>Oldalak</Table.Th>
                  <Table.Th>Utolsó aktivitás</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visible.map((c) => (
                  <Table.Tr key={c.name}>
                    <Table.Td>
                      <Group gap="sm" wrap="nowrap">
                        <Avatar size={30} radius="xl" color="brand" variant="light">
                          {(c.name[0] ?? '?').toUpperCase()}
                        </Avatar>
                        <div>
                          <Text size="sm" fw={500}>
                            {c.name}
                          </Text>
                          {c.notifies && (
                            <Text size="xs" c="dimmed">
                              e-mail értesítést kér
                            </Text>
                          )}
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>{c.comments}</Table.Td>
                    <Table.Td>
                      {c.open > 0 ? (
                        <Badge variant="light" color="orange" size="sm">
                          {c.open}
                        </Badge>
                      ) : (
                        <Badge variant="light" color="green" size="sm">
                          0
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>{c.pages}</Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {dateTime(c.lastAt)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          {visible.length === 0 && (
            <Text size="sm" c="dimmed" p="md">
              Nincs a keresésnek megfelelő ügyfél.
            </Text>
          )}
        </div>
      )}
    </Stack>
  );
}
