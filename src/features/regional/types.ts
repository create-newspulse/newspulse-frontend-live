export type City = {
  id: string;
  name: string;
  label?: "Current" | "Approved" | "New";
  type: "City" | "District";
  district?: string;
  badges?: string[];
};

export type District = {
  id: string;
  name: string;
  region?: string;
};

export type NewsItem = {
  id: string;
  title: string;
  source: string;
  url?: string;
  category: "Development" | "Education" | "Civic" | "Culture" | "Crime" | "Health" | "Environment";
  district?: string;
  summary?: string;
  publishedAt?: string;
};

export const FILTERS = [
  { key: "all", label: "All" },
  { key: "smart", label: "Smart City" },
  { key: "industrial", label: "Industrial" },
  { key: "coastal", label: "Coastal" },
  { key: "tribal", label: "Tribal Belt" },
] as const;

export type FilterKey = (typeof FILTERS)[number]["key"];
