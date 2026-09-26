import { isPulseDialogueArticle } from './pulseDialogue';

export type AuthorBylinePayload =
  | { enabled: false }
  | {
      enabled: true;
      snapshot: {
        name: string;
        publicDesignation?: string | null;
        photoUrl?: string | null;
        shortBio?: string | null;
      };
    };

export type AuthorBylineMetadata = {
  name: string;
  publicDesignation: string;
  photoUrl: string;
  shortBio: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function publicText(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : '';
}

function publicPhotoUrl(value: unknown): string {
  const candidate = publicText(value).trim();
  if (!candidate || /[\s\\\u0000-\u001f\u007f]/.test(candidate)) return '';
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate;
  try {
    const url = new URL(candidate);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? candidate : '';
  } catch {
    return '';
  }
}

export function getAuthorBylineMetadata(article: unknown): AuthorBylineMetadata | null {
  if (!isObject(article) || isPulseDialogueArticle(article) || !isObject(article.authorByline)) return null;
  const byline = article.authorByline;
  if (byline.enabled !== true || !isObject(byline.snapshot)) return null;
  const snapshot = byline.snapshot;
  const name = publicText(snapshot.name);
  if (!name) return null;

  return {
    name,
    publicDesignation: publicText(snapshot.publicDesignation),
    photoUrl: publicPhotoUrl(snapshot.photoUrl),
    shortBio: publicText(snapshot.shortBio),
  };
}