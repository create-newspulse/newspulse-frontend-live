import { NextApiRequest, NextApiResponse } from 'next';

// Mock news data for demonstration (replace with real API calls)
const mockNewsData = [
  {
    id: '1',
    title: 'Global Climate Summit Reaches Historic Agreement',
    excerpt: 'World leaders unite on unprecedented environmental policies after intense negotiations in Geneva.',
    content: 'In a groundbreaking development, world leaders have reached a historic agreement on climate action...',
    image: 'https://images.unsplash.com/photo-1569163139394-de4e4f43e4e5?w=800',
    source: 'Reuters',
    category: 'Environment',
    publishedAt: new Date().toISOString(),
    author: 'Environmental Desk',
    url: '#'
  },
  {
    id: '2', 
    title: 'Technology Giants Announce AI Safety Initiative',
    excerpt: 'Major tech companies collaborate on artificial intelligence safety standards and ethical guidelines.',
    content: 'Leading technology companies have announced a comprehensive AI safety initiative...',
    image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800',
    source: 'TechNews',
    category: 'Technology',
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    author: 'Tech Team',
    url: '#'
  },
  {
    id: '3',
    title: 'Global Markets Show Strong Recovery Signs',
    excerpt: 'Stock markets worldwide demonstrate resilience amid economic uncertainty.',
    content: 'Financial markets across the globe are showing strong recovery signs...',
    image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800',
    source: 'Financial Times',
    category: 'Business',
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    author: 'Business Desk',
    url: '#'
  },
  {
    id: '4',
    title: 'International Space Station Mission Success',
    excerpt: 'Crew Dragon successfully docks with ISS carrying international research team.',
    content: 'The latest mission to the International Space Station has achieved remarkable success...',
    image: 'https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=800',
    source: 'Space Today',
    category: 'Science',
    publishedAt: new Date(Date.now() - 10800000).toISOString(),
    author: 'Science Team',
    url: '#'
  },
  {
    id: '5',
    title: 'World Cup Preparations Underway',
    excerpt: 'Host nation completes final preparations for the upcoming global football championship.',
    content: 'With just months to go before the World Cup kicks off...',
    image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800',
    source: 'Sports Central',
    category: 'Sports',
    publishedAt: new Date(Date.now() - 14400000).toISOString(),
    author: 'Sports Team',
    url: '#'
  }
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { category, limit = 10, language = 'en' } = req.query;
    
    // Filter by category if provided
    let filteredNews = mockNewsData;
    if (category && category !== 'all') {
      filteredNews = mockNewsData.filter(
        article => article.category.toLowerCase() === category.toString().toLowerCase()
      );
    }
    
    // Limit results
    const limitedNews = filteredNews.slice(0, parseInt(limit.toString()));
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    res.status(200).json({
      success: true,
      articles: limitedNews,
      totalResults: filteredNews.length,
      language,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch news',
      articles: []
    });
  }
}