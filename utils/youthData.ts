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
  category: string; // backend/admin slug
  categoryLabel: string;
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
  {
    slug: 'student-voices',
    title: 'Student Voices',
    emoji: '🎙️',
    description: 'Real student opinions, campus life, study pressure, habits, and everyday youth perspectives.',
    gradientFrom: 'fuchsia-500',
    gradientTo: 'indigo-500',
    fromHex: '#D946EF',
    toHex: '#6366F1',
  },
];

export const youthStories: YouthStory[] = [
  {
    id: 100,
    title: 'DroneTV - Scenic Nature Relaxation',
    summary:
      'Soothing aerial journeys to help you pause and recharge. Curated for safe viewing.',
    category: 'inspiration-hub',
    categoryLabel: 'Inspiration Hub',
    image:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop',
    date: 'Featured',
  },
  {
    id: 1,
    title: 'AI Tools Helping Students Study Smarter',
    summary:
      'A practical look at note-taking, revision, and research tools students are using right now.',
    category: 'youth-pulse',
    categoryLabel: 'Youth Pulse',
    image:
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1600&auto=format&fit=crop',
    date: 'Trending now',
  },
  {
    id: 2,
    title: 'Campus Events Are Evolving With Hybrid Participation',
    summary:
      'Student organizers are mixing in-person energy with digital reach to keep events more accessible.',
    category: 'campus-buzz',
    categoryLabel: 'Campus Buzz',
    image:
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1600&auto=format&fit=crop',
    date: 'Campus watch',
  },
  {
    id: 3,
    title: 'How To Track Government Exam Updates Without Missing Key Changes',
    summary:
      'A simple prep workflow for notifications, syllabus changes, and revision windows.',
    category: 'govt-exam-updates',
    categoryLabel: 'Govt Exam Updates',
    image:
      'https://images.unsplash.com/photo-1513258496099-48168024aec0?q=80&w=1600&auto=format&fit=crop',
    date: 'Exam prep',
  },
  {
    id: 4,
    title: 'First Internship? 7 Portfolio Tips That Actually Work',
    summary:
      'Simple ways to stand out: impact bullets, tiny projects, and focused case studies.',
    category: 'career-boosters',
    categoryLabel: 'Career Boosters',
    image:
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1600&auto=format&fit=crop',
    date: 'Career tips',
  },
  {
    id: 5,
    title: 'Meet the Teen Who Built a Low-Cost Braille Printer',
    summary:
      'A 17-year-old inventor’s journey from school lab to national recognition.',
    category: 'young-achievers',
    categoryLabel: 'Young Achievers',
    image:
      'https://images.unsplash.com/photo-1531974586759-3fd55f7b39a3?q=80&w=1600&auto=format&fit=crop',
    date: 'Spotlight',
  },
  {
    id: 6,
    title: 'What Students Wish Adults Understood About Campus Pressure',
    summary:
      'A closer look at workload, routines, social pressure, and the small habits students use to stay balanced.',
    category: 'student-voices',
    categoryLabel: 'Student Voices',
    image:
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1600&auto=format&fit=crop',
    date: 'Student lens',
  },
];

export const getStoriesByCategory = (slug: string): YouthStory[] => {
  return youthStories.filter((s) => s.category.toLowerCase() === String(slug || '').toLowerCase());
};
