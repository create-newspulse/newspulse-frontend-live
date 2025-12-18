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
  image: string;
  date: string;
};
