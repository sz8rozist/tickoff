import type { ReactNode } from 'react';

export const metadata = {
  title: 'Tickoff',
  description: 'Ügyfél-visszajelzés weboldal-projektekhez',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="hu">
      <body>{children}</body>
    </html>
  );
}
