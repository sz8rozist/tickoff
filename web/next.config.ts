import type { NextConfig } from 'next';

const config: NextConfig = {
  // Önálló kimenet: a Docker-kép csak a futáshoz kellő fájlokat tartalmazza
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
};

export default config;
