export type YouthCategory = {
  slug: string;
  title: string;
  emoji: string;
  description: string;
  gradientFrom: string; // Tailwind color class suffix, e.g., 'indigo-500' (kept for reference)
  gradientTo: string;   // Tailwind color class suffix
  fromHex: string;      // Hex color for inline gradients
  toHex: string;        // Hex color for inline gradients
};

export type YouthStory = {
  id: number;
  title: string;
  summary: string;
  category: string; // should match one of YouthCategory.slug or title
  image: string;    // URL or path
  date: string;
};

export const youthCategories: YouthCategory[] = [
  {
    slug: 'youth-pulse',
    title: 'Youth Pulse',
    emoji: '🎓',
    description: 'Awareness, lifestyle & youth voices',
    gradientFrom: 'indigo-500',
    gradientTo: 'violet-500',
    fromHex: '#6366F1',
    toHex: '#8B5CF6',
  },
  {
    slug: 'campus-buzz',
    title: 'Campus Buzz',
    emoji: '🔥',
    description: 'College fests, campus stories, innovations',
    gradientFrom: 'rose-500',
    gradientTo: 'orange-500',
    fromHex: '#F43F5E',
    toHex: '#F59E0B',
  },
  {
    slug: 'govt-exam-updates',
    title: 'Govt Exam Updates',
    emoji: '🎯',
    description: 'Notifications, toppers, study hacks',
    gradientFrom: 'emerald-500',
    gradientTo: 'teal-500',
    fromHex: '#10B981',
    toHex: '#14B8A6',
  },
  {
    slug: 'career-boosters',
    title: 'Career Boosters',
    emoji: '💼',
    description: 'Jobs, internships, financial tips',
    gradientFrom: 'cyan-500',
    gradientTo: 'blue-500',
    fromHex: '#06B6D4',
    toHex: '#3B82F6',
  },
  {
    slug: 'young-achievers',
    title: 'Young Achievers',
    emoji: '🌟',
    description: 'Youth icons, awards, success journeys',
    gradientFrom: 'amber-500',
    gradientTo: 'pink-500',
    fromHex: '#F59E0B',
    toHex: '#EC4899',
  },
];

export const youthStories: YouthStory[] = [
  {
    id: 100,
    title: 'DroneTV – Scenic Nature Relaxation (Auto Embed)',
    summary:
      'Soothing aerial journeys to help you pause and recharge. Curated for safe viewing.',
    category: 'Inspiration Hub',
    image:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop',
    date: 'Nov 2025',
  },
  {
    id: 1,
    title: 'AI Tools That Help Students Study Smarter in 2025',
    summary:
      'From Notion AI to prompt engineering — see the tools transforming learning.',
    category: 'Youth Pulse',
    image:
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1600&auto=format&fit=crop',
    date: 'Nov 2025',
  },
  {
    id: 2,
    title: 'Campus Fests Are Back: How IITs Are Going Hybrid',
    summary:
      'Student clubs blend IRL energy with online reach; best practices from top campuses.',
    category: 'Campus Buzz',
    image:
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1600&auto=format&fit=crop',
    date: 'Nov 2025',
  },
  {
    id: 3,
    title: 'SSC CGL 2025 Calendar: What Changes For You',
    summary:
      'All key dates, revised patterns, and smart prep tips collected in one place.',
    category: 'Govt Exam Updates',
    image:
      'https://images.unsplash.com/photo-1513258496099-48168024aec0?q=80&w=1600&auto=format&fit=crop',
    date: 'Nov 2025',
  },
  {
    id: 4,
    title: 'First Internship? 7 Portfolio Tips That Actually Work',
    summary:
      'Simple ways to stand out: impact bullets, tiny projects, and focused case studies.',
    category: 'Career Boosters',
    image:
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1600&auto=format&fit=crop',
    date: 'Nov 2025',
  },
  {
    id: 5,
    title: 'Meet the Teen Who Built a Low-Cost Braille Printer',
    summary:
      'A 17-year-old inventor’s journey from school lab to national recognition.',
    category: 'Young Achievers',
    image:
      'https://images.unsplash.com/photo-1531974586759-3fd55f7b39a3?q=80&w=1600&auto=format&fit=crop',
    date: 'Nov 2025',
  },
];

export const getStoriesByCategory = (slug: string): YouthStory[] => {
  const map: Record<string, string> = {
    'youth-pulse': 'Youth Pulse',
    'inspiration-hub': 'Inspiration Hub',
    'campus-buzz': 'Campus Buzz',
    'govt-exam-updates': 'Govt Exam Updates',
    'career-boosters': 'Career Boosters',
    'young-achievers': 'Young Achievers',
  };
  const display = map[slug] || slug;
  return youthStories.filter((s) => s.category.toLowerCase() === display.toLowerCase());
};
