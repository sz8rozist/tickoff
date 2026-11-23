import { z } from 'zod';

/** Projekt létrehozása és módosítása. */
export const ProjectBody = z.object({
  name: z.string().trim().min(1).max(160),
  siteUrl: z.string().trim().min(1).max(500).regex(/^https?:\/\/\S+$/, 'http(s) URL kell'),
});

/** WCAG-kontraszt a fehér szöveggel: legalább 3:1 (nagy, félkövér szöveghez elég). */
export function hasEnoughContrastWithWhite(hex: string): boolean {
  const lin = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return 1.05 / (luminance + 0.05) >= 3.0;
}
