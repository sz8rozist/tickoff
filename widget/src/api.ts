import type { Config } from './config';

export type CommentStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE';

export interface ProjectInfo {
  name: string;
  siteUrl: string;
  openRound: RoundInfo | null;
}

export interface RoundInfo {
  id: number;
  number: number;
  /** Az ügyfél jóváhagyta a kört (minden komment kész volt). */
  approved: boolean;
  approvedBy: string | null;
}

/** Egy lezárt kör, csak olvasásra. */
export interface HistoryRound {
  number: number;
  closedAt: string;
  approved: boolean;
  approvedBy: string | null;
  comments: WidgetComment[];
}

export interface Reply {
  id: number;
  authorName: string;
  /** DESIGNER: a csapat tagja, CUSTOMER: ügyfél */
  authorType: 'DESIGNER' | 'CUSTOMER';
  body: string;
  createdAt: string;
}

export interface WidgetComment {
  id: number;
  authorName: string;
  body: string;
  pageUrl: string;
  cssSelector: string | null;
  posX: number | null;
  posY: number | null;
  /** A kijelölt terület mérete az elem méretének százalékában (null: egyetlen elem). */
  areaWidth: number | null;
  areaHeight: number | null;
  status: CommentStatus;
  hasScreenshot: boolean;
  /** Az ügyfél elfogadta a kész kommentet. */
  approved: boolean;
  createdAt: string;
  /** Az ügyfél módosította a szöveget. */
  edited: boolean;
  /** Csak a komment létrehozásának válaszában: a szerkesztéshez/visszavonáshoz szükséges titok és határideje. */
  editToken?: string | null;
  editableUntil?: string | null;
  replies: Reply[];
}

export interface NewComment {
  authorName: string;
  body: string;
  pageUrl: string;
  cssSelector: string;
  /** A kattintás helye az elem méretének százalékában (0–100). */
  posX: number;
  posY: number;
  areaWidth?: number;
  areaHeight?: number;
  viewportWidth: number;
  viewportHeight: number;
  /** Opcionális: ide megy az értesítés, ha a csapat válaszol. */
  customerEmail?: string;
}

export class ApiError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

export function createApi({ token, apiBase }: Config) {
  const base = `${apiBase}/api/widget/${encodeURIComponent(token)}`;

  async function json<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(base + path, init);
    if (!res.ok) throw new ApiError(res.status);
    return res.json() as Promise<T>;
  }

  return {
    project: () => json<ProjectInfo>('/project'),

    /** A nyitott kör összes kommentje (az összes oldalról), vagy egy oldaléi. */
    comments: (pageUrl?: string) =>
      json<WidgetComment[]>(pageUrl === undefined ? "/comments" : `/comments?pageUrl=${encodeURIComponent(pageUrl)}`),

    createComment: (c: NewComment) =>
      json<WidgetComment>('/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c),
      }),

    /** A lezárt körök (a legutóbbiak) kommentjei. */
    history: () => json<HistoryRound[]>('/history'),

    approveComment: (commentId: number) =>
      json<WidgetComment>(`/comments/${commentId}/approve`, { method: 'POST' }),

    reopenComment: (commentId: number, authorName: string, reason: string) =>
      json<WidgetComment>(`/comments/${commentId}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorName, reason }),
      }),

    approveRound: (authorName: string) =>
      json<RoundInfo>('/round/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorName }),
      }),

    /** A saját komment szövegének módosítása a határidőn belül (a titkot a komment létrehozásakor kaptuk). */
    editComment: (commentId: number, editToken: string, body: string) =>
      json<WidgetComment>(`/comments/${commentId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, editToken }),
      }),

    /** A saját komment visszavonása (törlése) a határidőn belül, ha még nem válaszoltak rá. */
    async withdrawComment(commentId: number, editToken: string): Promise<void> {
      const res = await fetch(`${base}/comments/${commentId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editToken }),
      });
      if (!res.ok) throw new ApiError(res.status);
    },

    createReply: (commentId: number, reply: { authorName: string; body: string }) =>
      json<Reply>(`/comments/${commentId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reply),
      }),

    /** Kép csatolása egy kommenthez (nyers törzs, max. 3 MB). */
    async uploadAttachment(commentId: number, image: Blob): Promise<void> {
      const res = await fetch(`${base}/comments/${commentId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': image.type || 'application/octet-stream' },
        body: image,
      });
      if (!res.ok) throw new ApiError(res.status);
    },

    async uploadScreenshot(commentId: number, image: Blob): Promise<void> {
      const res = await fetch(`${base}/comments/${commentId}/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': image.type },
        body: image,
      });
      if (!res.ok) throw new ApiError(res.status);
    },
  };
}

export type Api = ReturnType<typeof createApi>;
