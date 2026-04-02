import { useState } from 'react';
import { resolveCoverImageUrl } from '../lib/coverImages';
import { StoryImage } from '../src/components/story/StoryImage';

const TopNewsCard = ({ article }) => {
  const [saved, setSaved] = useState(false);

  const handleSave = () => setSaved(!saved);

  const speak = () => {
    const speech = new SpeechSynthesisUtterance(article.title);
    speech.lang = 'en-IN';
    window.speechSynthesis.speak(speech);
  };

  const detectLanguage = (text) => {
    if (/[\u0A80-\u0AFF]/.test(text)) return 'gu'; // Gujarati
    if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Hindi
    return 'en';
  };

  const lang = detectLanguage(article.title);
  const langColor = lang === 'gu' ? 'green' : lang === 'hi' ? 'blue' : 'red';
  const langLabel = lang === 'gu' ? 'Gujarati' : lang === 'hi' ? 'Hindi' : 'English';

  return (
    <div className="group bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-all duration-300 relative">
      <StoryImage
        src={resolveCoverImageUrl(article)}
        alt={article?.title || ''}
        variant="top"
        className="rounded-md"
      />
      <h3 className="text-lg font-semibold mt-3 mb-2">{article.title}</h3>
      <div className="flex justify-between items-center text-sm text-gray-600">
        <span className={`font-semibold text-${langColor}-500`}>
          🏷️ {langLabel}
        </span>
        <span className="text-xs">✅ Verified by AI</span>
      </div>
      <div className="flex gap-4 mt-3">
        <button
          onClick={speak}
          className="text-purple-600 hover:text-purple-800"
          title="Listen"
        >
          🔊
        </button>
        <button
          onClick={handleSave}
          className={`hover:text-yellow-500 ${saved ? 'text-yellow-500' : 'text-gray-400'}`}
          title="Save"
        >
          {saved ? '🔖' : '📄'}
        </button>
      </div>
    </div>
  );
};

export default TopNewsCard;

