import { useState } from 'react';

const styles = `
  .fab { position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
         padding: 10px 16px; border: 0; border-radius: 999px; background: #111;
         color: #fff; font: 14px system-ui, sans-serif; cursor: pointer; }
`;

export function Widget({ token }: { token: string }) {
  const [active, setActive] = useState(false);

  return (
    <>
      <style>{styles}</style>
      <button class="fab" onClick={() => setActive(!active)} title={token ? `projekt: ${token}` : ''}>
        {active ? 'Kommentelés kész' : 'Visszajelzés'}
      </button>
    </>
  );
}
