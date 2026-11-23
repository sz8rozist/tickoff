'use client';

import dynamic from 'next/dynamic';

// A felület a böngészőre épül (localStorage, History API, ablakméret), ezért csak a kliensen renderelődik
const App = dynamic(() => import('../../ui/App').then((m) => m.App), { ssr: false });

export function ClientApp() {
  return <App />;
}
