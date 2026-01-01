export default async function fetchTopNewswithAutoKey(language = 'en') {
  const API_KEY = 'd6cda5432c664498a61b9716f315f772';
  const normalized = String(language || '').toLowerCase();
  const langCode =
    normalized === 'hi' || normalized === 'hindi'
      ? 'hi'
      : normalized === 'gu' || normalized === 'gujarati'
        ? 'gu'
        : 'en';

  const res = await fetch(
    `https://newsapi.org/v2/top-headlines?country=in&language=${langCode}&apiKey=${API_KEY}`
  );
  const data = await res.json();
  return data.articles || [];
}