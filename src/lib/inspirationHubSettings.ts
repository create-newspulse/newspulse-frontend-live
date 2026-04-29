import type { NormalizedPublicSettings } from "./publicSettings";

export type InspirationHubVideoSurface = "homepage" | "categoryPage";

export type ResolvedInspirationHubSectionText = {
  title: string;
  subtitle: string;
};

export type ResolvedInspirationHubDroneTvSettings = {
  title: string;
  subtitle: string;
  embedUrl: string | null;
};

export function resolveInspirationHubSectionText(
  settings: NormalizedPublicSettings | null | undefined
): ResolvedInspirationHubSectionText | null | undefined {
  const inspirationHub = settings?.inspirationHub;
  if (!inspirationHub) return undefined;
  if (!inspirationHub.enabled) return null;

  return {
    title: inspirationHub.title.trim(),
    subtitle: inspirationHub.subtitle.trim(),
  };
}

export function resolveInspirationHubDroneTvSettings(
  settings: NormalizedPublicSettings | null | undefined,
  surface: InspirationHubVideoSurface
): ResolvedInspirationHubDroneTvSettings | null | undefined {
  const inspirationHub = settings?.inspirationHub;
  if (!inspirationHub) return undefined;

  const droneTv = inspirationHub.droneTv;
  const surfaceEnabled = surface === "homepage" ? droneTv.homepageEnabled : droneTv.categoryPageEnabled;

  if (!inspirationHub.enabled || !droneTv.enabled || !surfaceEnabled) return null;

  return {
    title: droneTv.title.trim(),
    subtitle: droneTv.subtitle.trim(),
    embedUrl: droneTv.embedUrl || null,
  };
}

export function resolveInspirationHubDroneTvEmbedUrl(
  settings: NormalizedPublicSettings | null | undefined,
  surface: InspirationHubVideoSurface
): string | null | undefined {
  return resolveInspirationHubDroneTvSettings(settings, surface)?.embedUrl;
}