import type { NormalizedPublicSettings } from "./publicSettings";

export type InspirationHubVideoSurface = "homepage" | "categoryPage";

export function resolveInspirationHubDroneTvEmbedUrl(
  settings: NormalizedPublicSettings | null | undefined,
  surface: InspirationHubVideoSurface
): string | null | undefined {
  const inspirationHub = settings?.inspirationHub;
  if (!inspirationHub) return undefined;

  const droneTv = inspirationHub.droneTv;
  const surfaceEnabled = surface === "homepage" ? droneTv.homepageEnabled : droneTv.categoryPageEnabled;

  if (!inspirationHub.enabled || !droneTv.enabled || !surfaceEnabled) return null;
  if (!droneTv.embedUrl) return null;

  return droneTv.embedUrl;
}