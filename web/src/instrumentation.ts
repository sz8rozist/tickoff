/** A szerver indulásakor fut egyszer: itt indul az ütemező (összefoglaló e-mailek). Csak a Node futtatókörnyezetben. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startScheduler } = await import('./lib/scheduler');
  startScheduler();
}
