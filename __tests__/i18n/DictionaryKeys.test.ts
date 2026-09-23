import en from '../../src/i18n/en.json';
import hi from '../../src/i18n/hi.json';
import gu from '../../src/i18n/gu.json';
import messagesEn from '../../messages/en.json';
import messagesHi from '../../messages/hi.json';
import messagesGu from '../../messages/gu.json';

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
});
