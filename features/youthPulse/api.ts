import { youthCategories, youthStories } from "../../utils/youthData";
import type { YouthCategory, YouthStory } from "./types";

export async function getYouthTopics(): Promise<YouthCategory[]> {
  // Static source used in existing pages
  return youthCategories.map((c) => ({
    slug: c.slug,
    title: c.title,
    emoji: c.emoji,
    description: c.description,
    gradientFrom: c.gradientFrom,
    gradientTo: c.gradientTo,
    fromHex: c.fromHex,
    toHex: c.toHex,
  }));
}

export async function getYouthTrending(limit = 6): Promise<YouthStory[]> {
  // Reuse existing Youth stories, exclude Inspiration Hub from trending
  const list = youthStories.filter((s) => s.category.toLowerCase() !== "inspiration hub");
  return list.slice(0, limit);
}

export async function getYouthByCategory(slug: string): Promise<YouthStory[]> {
  const map: Record<string, string> = {
    "youth-pulse": "Youth Pulse",
    "inspiration-hub": "Inspiration Hub",
    "campus-buzz": "Campus Buzz",
    "govt-exam-updates": "Govt Exam Updates",
    "career-boosters": "Career Boosters",
    "young-achievers": "Young Achievers",
  };
  const display = map[slug] || slug;
  return youthStories.filter((s) => s.category.toLowerCase() === display.toLowerCase());
}
