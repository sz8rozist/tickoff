export interface User {
  id: number;
  email: string;
  name: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

const TOKEN_KEY = 'tickoff.token';

export class ApiError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* privát mód: a token csak a munkamenet idejére marad meg a memóriában */
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw new ApiError(res.status);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface Project {
  id: number;
  name: string;
  siteUrl: string;
  shareToken: string;
  createdAt: string;
}

export interface Round {
  id: number;
  number: number;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  closedAt: string | null;
}

export interface ProjectInput {
  name: string;
  siteUrl: string;
}

export const api = {
  async register(email: string, password: string, name: string): Promise<User> {
    const r = await request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    setToken(r.token);
    return r.user;
  },
  async login(email: string, password: string): Promise<User> {
    const r = await request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(r.token);
    return r.user;
  },
  me: () => request<User>('/api/me'),
  projects: {
    list: () => request<Project[]>('/api/projects'),
    create: (input: ProjectInput) =>
      request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: number, input: ProjectInput) =>
      request<Project>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    remove: (id: number) => request<void>(`/api/projects/${id}`, { method: 'DELETE' }),
  },
  rounds: {
    list: (projectId: number) => request<Round[]>(`/api/projects/${projectId}/rounds`),
    open: (projectId: number) =>
      request<Round>(`/api/projects/${projectId}/rounds`, { method: 'POST' }),
    close: (projectId: number, roundId: number) =>
      request<Round>(`/api/projects/${projectId}/rounds/${roundId}/close`, { method: 'POST' }),
  },
  logout: () => setToken(null),
};
