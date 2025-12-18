import { useLanguage } from '../utils/LanguageContext';
import { useRouter } from 'next/router';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const router = useRouter();

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setLanguage(selected);
    try { localStorage.setItem('lang', selected); } catch {}
    // Map legacy to Next.js locale and push locale route for consistency
    const toLocale = (legacy: string) => legacy === 'hindi' ? 'hi' : legacy === 'gujarati' ? 'gu' : 'en';
    const nextLocale = toLocale(selected);
    try { document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`; } catch {}
    const asPath = router.asPath;
    await router.push(asPath, asPath, { locale: nextLocale, scroll: false });
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
