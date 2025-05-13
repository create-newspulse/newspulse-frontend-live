export default async function handler(req, res) {
  const { page = '1', category, language, ticker } = req.query;
  const pageNum = parseInt(page, 10);
  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({ error: 'Invalid page number' });
  }

  const pageSize = ticker ? 5 : 10; // Smaller page size for ticker
  const startIndex = (pageNum - 1) * pageSize;

  const allCategories = [
    'News',
    'Politics',
    'Regional',
    'National',
    'International',
    'Sports',
    'Business',
    'Glamorous',
    'Lifestyle',
    'Science',
    'Technology',
  ];

  const headlines = Array.from({ length: 50 }, (_, i) => ({
    id: `headline-${i + 1}`,
    text: `Headline ${i + 1} in ${language || 'english'}`,
    fullText: `This is the full text of headline ${i + 1}. It contains more details about the news story.`,
    category: category || allCategories[Math.floor(Math.random() * allCategories.length)],
    source: 'News Source',
    publishedAt: new Date(Date.now() - i * 86400000).toISOString(),
  }));

  const paginatedHeadlines = headlines.slice(startIndex, startIndex + pageSize);
  res.status(200).json(paginatedHeadlines);
}
