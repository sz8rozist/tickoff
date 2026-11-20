import { render } from 'preact';
import { HOST_ID, readConfig } from './config';
import { Widget } from './Widget';

// A script tag attribútumait a modul betöltésekor kell kiolvasni (document.currentScript később már null).
const config = readConfig();

function mount() {
  if (!config || document.getElementById(HOST_ID)) return;

  // Shadow DOM: a widget stílusai és az oldal stílusai nem zavarják egymást.
  const host = document.createElement('div');
  host.id = HOST_ID;
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  shadow.appendChild(container);

  render(<Widget config={config} host={host} />, container);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
