export interface User {
  id: number;
  email: string;
  name: string;
  /** E-mail értesítés új visszajelzésről */
  notifyEmail: boolean;
  /** Az e-mail-cím megerősítve (regisztrációkor levélben kapott linkkel). */
  emailVerified: boolean;
}

/** Függő meghívó: olyan címre, amelyhez még nincs megerősített fiók. */
export interface Invite {
  id: number;
  email: string;
  createdAt: string;
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

export type ProjectRole = 'OWNER' | 'MEMBER';

export interface Project {
  id: number;
  name: string;
  siteUrl: string;
  shareToken: string;
  createdAt: string;
  /** A bejelentkezett felhasználó szerepe a projektben: a tulajdonos mindent, a tag csak a visszajelzéseket kezelheti */
  role: ProjectRole;
  ownerName: string;
  /** Csak a tulajdonosnak jön vissza (a cím gyakran titkot tartalmaz). */
  webhookUrl: string | null;
  webhookSecret: string | null;
}

export interface WebhookTestResult {
  ok: boolean;
  status: number;
  error: string | null;
}

export interface Member {
  userId: number;
  name: string;
  email: string;
  role: ProjectRole;
}

export interface Round {
  id: number;
  number: number;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  closedAt: string | null;
  commentCount: number;
  openCommentCount: number;
  /** Az ügyfél jóváhagyta a kört (minden komment kész volt). */
  approvedAt: string | null;
  approvedBy: string | null;
}

export type CommentStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE';

export interface Reply {
  id: number;
  authorName: string;
  /** DESIGNER: bejelentkezett felhasználó, CUSTOMER: a widgeten át válaszoló ügyfél */
  authorType: 'DESIGNER' | 'CUSTOMER';
  body: string;
  createdAt: string;
}

export interface Attachment {
  id: number;
  contentType: string;
  size: number;
}

export interface Comment {
  id: number;
  authorName: string;
  body: string;
  pageUrl: string;
  cssSelector: string | null;
  posX: number | null;
  posY: number | null;
  /** Kijelölt terület mérete az elem méretének százalékában (null: egyetlen elem). */
  areaWidth: number | null;
  areaHeight: number | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  userAgent: string | null;
  status: CommentStatus;
  hasScreenshot: boolean;
  createdAt: string;
  /** Az ügyfél elfogadta a kész kommentet. */
  customerApprovedAt: string | null;
  /** Az ügyfél utólag módosította a szöveget. */
  editedAt: string | null;
  /** Az ügyfél e-mail-értesítést kért a válaszokról (a címet nem mutatjuk). */
  notifiesCustomer: boolean;
  /** A felelős csapattag, vagy null. */
  assigneeId: number | null;
  assigneeName: string | null;
  attachments: Attachment[];
  replies: Reply[];
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
  /** A regisztrációkor kapott linkkel megerősíti az e-mail-címet; érvénytelen vagy lejárt tokenre 400. */
  verifyEmail: (token: string) =>
    request<void>('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
  /** Új megerősítő levél kérése (percenként legfeljebb egy megy el). */
  resendVerification: () => request<void>('/api/me/verification', { method: 'POST' }),
  /** A válasz mindig 204, akár van ilyen fiók, akár nincs: a végpont nem árulja el, kinek van fiókja. */
  forgotPassword: (email: string) =>
    request<void>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  /** Új jelszó az e-mailben kapott tokennel; érvénytelen vagy lejárt tokenre 400. */
  resetPassword: (token: string, password: string) =>
    request<void>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  projects: {
    list: () => request<Project[]>('/api/projects'),
    create: (input: ProjectInput) =>
      request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: number, input: ProjectInput) =>
      request<Project>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    remove: (id: number) => request<void>(`/api/projects/${id}`, { method: 'DELETE' }),
    /** Webhook beállítása; `null` kikapcsolja. Érvénytelen (pl. belső hálózati) címre 400. */
    setWebhook: (id: number, url: string | null) =>
      request<Project>(`/api/projects/${id}/webhook`, { method: 'PUT', body: JSON.stringify({ url }) }),
    /** Teszt-üzenet a beállított webhookra; az eredményt azonnal visszaadja. */
    testWebhook: (id: number) => request<WebhookTestResult>(`/api/projects/${id}/webhook/test`, { method: 'POST' }),
    /** Új megosztó token: a régi azonnal érvénytelen, a vele beágyazott widgetek leállnak. */
    regenerateToken: (id: number) => request<Project>(`/api/projects/${id}/share-token`, { method: 'POST' }),
  },
  members: {
    list: (projectId: number) => request<Member[]>(`/api/projects/${projectId}/members`),
    /** Meghívás e-mail-cím alapján (csak a tulajdonos); a címhez már létező fióknak kell tartoznia. */
    add: (projectId: number, email: string) =>
      request<Member>(`/api/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify({ email }) }),
    /** Függő meghívók (csak a tulajdonos). */
    invites: (projectId: number) => request<Invite[]>(`/api/projects/${projectId}/members/invites`),
    /** Meghívó még nem megerősítetten regisztrált kollégának: levelet kap, a regisztráció és megerősítés után tag lesz. */
    invite: (projectId: number, email: string) =>
      request<Invite>(`/api/projects/${projectId}/members/invites`, { method: 'POST', body: JSON.stringify({ email }) }),
    cancelInvite: (projectId: number, inviteId: number) =>
      request<void>(`/api/projects/${projectId}/members/invites/${inviteId}`, { method: 'DELETE' }),
    /** A projekt átadása egy tagnak (csak a tulajdonos): az új tulajdonos mindent megkap, a régi tag marad. */
    transferOwnership: (projectId: number, userId: number) =>
      request<Member[]>(`/api/projects/${projectId}/members/${userId}/transfer-ownership`, { method: 'POST' }),
    /** A tulajdonos bárkit eltávolíthat, a tag csak saját magát (kilépés). */
    remove: (projectId: number, userId: number) =>
      request<void>(`/api/projects/${projectId}/members/${userId}`, { method: 'DELETE' }),
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
    reply: (projectId: number, commentId: number, body: string) =>
      request<Reply>(`/api/projects/${projectId}/comments/${commentId}/replies`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    /** Felelős kijelölése; `null` törli. Csak a projekt csapatának tagja lehet felelős. */
    assign: (projectId: number, commentId: number, userId: number | null) =>
      request<Comment>(`/api/projects/${projectId}/comments/${commentId}/assignee`, {
        method: 'PUT',
        body: JSON.stringify({ userId }),
      }),
    removeReply: (projectId: number, commentId: number, replyId: number) =>
      request<void>(`/api/projects/${projectId}/comments/${commentId}/replies/${replyId}`, { method: 'DELETE' }),
    /** CSV-export: az egész projekt, vagy a megadott kör kommentjei. A fájlnevet a szerver adja. */
    async exportCsv(projectId: number, roundId?: number): Promise<{ blob: Blob; filename: string }> {
      const query = roundId !== undefined ? `?roundId=${roundId}` : '';
      const res = await authFetch(`/api/projects/${projectId}/comments/export${query}`);
      if (!res.ok) throw new ApiError(res.status);
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? 'tickoff-export.csv';
      return { blob: await res.blob(), filename };
    },
    // A mellékletek is JWT mögött vannak, ezért ezeket is fejléccel kérjük le.
    async attachment(projectId: number, commentId: number, attachmentId: number): Promise<Blob> {
      const res = await authFetch(`/api/projects/${projectId}/comments/${commentId}/attachments/${attachmentId}`);
      if (!res.ok) throw new ApiError(res.status);
      return res.blob();
    },
    // A képet JWT védi, ezért fejléccel kérjük le, nem <img src>-vel.
    async screenshot(projectId: number, commentId: number): Promise<Blob> {
      const res = await authFetch(`/api/projects/${projectId}/comments/${commentId}/screenshot`);
      if (!res.ok) throw new ApiError(res.status);
      return res.blob();
    },
  },
  account: {
    /** Az e-mail értesítések be- és kikapcsolása. */
    setNotifyEmail: (notifyEmail: boolean) =>
      request<User>('/api/me', { method: 'PATCH', body: JSON.stringify({ notifyEmail }) }),
    /** Fiók törlése a jelszóval megerősítve: a saját projektek is törlődnek. Nem visszavonható. */
    remove: (password: string) =>
      request<void>('/api/me', { method: 'DELETE', body: JSON.stringify({ password }) }),
  },
  logout: () => setToken(null),
};
