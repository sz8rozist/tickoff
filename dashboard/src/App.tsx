import { useEffect, useState } from 'react';
import { api, ApiError, getToken, type User } from './api';
import { AuthForm } from './AuthForm';
import { ProjectsPage } from './ProjectsPage';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  // Ha van mentett token, először megnézzük, érvényes-e.
  const [loading, setLoading] = useState<boolean>(() => getToken() !== null);

  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(setUser)
      .catch((e) => {
        // Csak akkor dobjuk el a tokent, ha a szerver tényleg elutasította (lejárt/érvénytelen).
        if (e instanceof ApiError && e.status === 401) api.logout();
      })
      .finally(() => setLoading(false));
  }, []);

  function logout() {
    api.logout();
    setUser(null);
  }

  if (loading) return <main style={{ padding: 32 }}>Betöltés…</main>;

  return (
    <main style={{ fontFamily: 'system-ui', padding: 32 }}>
      <h1>Tickoff</h1>
      {user ? (
        <>
          <p>Bejelentkezve: {user.name} ({user.email})</p>
          <button onClick={logout}>Kilépés</button>
          <ProjectsPage />
        </>
      ) : (
        <AuthForm onAuth={setUser} />
      )}
    </main>
  );
}
