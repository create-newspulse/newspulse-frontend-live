import en from '../../src/i18n/en.json';
import hi from '../../src/i18n/hi.json';
import gu from '../../src/i18n/gu.json';

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
});
