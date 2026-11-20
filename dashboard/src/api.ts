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

function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(path, init);
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
  commentCount: number;
  openCommentCount: number;
}

export type CommentStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE';

export interface Comment {
  id: number;
  authorName: string;
  body: string;
  pageUrl: string;
  cssSelector: string | null;
  posX: number | null;
  posY: number | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  userAgent: string | null;
  status: CommentStatus;
  hasScreenshot: boolean;
  createdAt: string;
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
    /** Új megosztó token: a régi azonnal érvénytelen, a vele beágyazott widgetek leállnak. */
    regenerateToken: (id: number) => request<Project>(`/api/projects/${id}/share-token`, { method: 'POST' }),
  },
  rounds: {
    list: (projectId: number) => request<Round[]>(`/api/projects/${projectId}/rounds`),
    open: (projectId: number) =>
      request<Round>(`/api/projects/${projectId}/rounds`, { method: 'POST' }),
    close: (projectId: number, roundId: number) =>
      request<Round>(`/api/projects/${projectId}/rounds/${roundId}/close`, { method: 'POST' }),
  },
  comments: {
    list: (projectId: number, roundId: number) =>
      request<Comment[]>(`/api/projects/${projectId}/rounds/${roundId}/comments`),
    setStatus: (projectId: number, commentId: number, status: CommentStatus) =>
      request<Comment>(`/api/projects/${projectId}/comments/${commentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    remove: (projectId: number, commentId: number) =>
      request<void>(`/api/projects/${projectId}/comments/${commentId}`, { method: 'DELETE' }),
    /** CSV-export: az egész projekt, vagy a megadott kör kommentjei. A fájlnevet a szerver adja. */
    async exportCsv(projectId: number, roundId?: number): Promise<{ blob: Blob; filename: string }> {
      const query = roundId !== undefined ? `?roundId=${roundId}` : '';
      const res = await authFetch(`/api/projects/${projectId}/comments/export${query}`);
      if (!res.ok) throw new ApiError(res.status);
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? 'tickoff-export.csv';
      return { blob: await res.blob(), filename };
    },
    // A képet JWT védi, ezért fejléccel kérjük le, nem <img src>-vel.
    async screenshot(projectId: number, commentId: number): Promise<Blob> {
      const res = await authFetch(`/api/projects/${projectId}/comments/${commentId}/screenshot`);
      if (!res.ok) throw new ApiError(res.status);
      return res.blob();
    },
  },
  account: {
    /** Fiók törlése a jelszóval megerősítve: a saját projektek is törlődnek. Nem visszavonható. */
    remove: (password: string) =>
      request<void>('/api/me', { method: 'DELETE', body: JSON.stringify({ password }) }),
  },
  logout: () => setToken(null),
};
