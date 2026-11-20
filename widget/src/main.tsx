import { render } from 'preact';
import { Widget } from './Widget';

// Shadow DOM: a widget stílusai és az oldal stílusai nem zavarják egymást.
function mount() {
  const host = document.createElement('div');
  host.id = 'tickoff-widget-host';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  shadow.appendChild(container);

  // A projekt tokenjét a script tag data-token attribútumából olvassuk.
  const script = document.currentScript as HTMLScriptElement | null;
  const token = script?.dataset.token ?? '';

  render(<Widget token={token} />, container);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
