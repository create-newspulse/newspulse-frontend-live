export type YouthCategory = {
  slug: string;
  title: string;
  emoji: string;
  description: string;
  gradientFrom?: string;
  gradientTo?: string;
  fromHex?: string;
  toHex?: string;
};

export type YouthStory = {
  id: number | string;
  title: string;
  summary: string;
  category: string;
  categoryLabel?: string;
  editorialLabel?: string;
  slug?: string;
  image: string;
  date: string;
};
