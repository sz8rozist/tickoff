import { json } from '@/lib/http';
import { isWidgetUnlocked } from '@/lib/widget-access';
import { openRound, roundInfoFull, widgetPreflight, widgetRoute } from '@/lib/widget';

export const dynamic = 'force-dynamic';

/** A projekt neve, oldala, a nyitott kör (null, ha nincs), a megjelenés és a nyelv. */
export const GET = widgetRoute('read', async ({ req, project }) => {
  // Jelszóval védett, még fel nem oldott widget: csak a megjelenéshez szükséges adatok, a tartalom nem
  if (!(await isWidgetUnlocked(req, project))) {
    return json({ name: project.name, siteUrl: project.siteUrl, openRound: null, color: project.widgetColor, position: project.widgetPosition, lang: project.widgetLang, locked: true });
  }
  const round = await openRound(project);
  return json({
    name: project.name,
    siteUrl: project.siteUrl,
    openRound: round ? await roundInfoFull(round) : null,
    color: project.widgetColor,
    position: project.widgetPosition,
    lang: project.widgetLang,
    locked: false,
  });
}, { open: true });

export const OPTIONS = widgetPreflight;
