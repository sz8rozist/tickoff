import type { Config } from './config';

export type CommentStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE';

export interface ProjectInfo {
  name: string;
  siteUrl: string;
  openRound: { id: number; number: number } | null;
}

export interface WidgetComment {
  id: number;
  authorName: string;
  body: string;
  pageUrl: string;
  cssSelector: string | null;
  posX: number | null;
  posY: number | null;
  status: CommentStatus;
  hasScreenshot: boolean;
  createdAt: string;
}

export interface NewComment {
  authorName: string;
  body: string;
  pageUrl: string;
  cssSelector: string;
  /** A kattintás helye az elem méretének százalékában (0–100). */
  posX: number;
  posY: number;
  viewportWidth: number;
  viewportHeight: number;
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

    comments: (pageUrl: string) => json<WidgetComment[]>(`/comments?pageUrl=${encodeURIComponent(pageUrl)}`),

    createComment: (c: NewComment) =>
      json<WidgetComment>('/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c),
      }),

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
