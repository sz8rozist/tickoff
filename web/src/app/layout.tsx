import '@mantine/core/styles.css';
import '../ui/styles.css';

import { ColorSchemeScript } from '@mantine/core';
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Tickoff',
  description: 'Ügyfél-visszajelzés weboldal-projektekhez: pontos jelölés, körök, jóváhagyás egy helyen.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

// A CSP-nonce minden kéréshez új, ezért az oldalakat kérésenként kell renderelni
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: ReactNode }) {
  // A proxy (CSP) kérésenként készít nonce-t; fejlesztésben nincs
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="hu" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" nonce={nonce} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
