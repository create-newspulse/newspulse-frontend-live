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

export type RegionalArticle = {
  _id?: string;
  id?: string;
  title: string;
  excerpt?: string;
  content?: string;
  category?: string;
  language?: string;
  publishedAt?: string;
  image?: string;
  source?: string;
  location?: string;
  tags?: string[];
};

export type RegionalFilters = {
  query?: string;
  districtName?: string;
  cityName?: string;
};
