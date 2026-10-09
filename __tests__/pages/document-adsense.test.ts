import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(process.cwd(), 'pages', '_document.tsx'), 'utf8');

describe('global AdSense site verification', () => {
  test('declares the publisher account once in the global document head', () => {
    const head = source.match(/<Head>([\s\S]*?)<\/Head>/)?.[1];

    expect(source.match(/name="google-adsense-account"/g)).toHaveLength(1);
    expect(head).toContain('<meta name="google-adsense-account" content="ca-pub-9257940786279478" />');
  });

  test('does not load AdSense advertising scripts for verification', () => {
    expect(source).not.toMatch(/adsbygoogle|pagead2\.googlesyndication\.com/);
  });
});
