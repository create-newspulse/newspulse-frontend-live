import { fetchCategoryNews } from "../../lib/fetchCategoryNews";
import { GUJARAT_DISTRICTS } from "../../utils/regions";
import type { RegionalArticle, City, District } from "./types";

export async function getRegionalFeed(limit = 30, language?: string): Promise<RegionalArticle[]> {
  try {
    const res = await fetchCategoryNews({ categoryKey: "Regional", limit, language });
    return (res.items || []) as RegionalArticle[];
  } catch {
    return [];
  }
}

export function getGujaratDistricts(): District[] {
  return GUJARAT_DISTRICTS.map((d, i) => ({ id: `dist-${i}`, name: d.name }));
}

// Minimal curated list for UI; existing page uses static badges. Keep simple here.
export function getTopCities(): City[] {
  return [
    { id: "ahm", name: "Ahmedabad", type: "District", label: "Current", badges: ["Smart City"] },
    { id: "sur", name: "Surat", type: "District", label: "Current", badges: ["Diamond Hub"] },
    { id: "vad", name: "Vadodara", type: "District", label: "Current", badges: ["Education"] },
    { id: "raj", name: "Rajkot", type: "District", label: "Current", badges: ["Industrial"] },
    { id: "bvn", name: "Bhavnagar", type: "District", label: "Current", badges: ["Coastal"] },
    { id: "jmn", name: "Jamnagar", type: "District", label: "Current", badges: ["Refinery"] },
  ];
}

// Utilities to match articles by location names (mirrors existing page logic)
function normalize(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function matchesDistrict(article: RegionalArticle, districtName: string): boolean {
  const n = normalize(districtName);
  const text = normalize(`${article.title || ""} ${article.excerpt || ""} ${article.content || ""} ${article.location || ""} ${(article.tags || []).join(" ")}`);
  if (!n) return false;
  return new RegExp(`(^|\n|\r|\s)${n}(\s|\n|\r|$)`).test(text) || text.includes(n);
}

export function matchesCity(article: RegionalArticle, cityName: string): boolean {
  const n = normalize(cityName);
  const text = normalize(`${article.title || ""} ${article.excerpt || ""} ${article.content || ""} ${article.location || ""} ${(article.tags || []).join(" ")}`);
  if (!n) return false;
  return new RegExp(`(^|\n|\r|\s)${n}(\s|\n|\r|$)`).test(text) || text.includes(n);
}
