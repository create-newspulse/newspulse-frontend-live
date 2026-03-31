import { formatArticleBodyHtml, splitArticleBodyBlocks, stripDuplicateOpeningParagraph } from '../../lib/articleBody';
import { splitArticleHtmlForInlineAd } from '../../lib/articleInlineAd';

describe('splitArticleHtmlForInlineAd', () => {
  it('inserts after the third body paragraph when the body has enough content', () => {
    const placement = splitArticleHtmlForInlineAd(
      '<p>First paragraph has enough text to read like a real article introduction rather than a short placeholder.</p><p>Second paragraph also carries enough detail to keep the inline ad comfortably below the main image.</p><p>Third paragraph stays below the insertion point.</p><p>Fourth paragraph closes out the sample.</p>'
    );

    expect(placement.insertedAfterParagraph).toBe(3);
    expect(placement.beforeHtml).toBe('<p>First paragraph has enough text to read like a real article introduction rather than a short placeholder.</p><p>Second paragraph also carries enough detail to keep the inline ad comfortably below the main image.</p><p>Third paragraph stays below the insertion point.</p>');
    expect(placement.afterHtml).toBe('<p>Fourth paragraph closes out the sample.</p>');
  });

  it('falls back to the third body paragraph when the first two body paragraphs are too short', () => {
    const placement = splitArticleHtmlForInlineAd(
      '<p>Short one</p><p>Short two</p><p>Third paragraph has enough length to keep the ad lower in the story.</p><p>Fourth paragraph.</p>'
    );

    expect(placement.insertedAfterParagraph).toBe(3);
    expect(placement.beforeHtml).toBe('<p>Short one</p><p>Short two</p><p>Third paragraph has enough length to keep the ad lower in the story.</p>');
    expect(placement.afterHtml).toBe('<p>Fourth paragraph.</p>');
  });

  it('inserts after the first paragraph when only two body paragraphs exist', () => {
    const placement = splitArticleHtmlForInlineAd(
      '<p>First paragraph has enough text to count as a proper body paragraph for placement.</p><p>Second paragraph also has enough text to anchor the inline ad safely in the article flow.</p>'
    );

    expect(placement.insertedAfterParagraph).toBe(1);
    expect(placement.beforeHtml).toBe('<p>First paragraph has enough text to count as a proper body paragraph for placement.</p>');
    expect(placement.afterHtml).toBe('<p>Second paragraph also has enough text to anchor the inline ad safely in the article flow.</p>');
  });

  it('inserts after the first paragraph when only one paragraph exists', () => {
    const placement = splitArticleHtmlForInlineAd('<p>Only one</p>');

    expect(placement.insertedAfterParagraph).toBe(1);
    expect(placement.beforeHtml).toBe('<p>Only one</p>');
    expect(placement.afterHtml).toBe('');
  });

  it('ignores empty and list-nested paragraphs before counting body paragraphs', () => {
    const placement = splitArticleHtmlForInlineAd(
      '<p></p><ul><li><p>Bullet one</p></li><li><p>Bullet two</p></li></ul><p>Body one carries enough text to count as a full paragraph in the article body.</p><p>Body two also carries enough text to keep the inline ad safely away from the top of the article.</p><p>Body three remains below the ad.</p><p>Body four wraps the story.</p>'
    );

    expect(placement.insertedAfterParagraph).toBe(3);
    expect(placement.beforeHtml).toBe('<p></p><ul><li><p>Bullet one</p></li><li><p>Bullet two</p></li></ul><p>Body one carries enough text to count as a full paragraph in the article body.</p><p>Body two also carries enough text to keep the inline ad safely away from the top of the article.</p><p>Body three remains below the ad.</p>');
    expect(placement.afterHtml).toBe('<p>Body four wraps the story.</p>');
  });

  it('skips heading-only paragraphs when choosing the insertion point', () => {
    const placement = splitArticleHtmlForInlineAd(
      '<p><strong>Subheading</strong></p><p>First full body paragraph with enough text to read like natural article copy instead of a short label.</p><p>Second full body paragraph with enough text to keep the inline ad under the body introduction.</p><p>Third paragraph.</p>'
    );

    expect(placement.insertedAfterParagraph).toBe(3);
    expect(placement.beforeHtml).toBe('<p><strong>Subheading</strong></p><p>First full body paragraph with enough text to read like natural article copy instead of a short label.</p><p>Second full body paragraph with enough text to keep the inline ad under the body introduction.</p><p>Third paragraph.</p>');
  });
});

describe('formatArticleBodyHtml', () => {
  it('converts escaped double newlines into separate paragraphs', () => {
    const html = formatArticleBodyHtml('First paragraph.\\n\\nSecond paragraph.');

    expect(html).toBe('<p>First paragraph.</p><p>Second paragraph.</p>');
    expect(html.includes('\\n')).toBe(false);
  });

  it('keeps short heading lines and body text readable', () => {
    const html = formatArticleBodyHtml('Subheading:\\nThis is the body copy under that subheading.');

    expect(html).toBe('<p><strong>Subheading:</strong><br />This is the body copy under that subheading.</p>');
  });

  it('formats plain text long-form content into clean paragraphs', () => {
    const html = formatArticleBodyHtml('Alpha line one.\\nAlpha line two.\\n\\nBeta paragraph.');

    expect(html).toBe('<p>Alpha line one. Alpha line two.</p><p>Beta paragraph.</p>');
  });
});

describe('stripDuplicateOpeningParagraph', () => {
  it('removes the first paragraph when it matches the summary', () => {
    const html = '<p>Markets opened higher today as investors reacted to fresh policy signals.</p><p>The rally broadened across banking and energy stocks in afternoon trade.</p>';

    expect(
      stripDuplicateOpeningParagraph(html, 'Markets opened higher today as investors reacted to fresh policy signals.')
    ).toBe('<p>The rally broadened across banking and energy stocks in afternoon trade.</p>');
  });

  it('removes the first paragraph when it is a near-duplicate of the summary', () => {
    const html = '<p>Markets opened higher today as investors reacted to fresh policy signals from the central bank.</p><p>Traders then shifted focus to earnings guidance.</p>';

    expect(
      stripDuplicateOpeningParagraph(html, 'Markets opened higher today as investors reacted to fresh policy signals.')
    ).toBe('<p>Traders then shifted focus to earnings guidance.</p>');
  });

  it('keeps the opening paragraph when the summary is different', () => {
    const html = '<p>Heavy rain continued across the state on Monday morning.</p><p>Officials said reservoirs remain below warning levels.</p>';

    expect(stripDuplicateOpeningParagraph(html, 'Schools in several districts were closed as a precaution.')).toBe(html);
  });

  it('keeps the original body when removing the first paragraph would empty the article', () => {
    const html = '<p>Markets opened higher today as investors reacted to fresh policy signals.</p>';

    expect(
      stripDuplicateOpeningParagraph(html, 'Markets opened higher today as investors reacted to fresh policy signals.')
    ).toBe(html);
  });

  it('keeps the original body when the remaining content is too short to stand alone', () => {
    const html = '<p>Markets opened higher today as investors reacted to fresh policy signals.</p><p>More soon.</p>';

    expect(
      stripDuplicateOpeningParagraph(html, 'Markets opened higher today as investors reacted to fresh policy signals.')
    ).toBe(html);
  });

  it('does not suppress a first paragraph that only partially overlaps with the summary', () => {
    const html = '<p>Markets opened higher today as investors reacted to fresh policy signals, while exporters stayed under pressure from currency moves.</p><p>Analysts said sector rotation drove late trading.</p>';

    expect(
      stripDuplicateOpeningParagraph(html, 'Markets opened higher today as investors reacted to fresh policy signals.')
    ).toBe(html);
  });

  it('leaves content unchanged when no summary exists', () => {
    const html = '<p>Only the story body is available here.</p>';

    expect(stripDuplicateOpeningParagraph(html, '')).toBe(html);
  });
});

describe('splitArticleBodyBlocks', () => {
  it('keeps non-paragraph content around paragraph blocks in order', () => {
    expect(splitArticleBodyBlocks('<h2>Intro</h2><p>First body paragraph.</p><p>Second body paragraph.</p>')).toEqual([
      '<h2>Intro</h2>',
      '<p>First body paragraph.</p>',
      '<p>Second body paragraph.</p>',
    ]);
  });
});