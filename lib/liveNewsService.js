// Enhanced news fetching with real APIs
export const fetchLiveNews = async (category = 'general', language = 'en') => {
  const sources = {
    newsapi: `https://newsapi.org/v2/top-headlines?category=${category}&language=${language}&apiKey=${process.env.NEWS_API_KEY}`,
    rss: {
      bbc: 'https://feeds.bbci.co.uk/news/rss.xml',
      cnn: 'http://rss.cnn.com/rss/edition.rss',
      reuters: 'https://www.reuters.com/rssFeed/worldNews'
    }
  };

  try {
    // Primary: NewsAPI
    const response = await fetch(sources.newsapi);
    if (response.ok) {
      const data = await response.json();
      return data.articles.map(article => ({
        id: article.url,
        title: article.title,
        excerpt: article.description,
        image: article.urlToImage,
        source: article.source.name,
        publishedAt: article.publishedAt,
        url: article.url,
        category: category
      }));
    }
    
    // Fallback: RSS feeds
    return await fetchRSSFeed(sources.rss.bbc);
  } catch (error) {
    console.error('Failed to fetch live news:', error);
    return [];
  }
};

// Auto-refresh news every 5 minutes
export const useAutoRefreshNews = () => {
  const [news, setNews] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(async () => {
      const freshNews = await fetchLiveNews();
      setNews(freshNews);
      setLastUpdate(Date.now());
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, []);

  return { news, lastUpdate };
};