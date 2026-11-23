import type { ReactNode } from 'react';
import {
  ActionIcon,
  AppShell,
  Avatar,
  Badge,
  Box,
  Burger,
  Group,
  Menu,
  Select,
  Text,
  TextInput,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { User } from './api';
import { useDashboard } from './DashboardContext';
import { Wordmark } from './Logo';
import { t } from './i18n';

export const PATH_PROJECTS = '/';
export const PATH_FEEDBACK = '/visszajelzesek';
export const PATH_CUSTOMERS = '/ugyfelek';
export const PATH_SETTINGS = '/beallitasok';

type IconName = 'folder' | 'inbox' | 'users' | 'settings' | 'search' | 'sun' | 'moon';

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (name) {
    case 'folder':
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
        </svg>
      );
    case 'inbox':
      return (
        <svg {...common}>
          <path d="M4 13l2.5-7.5A2 2 0 0 1 8.4 4h7.2a2 2 0 0 1 1.9 1.5L20 13" />
          <path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5h-5l-1.5 2h-3L9 13H4z" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
          <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14c1.8.6 3 2.2 3 5" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4 4" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...common}>
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      );
  }
}

const NAV = (): { path: string; label: string; icon: IconName }[] => [
  { path: PATH_PROJECTS, label: t('Projektek'), icon: 'folder' },
  { path: PATH_FEEDBACK, label: t('Visszajelzések'), icon: 'inbox' },
  { path: PATH_CUSTOMERS, label: t('Ügyfelek'), icon: 'users' },
  { path: PATH_SETTINGS, label: t('Beállítások'), icon: 'settings' },
];

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

const SEARCH_PLACEHOLDER = (): Record<string, string> => ({
  [PATH_PROJECTS]: t('Keresés a projektek között…'),
  [PATH_FEEDBACK]: t('Keresés a visszajelzésekben…'),
  [PATH_CUSTOMERS]: t('Keresés az ügyfelek között…'),
});

/** A dashboard váza: bal oldali navigáció, felső sáv (projektválasztó, keresés, téma, profil) és a tartalom. */
export function Shell({
  user,
  path,
  navigate,
  onLogout,
  children,
}: {
  user: User;
  path: string;
  navigate: (to: string) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [opened, { toggle, close }] = useDisclosure(false);
  const { projects, selected, select, query, setQuery } = useDashboard();
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('light');
  const active = (projects ?? []).filter((p) => p.archivedAt === null);
  const searchable = path in SEARCH_PLACEHOLDER();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 232, breakpoint: 'md', collapsed: { mobile: !opened } }}
      padding={{ base: 'md', md: 'xl' }}
      className="shell"
    >
      <AppShell.Header className="shell-header">
        <Group h="100%" px="md" gap="sm" wrap="nowrap">
          <Burger opened={opened} onClick={toggle} hiddenFrom="md" size="sm" aria-label={t('Menü')} />
          <Box visibleFrom="md" w={200} style={{ flex: 'none' }}>
            <UnstyledButton onClick={() => navigate(PATH_PROJECTS)} aria-label={t('Tickoff')}>
              <Wordmark size={30} />
            </UnstyledButton>
          </Box>
          <Select
            aria-label={t('Projekt választása')}
            placeholder={projects === null ? t('Betöltés…') : t('Nincs projekt')}
            data={active.map((p) => ({ value: String(p.id), label: p.name }))}
            value={selected ? String(selected.id) : null}
            onChange={(v) => v && select(Number(v))}
            allowDeselect={false}
            searchable
            nothingFoundMessage={t('Nincs ilyen projekt')}
            disabled={active.length === 0}
            w={{ base: 140, sm: 220 }}
            style={{ flex: 'none' }}
          />
          {searchable && (
            <TextInput
              aria-label={t('Keresés')}
              placeholder={SEARCH_PLACEHOLDER()[path]}
              leftSection={<Icon name="search" size={16} />}
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              style={{ flex: '1 1 auto', maxWidth: 420 }}
              visibleFrom="xs"
            />
          )}
          <Group gap="xs" ml="auto" wrap="nowrap">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              aria-label={computed === 'dark' ? t('Világos téma') : t('Sötét téma')}
              onClick={() => setColorScheme(computed === 'dark' ? 'light' : 'dark')}
            >
              <Icon name={computed === 'dark' ? 'sun' : 'moon'} />
            </ActionIcon>
            <Menu position="bottom-end" width={240} withinPortal>
              <Menu.Target>
                <UnstyledButton aria-label={t('Fiók menü')}>
                  <Avatar color="brand" variant="filled" radius="xl" size={34}>
                    {initials(user.name)}
                  </Avatar>
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
                <Menu.Item onClick={() => navigate(PATH_SETTINGS)}>{t('Beállítások')}</Menu.Item>
                <Menu.Item onClick={onLogout}>{t('Kilépés')}</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm" className="shell-nav">
        <nav aria-label={t('Fő navigáció')} className="nav-list">
          {NAV().map((item) => {
            const current = item.path === PATH_PROJECTS ? path === PATH_PROJECTS : path.startsWith(item.path);
            const openCount = item.path === PATH_FEEDBACK && selected ? selected.stats.open : 0;
            return (
              <UnstyledButton
                key={item.path}
                className="nav-item"
                data-active={current || undefined}
                aria-current={current ? 'page' : undefined}
                onClick={() => {
                  navigate(item.path);
                  close();
                }}
              >
                <Icon name={item.icon} />
                <span className="nav-label">{item.label}</span>
                {openCount > 0 && (
                  <Badge size="sm" variant="light" color="orange" ml="auto">
                    {openCount}
                  </Badge>
                )}
              </UnstyledButton>
            );
          })}
        </nav>
      </AppShell.Navbar>

      <AppShell.Main className="shell-main">
        <div className="page-enter" key={path}>
          {children}
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
