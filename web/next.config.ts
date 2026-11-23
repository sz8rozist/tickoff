import type { NextConfig } from 'next';

const config: NextConfig = {
  // Önálló kimenet: a Docker-kép csak a futáshoz kellő fájlokat tartalmazza
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        // A widget scriptet idegen oldalak töltik be: más origin-ről is használhatónak kell lennie, és rövid ideig gyorsítótárazható
        source: '/widget/:path*',
        headers: [
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
          { key: 'Cache-Control', value: 'public, max-age=300' },
        ],
      },
      {
        // A felület nem ágyazható be más oldalba, és a böngésző nem találgatja a típusokat
        source: '/((?!widget|api).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default config;
