// A widget (Vite, IIFE) lefordított scriptjét a Next statikus mappájába másolja: /widget/tickoff-widget.js
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, '../../widget/dist/tickoff-widget.js');
const target = path.resolve(here, '../public/widget/tickoff-widget.js');

if (!existsSync(source)) {
  console.error('A widget még nincs lefordítva: futtasd előbb a widget build-jét (npm run build -w widget a gyökérben).');
  process.exit(1);
}
mkdirSync(path.dirname(target), { recursive: true });
copyFileSync(source, target);
console.log('Widget másolva:', path.relative(process.cwd(), target));
