import { useLanguage } from '../utils/LanguageContext';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setLanguage(selected);
    try { localStorage.setItem('lang', selected); } catch {}
  };

  return (
    <select
      value={language}
      onChange={handleChange}
      aria-label="Select language"
      className="border rounded-lg px-3 py-2 font-medium bg-white shadow text-gray-800"
    >
      {/* Order requested: Gujarati → Hindi → English */}
      <option value="gujarati">📰 ગુજરાતી</option>
      <option value="hindi">🇮🇳 हिन्दी</option>
      <option value="english">🌐 English</option>
    </select>
  );
}
