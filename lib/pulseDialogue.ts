import { getCategoryRouteKey } from './categoryKeys';

export type PulseDialoguePhoto = {
  url?: string | null;
  src?: string | null;
  assetUrl?: string | null;
  mediaUrl?: string | null;
  secureUrl?: string | null;
  secure_url?: string | null;
  cloudinaryUrl?: string | null;
  publicId?: string | null;
  alt?: string | null;
  altText?: string | null;
  caption?: string | null;
  asset?: PulseDialoguePhoto | null;
  image?: PulseDialoguePhoto | null;
  media?: PulseDialoguePhoto | PulseDialoguePhoto[] | null;
  file?: PulseDialoguePhoto | null;
  photo?: PulseDialoguePhoto | null;
};

export type PulseDialogueContributor = {
  id?: string | null;
  name?: string | null;
  canonicalName?: string | null;
  photo?: PulseDialoguePhoto | null;
  photoUrl?: string | null;
  contributorPhotoUrl?: string | null;
  photoAlt?: string | null;
  contributorPhotoAlt?: string | null;
  publicDesignation?: string | null;
  affiliation?: string | null;
  shortBio?: string | null;
  slug?: string | null;
  website?: string | null;
  socialLinks?: Record<string, string> | null;
};

export type PulseDialogueBylineSnapshot = {
  name?: string | null;
  designation?: string | null;
  affiliation?: string | null;
  photo?: PulseDialoguePhoto | null;
  photoUrl?: string | null;
  contributorPhotoUrl?: string | null;
  photoAlt?: string | null;
  contributorPhotoAlt?: string | null;
};

export type PulseDialoguePayload = {
  contributorId?: string | null;
  contributor?: PulseDialogueContributor | null;
  bylineSnapshot?: PulseDialogueBylineSnapshot | null;
  contributorPhotoUrl?: string | null;
  contributorPhotoAlt?: string | null;
  dialogueFormat?: string | null;
  series?: string | null;
  bylineDesignationOverride?: string | null;
  contributorDisclosure?: string | null;
  editorNote?: string | null;
  contributorDisclaimer?: string | null;
  showAboutContributor?: boolean | null;
};

export type PulseDialogueMetadata = {
  isPulseDialogue: boolean;
  contributorId: string;
  dialogueFormat: string;
  series: string;
  contributorName: string;
  contributorDesignation: string;
  contributorAffiliation: string;
  contributorPhotoUrl: string;
  contributorPhotoAlt: string;
  contributorShortBio: string;
  contributorDisclosure: string;
  editorNote: string;
  contributorDisclaimer: string;
  showAboutContributor: boolean;
};

export const PULSE_DIALOGUE_CATEGORY = 'pulse-dialogue';

const DIALOGUE_FORMAT_LABEL_KEYS: Record<string, string> = {
  column: 'pulseDialogue.formats.column',
  guest_column: 'pulseDialogue.formats.guestColumn',
  essay: 'pulseDialogue.formats.essay',
  viewpoint: 'pulseDialogue.formats.viewpoint',
  conversation: 'pulseDialogue.formats.conversation',
  interview: 'pulseDialogue.formats.interview',
  literary_essay: 'pulseDialogue.formats.literaryEssay',
  culture_ideas: 'pulseDialogue.formats.cultureIdeas',
  expert_perspective: 'pulseDialogue.formats.expertPerspective',
  open_letter: 'pulseDialogue.formats.openLetter',
};

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function photoUrl(photo: unknown): string {
  if (typeof photo === 'string') return cleanText(photo);
  if (!isObject(photo)) return '';
  const direct = cleanText(photo.url || photo.src || photo.photoUrl || photo.contributorPhotoUrl || photo.assetUrl || photo.mediaUrl || photo.secureUrl || photo.secure_url || photo.cloudinaryUrl);
  if (direct) return direct;
  for (const nested of [photo.asset, photo.image, photo.media, photo.file, photo.photo]) {
    if (Array.isArray(nested)) {
      for (const item of nested) {
        const url = photoUrl(item);
        if (url) return url;
      }
      continue;
    }
    const url = photoUrl(nested);
    if (url) return url;
  }
  return '';
}

function photoAlt(photo: unknown): string {
  if (!isObject(photo)) return '';
  const direct = cleanText(photo.alt || photo.altText || photo.photoAlt || photo.contributorPhotoAlt || photo.caption);
  if (direct) return direct;
  for (const nested of [photo.asset, photo.image, photo.media, photo.file, photo.photo]) {
    if (Array.isArray(nested)) {
      for (const item of nested) {
        const alt = photoAlt(item);
        if (alt) return alt;
      }
      continue;
    }
    const alt = photoAlt(nested);
    if (alt) return alt;
  }
  return '';
}

export function isPulseDialogueArticle(article: unknown): boolean {
  const item = isObject(article) ? article : null;
  return getCategoryRouteKey(item?.category || item?.categoryKey || item?.section || '') === PULSE_DIALOGUE_CATEGORY;
}

export function getPulseDialogueFormatLabelKey(format: unknown): string {
  const normalized = cleanText(format).toLowerCase();
  return DIALOGUE_FORMAT_LABEL_KEYS[normalized] || '';
}

export function getPulseDialogueFormatLabel(format: unknown, t?: (key: string) => string): string {
  const key = getPulseDialogueFormatLabelKey(format);
  if (!key) return '';
  const translated = t ? cleanText(t(key)) : '';
  if (translated && translated !== key) return translated;
  return cleanText(format)
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getPulseDialogueDefaultDisclaimer(t?: (key: string) => string): string {
  const key = 'pulseDialogue.article.defaultDisclaimer';
  const translated = t ? cleanText(t(key)) : '';
  if (translated && translated !== key) return translated;
  return 'The views expressed in this contribution are those of the author and do not necessarily represent the editorial position of News Pulse.';
}

export function resolvePulseDialogueDisclaimer(value: unknown, t?: (key: string) => string): string {
  const text = cleanText(value);
  if (!text) return '';
  const defaultEnglish = getPulseDialogueDefaultDisclaimer();
  if (/^(1|true|yes|enabled|default)$/i.test(text)) return getPulseDialogueDefaultDisclaimer(t);
  if (text.toLowerCase() === defaultEnglish.toLowerCase()) return getPulseDialogueDefaultDisclaimer(t);
  return text;
}

export function getPulseDialogueMetadata(article: unknown): PulseDialogueMetadata | null {
  const item = isObject(article) ? article : null;
  if (!item || !isPulseDialogueArticle(item)) return null;
  const pulse = isObject(item.pulseDialogue) ? item.pulseDialogue as PulseDialoguePayload : null;
  if (!pulse) return null;

  const contributor = isObject(pulse.contributor) ? pulse.contributor : {};
  const snapshot = isObject(pulse.bylineSnapshot) ? pulse.bylineSnapshot : {};
  const snapshotPhoto = snapshot.photo;
  const contributorPhoto = contributor.photo;
  const resolvedPhotoUrl = photoUrl(snapshotPhoto) || photoUrl(snapshot) || photoUrl(pulse.contributorPhotoUrl) || photoUrl(contributorPhoto) || photoUrl(contributor);
  const contributorName = cleanText(snapshot.name) || cleanText(contributor.name) || cleanText(contributor.canonicalName);

  return {
    isPulseDialogue: true,
    contributorId: cleanText(pulse.contributorId || contributor.id),
    dialogueFormat: cleanText(pulse.dialogueFormat),
    series: cleanText(pulse.series),
    contributorName,
    contributorDesignation: cleanText(snapshot.designation) || cleanText(pulse.bylineDesignationOverride) || cleanText(contributor.publicDesignation),
    contributorAffiliation: cleanText(snapshot.affiliation) || cleanText(contributor.affiliation),
    contributorPhotoUrl: resolvedPhotoUrl,
    contributorPhotoAlt: photoAlt(snapshotPhoto) || photoAlt(snapshot) || cleanText(pulse.contributorPhotoAlt) || photoAlt(contributorPhoto) || photoAlt(contributor) || contributorName,
    contributorShortBio: cleanText(contributor.shortBio),
    contributorDisclosure: cleanText(pulse.contributorDisclosure),
    editorNote: cleanText(pulse.editorNote),
    contributorDisclaimer: cleanText(pulse.contributorDisclaimer),
    showAboutContributor: Boolean(pulse.showAboutContributor),
  };
}