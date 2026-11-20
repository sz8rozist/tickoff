import { useEffect, useState } from 'react';

export function App() {
  const [status, setStatus] = useState<string>('…');

  useEffect(() => {
    fetch('/actuator/health')
      .then((r) => r.json())
      .then((d) => setStatus(d.status))
      .catch(() => setStatus('nem elérhető'));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui', padding: 32 }}>
      <h1>Tickoff</h1>
      <p>Backend állapota: {status}</p>
    </main>
  );
}
