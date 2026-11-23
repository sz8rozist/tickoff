import { requireUser } from '@/lib/auth/session';
import { startSetup } from '@/lib/auth/two-factor';
import { api, json } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** A kétlépcsős belépés beállítása: új titok és a hitelesítő alkalmazásba olvasható cím (a dashboard QR-kódot készít belőle). */
export const POST = api(async (req) => {
  const user = await requireUser(req);
  return json(await startSetup(user));
});
