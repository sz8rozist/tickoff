import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Indigó márkaszín: a gombok, kiemelések és a logó is ebből dolgoznak.
const brand: MantineColorsTuple = [
  '#eef0ff',
  '#dfe2fd',
  '#c0c5f7',
  '#9fa6f1',
  '#818aeb',
  '#6b75e6',
  '#5b64e3',
  '#4a52c9',
  '#3f47b4',
  '#323a9f',
];

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 5 },
  colors: { brand },
  defaultRadius: 'md',
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace',
  headings: {
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '1.75rem', lineHeight: '1.2' },
      h2: { fontSize: '1.375rem', lineHeight: '1.25' },
      h3: { fontSize: '1.125rem', lineHeight: '1.3' },
    },
  },
  components: {
    Button: { defaultProps: { fw: 600 } },
    Card: { defaultProps: { radius: 'lg', shadow: 'xs' } },
    Paper: { defaultProps: { radius: 'lg' } },
    Modal: { defaultProps: { radius: 'lg', overlayProps: { backgroundOpacity: 0.45, blur: 3 } } },
    Badge: { defaultProps: { fw: 600 } },
    SegmentedControl: { defaultProps: { radius: 'md' } },
    Menu: { defaultProps: { radius: 'md', shadow: 'md' } },
  },
});
