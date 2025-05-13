import { useLanguage } from '../utils/LanguageContext';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setLanguage(selected);
    localStorage.setItem('lang', selected);
  };

  return (
    <select
      value={language}
      onChange={handleChange}
      className="border rounded px-3 py-2 font-medium bg-white shadow"
    >
      <option value="english">🌐 English</option>
      <option value="hindi">🇮🇳 हिन्दी</option>
      <option value="gujarati">📰 ગુજરાતી</option>
    </select>
  );
}
