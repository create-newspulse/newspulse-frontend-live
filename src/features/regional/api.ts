import type { NewsItem } from "./types";
import { FALLBACK_NEWS } from "./fallback";

export async function fetchRegionalNews(state: string): Promise<NewsItem[]> {
  try {
    // Placeholder behavior identical to existing page
    await new Promise((r) => setTimeout(r, 400));
    return FALLBACK_NEWS;
  } catch {
    return FALLBACK_NEWS;
  }
}

export async function fetchYouthVoices(state: string): Promise<NewsItem[]> {
  try {
    await new Promise((r) => setTimeout(r, 300));
    return [
      {
        id: "yv1",
        title: "Campus Innovators: Solar carts by GTU students",
        source: "Youth Pulse",
        category: "Education",
        district: "Ahmedabad",
        summary: "Pilot to run inside campus clusters.",
        publishedAt: new Date().toISOString(),
      },
    ];
  } catch {
    return [];
  }
}

export async function fetchCivicMetrics(state: string) {
  try {
    await new Promise((r) => setTimeout(r, 250));
    return {
      rainfallAlertDistricts: 3,
      waterSupplyOK: 28,
      projectsTracked: 57,
      electionNotices: 2,
    };
  } catch {
    return { rainfallAlertDistricts: 0, waterSupplyOK: 0, projectsTracked: 0, electionNotices: 0 };
  }
}
