import {useTranslations} from 'next-intl';

const TrendingNow = () => {
  const t = useTranslations();
  const trending = [
    t('trending.breaking'),
    t('trending.sports'),
    t('trending.goldRates'),
    t('trending.fuelPrices'),
    t('trending.weather'),
  ];

  return (
    <section className="mt-10 bg-newsPulse-slate/10 p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-3 text-newsPulse-navy">🔥 {t('trending.title')}</h2>
      <ul className="list-disc list-inside text-newsPulse-slate space-y-1">
        {trending.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    </section>
  );
};

export default TrendingNow;
