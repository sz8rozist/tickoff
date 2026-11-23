import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Márkaszín: #2563EB (a 6-os árnyalat). Egyetlen akcentus, a siker színe a zöld (#16A34A).
const brand: MantineColorsTuple = [
  '#eff6ff',
  '#dbeafe',
  '#bfdbfe',
  '#93c5fd',
  '#60a5fa',
  '#3b82f6',
  '#2563eb',
  '#1d4ed8',
  '#1e40af',
  '#1e3a8a',
];

const green: MantineColorsTuple = [
  '#f0fdf4',
  '#dcfce7',
  '#bbf7d0',
  '#86efac',
  '#4ade80',
  '#22c55e',
  '#16a34a',
  '#15803d',
  '#166534',
  '#14532d',
];

// Hideg szürke skála: a világos téma keretszíne #E2E8F0 (gray.3), halvány szövege #64748B (gray.6)
const gray: MantineColorsTuple = [
  '#f8fafc',
  '#f1f5f9',
  '#eef2f6',
  '#e2e8f0',
  '#cbd5e1',
  '#94a3b8',
  '#64748b',
  '#475569',
  '#334155',
  '#1e293b',
];

// Sötét téma: a törzs #111827 (dark.7), a kártyák #1f2937 (dark.6)
const dark: MantineColorsTuple = [
  '#f3f4f6',
  '#d1d5db',
  '#9ca3af',
  '#6b7280',
  '#374151',
  '#2b3646',
  '#1f2937',
  '#111827',
  '#0b111e',
  '#070b14',
];

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 5 },
  colors: { brand, green, gray, dark },
  black: '#111827',
  defaultRadius: 'md',
  radius: { xs: '4px', sm: '6px', md: '10px', lg: '14px', xl: '20px' },
  shadows: {
    xs: '0 1px 2px rgba(17, 24, 39, 0.04), 0 1px 1px rgba(17, 24, 39, 0.03)',
    sm: '0 1px 3px rgba(17, 24, 39, 0.06), 0 2px 8px rgba(17, 24, 39, 0.04)',
    md: '0 4px 12px rgba(17, 24, 39, 0.07), 0 2px 4px rgba(17, 24, 39, 0.04)',
    lg: '0 12px 28px rgba(17, 24, 39, 0.1), 0 4px 8px rgba(17, 24, 39, 0.05)',
    xl: '0 24px 48px rgba(17, 24, 39, 0.14)',
  },
  fontFamily:
    '"Inter Variable", Inter, Geist, -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace: '"Geist Mono", ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace',
  headings: {
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '1.75rem', lineHeight: '1.2' },
      h2: { fontSize: '1.375rem', lineHeight: '1.25' },
      h3: { fontSize: '1.0625rem', lineHeight: '1.3' },
    },
  },
  components: {
    Button: { defaultProps: { fw: 500 } },
    Card: { defaultProps: { radius: 'lg', shadow: 'xs' } },
    Paper: { defaultProps: { radius: 'lg' } },
    Modal: { defaultProps: { radius: 'lg', overlayProps: { backgroundOpacity: 0.4, blur: 4 } } },
    Drawer: { defaultProps: { overlayProps: { backgroundOpacity: 0.4, blur: 4 } } },
    Badge: { defaultProps: { fw: 500 } },
    SegmentedControl: { defaultProps: { radius: 'md' } },
    Menu: { defaultProps: { radius: 'md', shadow: 'md' } },
    Table: { defaultProps: { verticalSpacing: 'sm' } },
  },
});
