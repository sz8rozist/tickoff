'use client';

import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { theme } from '../ui/theme';

/** A Mantine téma és a világos/sötét mód kezelése (alapból a rendszer beállítását követi). */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      {children}
    </MantineProvider>
  );
}
