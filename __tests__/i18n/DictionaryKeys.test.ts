import en from '../../src/i18n/en.json';
import hi from '../../src/i18n/hi.json';
import gu from '../../src/i18n/gu.json';
import messagesEn from '../../messages/en.json';
import messagesHi from '../../messages/hi.json';
import messagesGu from '../../messages/gu.json';
import { FAITH_CULTURE_TOPICS } from '../../lib/faithCultureTopics';

const APPROVED_FAITH_TOPIC_LABELS = {
  all: { en: 'All', hi: 'सभी', gu: 'બધા' },
  'faith-spiritual-life': { en: 'Faith & Spiritual Life', hi: 'आस्था और आध्यात्मिक जीवन', gu: 'આસ્થા અને આધ્યાત્મિક જીવન' },
  'living-heritage': { en: 'Living Heritage & Traditions', hi: 'जीवित विरासत और परंपराएँ', gu: 'જીવંત વારસો અને પરંપરાઓ' },
  'food-agricultural-heritage': { en: 'Food Heritage', hi: 'खाद्य विरासत', gu: 'ખાદ્ય વારસો' },
  'architecture-art-public-heritage': { en: 'Architecture & Art', hi: 'वास्तुकला और कला', gu: 'સ્થાપત્ય અને કલા' },
  'community-social-traditions': { en: 'Community', hi: 'समुदाय', gu: 'સમુદાય' },
  'folk-arts-festivals-textiles': { en: 'Folk Arts', hi: 'लोक कला', gu: 'લોકકલા' },
  'language-cultural-identity': { en: 'Language & Culture', hi: 'भाषा और संस्कृति', gu: 'ભાષા અને સંસ્કૃતિ' },
};

const APPROVED_PULSE_DIALOGUE_DESCRIPTIONS = {
  en: 'Ideas, essays, conversations and perspectives from writers, scholars, experts and independent voices.',
  hi: 'लेखकों, विद्वानों, विशेषज्ञों और स्वतंत्र आवाज़ों के विचार, निबंध, संवाद और दृष्टिकोण।',
  gu: 'લેખકો, વિદ્વાનો, નિષ્ણાતો અને સ્વતંત્ર અવાજોના વિચારો, નિબંધો, સંવાદો અને દૃષ્ટિકોણ.',
};

function flattenKeys(obj: any, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  const out: string[] = [];
  for (const k of Object.keys(obj)) {
    const v = (obj as any)[k];
    const keyPath = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') {
      out.push(keyPath);
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flattenKeys(v, keyPath));
    }
  }
  return out;
}

describe('i18n dictionaries', () => {
  it('have identical translation key paths across en/hi/gu', () => {
    const enKeys = new Set(flattenKeys(en).sort());
    const hiKeys = new Set(flattenKeys(hi).sort());
    const guKeys = new Set(flattenKeys(gu).sort());

    expect([...hiKeys]).toEqual([...enKeys]);
    expect([...guKeys]).toEqual([...enKeys]);
  });

  it('keeps approved Pulse Dialogue landing descriptions in runtime and SSR dictionaries', () => {
    const runtime = { en, hi, gu } as const;
    const messages = { en: messagesEn, hi: messagesHi, gu: messagesGu } as const;

    for (const lang of ['en', 'hi', 'gu'] as const) {
      expect((runtime[lang] as any).pulseDialogue.landing.description).toBe(APPROVED_PULSE_DIALOGUE_DESCRIPTIONS[lang]);
      expect((messages[lang] as any).pulseDialogue.landing.description).toBe(APPROVED_PULSE_DIALOGUE_DESCRIPTIONS[lang]);
    }
  });

  it('keeps the exact approved Faith codes and EN/HI/GU topic labels, including living-heritage', () => {
    const runtime = { en, hi, gu };
    expect(FAITH_CULTURE_TOPICS).toEqual(Object.keys(APPROVED_FAITH_TOPIC_LABELS).filter(code => code !== 'all'));
    for (const locale of ['en', 'hi', 'gu'] as const) {
      expect(runtime[locale].faithCulture.topics).toEqual(Object.fromEntries(
        Object.entries(APPROVED_FAITH_TOPIC_LABELS).map(([code, labels]) => [code, labels[locale]]),
      ));
    }
  });
});
