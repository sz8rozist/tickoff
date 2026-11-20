import { useState, type FormEvent } from 'react';
import { api, ApiError, type User } from './api';

function errorMessage(e: unknown, mode: 'login' | 'register'): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Hibás e-mail vagy jelszó.';
    if (e.status === 409) return 'Ezzel az e-mail címmel már van fiók.';
    if (e.status === 400)
      return mode === 'register'
        ? 'Ellenőrizd az adatokat: érvényes e-mail és legalább 8 karakteres jelszó kell.'
        : 'Add meg az e-mail címet és a jelszót.';
  }
  return 'A szerver nem elérhető, próbáld újra később.';
}

export function AuthForm({ onAuth }: { onAuth: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user =
        mode === 'login'
          ? await api.login(email, password)
          : await api.register(email, password, name);
      onAuth(user);
    } catch (err) {
      setError(errorMessage(err, mode));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12, maxWidth: 320 }}>
      <h2>{mode === 'login' ? 'Belépés' : 'Regisztráció'}</h2>
      {mode === 'register' && (
        <input
          placeholder="Név"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          autoComplete="name"
        />
      )}
      <input
        type="email"
        placeholder="E-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      <input
        type="password"
        placeholder="Jelszó (min. 8 karakter)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={mode === 'register' ? 8 : undefined}
        maxLength={72}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
      />
      {error && <p role="alert" style={{ color: '#b00020', margin: 0 }}>{error}</p>}
      <button type="submit" disabled={busy}>
        {mode === 'login' ? 'Belépés' : 'Fiók létrehozása'}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          setError(null);
        }}
      >
        {mode === 'login' ? 'Még nincs fiókom' : 'Már van fiókom'}
      </button>
    </form>
  );
}
