export const FAITH_CULTURE_TOPICS = [
  'faith-spiritual-life',
  'living-heritage',
  'food-agricultural-heritage',
  'architecture-art-public-heritage',
  'community-social-traditions',
  'folk-arts-festivals-textiles',
  'language-cultural-identity',
] as const;

export type FaithCultureTopic = (typeof FAITH_CULTURE_TOPICS)[number];

export function getFaithCultureTopic(value: unknown): FaithCultureTopic | undefined {
  return FAITH_CULTURE_TOPICS.find((topic) => topic === value);
}
