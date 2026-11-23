import { json } from '@/lib/http';
import { openRound, roundInfo, widgetPreflight, widgetRoute } from '@/lib/widget';

export const dynamic = 'force-dynamic';

/** A projekt neve, oldala, a nyitott kör (null, ha nincs), a megjelenés és a nyelv. */
export const GET = widgetRoute('read', async ({ project }) => {
  const round = await openRound(project);
  return json({
    name: project.name,
    siteUrl: project.siteUrl,
    openRound: round ? roundInfo(round) : null,
    color: project.widgetColor,
    position: project.widgetPosition,
    lang: project.widgetLang,
  });
});

export const OPTIONS = widgetPreflight;
