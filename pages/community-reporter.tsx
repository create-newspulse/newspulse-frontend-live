import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';
import SubmissionExperience from '../components/community-reporter/SubmissionExperience';
import { reporterText } from '../lib/reporterCopy';
import { getReporterPortalPageServerProps } from '../lib/reporterPortalPage';
import type { FeatureToggleProps } from '../types/community-reporter';

const contactEmail = 'community@newspulse.co.in';
export default function CommunityReporterPage(props: FeatureToggleProps) {
  const { locale } = useRouter();
  const t = (en: string, hi: string, gu: string) => reporterText(locale, en, hi, gu);
  const fallback = t('Email fallback', 'ईमेल का विकल्प', 'ઇમેઇલનો વિકલ્પ');
  return (
    <>
      <SubmissionExperience {...props} variant="public" />

      <section className="bg-white px-4 pb-12 text-black dark:bg-dark-primary dark:text-dark-text" aria-label={fallback}>
        <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-xl font-semibold">{t('Having trouble submitting online?', 'ऑनलाइन रिपोर्ट भेजने में समस्या है?', 'ઑનલાઇન અહેવાલ મોકલવામાં મુશ્કેલી છે?')}</h2>
          <p className="mt-4 text-sm leading-7 text-gray-600 dark:text-gray-300">
            {t('Use the online form first. If you cannot use it, contact the editorial team by email. If a receipt is uncertain, ask before sending the story again.',
              'पहले ऑनलाइन फ़ॉर्म का उपयोग करें। यदि आप इसका उपयोग नहीं कर सकते, तो संपादकीय टीम को ईमेल करें। रसीद की पुष्टि न हो तो रिपोर्ट दोबारा भेजने से पहले पूछें।',
              'પહેલાં ઑનલાઇન ફૉર્મનો ઉપયોગ કરો. તેનો ઉપયોગ ન કરી શકો તો સંપાદકીય ટીમને ઇમેઇલ કરો. રસીદની પુષ્ટિ ન થઈ હોય તો અહેવાલ ફરી મોકલતાં પહેલાં પૂછો.')}
          </p>
          <div className="mt-5 text-sm font-semibold text-gray-800 dark:text-gray-100">{fallback}</div>
          <a href={`mailto:${contactEmail}`} className="mt-2 inline-flex break-all text-sm font-semibold text-sky-700 underline">
            {contactEmail}
          </a>
          <div className="mt-5 text-sm font-semibold text-gray-800 dark:text-gray-100">{t('Suggested subject line', 'सुझाई गई विषय पंक्ति', 'સૂચિત વિષય પંક્તિ')}</div>
          <div className="mt-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
            {t('Community Report – [City] – [Topic]', 'सामुदायिक रिपोर्ट – [शहर] – [विषय]', 'સમુદાય અહેવાલ – [શહેર] – [વિષય]')}
          </div>
          <p className="mt-4 text-sm leading-7 text-gray-600 dark:text-gray-300">
            {t('Share only the details needed for verification and editorial follow-up.', 'केवल सत्यापन और संपादकीय संपर्क के लिए ज़रूरी विवरण भेजें।', 'ફક્ત ચકાસણી અને સંપાદકીય સંપર્ક માટે જરૂરી વિગતો મોકલો.')}
          </p>
          <Link href="/community-reporter/guidelines" className="mt-5 inline-flex text-sm font-semibold text-blue-700 underline">
            {t('Read the full Community Reporter Guide', 'सामुदायिक रिपोर्टर की पूरी मार्गदर्शिका पढ़ें', 'સમુદાય રિપોર્ટરની સંપૂર્ણ માર્ગદર્શિકા વાંચો')}
          </Link>
        </div>
      </section>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<FeatureToggleProps> = getReporterPortalPageServerProps;