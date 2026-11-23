import { NextResponse, type NextRequest } from 'next/server';

/**
 * Szigorú Content-Security-Policy a felületre (production): minden kéréshez új nonce készül, a Next a saját scriptjeit és a
 * Mantine a színmód-scriptet ezzel engedélyezteti, más inline script nem fut. Fejlesztésben nincs CSP (a React dev módja
 * `eval`-t használ, és a hot reload is kényelmetlenné válna). A stíluson `unsafe-inline` van: a Mantine inline style
 * attribútumokat használ. A `/api` és a `/widget` útvonalakra nem vonatkozik (lásd matcher).
 */
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production') return NextResponse.next();

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [{ source: '/((?!api|widget|_next/static|_next/image|favicon.ico).*)', missing: [{ type: 'header', key: 'next-router-prefetch' }] }],
};
