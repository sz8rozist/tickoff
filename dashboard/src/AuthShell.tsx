import type { ReactNode } from 'react';
import { Stack, Text } from '@mantine/core';
import { Logo } from './Logo';

/** A belépő és a jelszó-visszaállító oldal közös kerete. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-inner">
        <Stack align="center" gap={8} mb="xl">
          <Logo size={52} />
          <Text component="h1" className="wordmark" fw={800} fz={32} lh={1.1} m={0}>
            Tickoff
          </Text>
          <Text c="dimmed" size="sm" ta="center">
            Ügyfél-visszajelzések egy helyen, körről körre.
          </Text>
        </Stack>
        {children}
      </div>
    </div>
  );
}
