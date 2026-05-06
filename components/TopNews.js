// components/TopNews.js
export default function TopNews({ articles }) {
  if (!Array.isArray(articles)) {
    return (
      <div className="text-newsPulse-red p-4">
        ⚠️ Error loading news articles.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {articles.map((article, idx) => (
        <div key={idx} className="p-4 border rounded">
          <h2 className="text-lg font-semibold text-newsPulse-navy">{article.title}</h2>
          <p className="text-sm text-newsPulse-slate">{article.description}</p>
        </div>
      ))}
    </div>
  );
}
