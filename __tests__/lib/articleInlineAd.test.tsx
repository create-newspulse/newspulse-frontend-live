import { formatArticleBodyHtml, parseControlledFacebookBlock, parseControlledInlineImageBlock, parseControlledInstagramBlock, parseControlledXBlock, parseControlledYouTubeBlock, splitArticleBodyBlocks, stripDuplicateOpeningParagraph } from '../../lib/articleBody';
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

  it('renders an approved controlled inline image with caption and credit', () => {
    const html = formatArticleBodyHtml('<div data-np-block="inline-image" data-np-media-id="media_123" data-np-src="https://cdn.newspulse.co.in/images/story.jpg" data-np-caption="Flood rescue image" data-np-credit="News Pulse / Staff" data-np-width="1200" data-np-height="800"></div>');

    expect(html).toContain('<figure class="np-inline-image" data-np-block="inline-image" data-np-media-id="media_123">');
    expect(html).toContain('<img class="np-inline-image__media" src="https://cdn.newspulse.co.in/images/story.jpg" alt="Flood rescue image" width="1200" height="800" loading="lazy" decoding="async" />');
    expect(html).toContain('<span class="np-inline-image__caption-text" data-np-caption="true">Flood rescue image</span>');
    expect(html).toContain('<span class="np-inline-image__credit" data-np-credit="true">Photo: News Pulse / Staff</span>');
  });

  it('keeps legacy img HTML rendering through the sanitizer fallback', () => {
    const html = formatArticleBodyHtml('<p>Legacy image follows.</p><img src="https://cdn.newspulse.co.in/legacy.jpg" alt="Legacy image" loading="lazy" />');

    expect(html).toContain('<p>Legacy image follows.</p>');
    expect(html).toContain('<img src="https://cdn.newspulse.co.in/legacy.jpg" alt="Legacy image" loading="lazy" />');
  });

  it('allows missing caption on approved controlled inline images', () => {
    const html = formatArticleBodyHtml('<div data-np-block="inline-image" data-np-media-id="media_124" data-np-src="https://cdn.newspulse.co.in/images/story.jpg" data-np-credit="News Pulse" data-np-width="1200" data-np-height="800"></div>');

    expect(html).not.toContain('data-np-caption');
    expect(html).toContain('Photo: News Pulse');
  });

  it('allows missing credit on approved controlled inline images', () => {
    const html = formatArticleBodyHtml('<div data-np-block="inline-image" data-np-media-id="media_125" data-np-src="https://cdn.newspulse.co.in/images/story.jpg" data-np-caption="Only caption"></div>');

    expect(html).toContain('Only caption');
    expect(html).not.toContain('data-np-credit');
  });

  it('strips unsafe event attributes from controlled inline images', () => {
    const html = formatArticleBodyHtml('<div data-np-block="inline-image" data-np-media-id="media_126" data-np-src="https://cdn.newspulse.co.in/images/story.jpg" data-np-caption="Safe" onclick="alert(1)"></div>');

    expect(html).toContain('data-np-block="inline-image"');
    expect(html).not.toContain('onclick');
  });

  it('rejects javascript URLs on controlled inline images', () => {
    const html = formatArticleBodyHtml('<div data-np-block="inline-image" data-np-media-id="media_127" data-np-src="javascript:alert(1)" data-np-caption="Unsafe"></div>');

    expect(html).toBe('');
  });

  it('does not preserve approved figure attributes with an invalid media id', () => {
    const html = formatArticleBodyHtml('<figure class="np-inline-image" data-np-block="inline-image" data-np-media-id="../bad"><img class="np-inline-image__media" src="https://cdn.newspulse.co.in/images/story.jpg" alt="Story" /></figure>');

    expect(html).toBe('<img class="np-inline-image__media" src="https://cdn.newspulse.co.in/images/story.jpg" alt="Story" />');
    expect(parseControlledInlineImageBlock(html)).toBeNull();
  });

  it('does not treat arbitrary unapproved data markers as trusted media', () => {
    const html = formatArticleBodyHtml('<div data-block="inline-image" data-src="https://cdn.newspulse.co.in/images/story.jpg" data-caption="Unsafe"><img src="javascript:alert(1)" onerror="alert(2)" /></div>');

    expect(html).toBe('<div><img /></div>');
    expect(html).not.toContain('data-block');
    expect(html).not.toContain('data-src');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('onerror');
  });

  it('keeps EN, HI, and GU controlled image variants on the same media source and id', () => {
    const variants = ['English caption', 'हिंदी कैप्शन', 'ગુજરાતી કેપ્શન'].map((caption) => {
      const html = formatArticleBodyHtml(`<div data-np-block="inline-image" data-np-media-id="shared_media_1" data-np-src="https://cdn.newspulse.co.in/images/shared.jpg" data-np-caption="${caption}"></div>`);
      return parseControlledInlineImageBlock(html);
    });

    expect(variants.map((variant) => variant?.mediaId)).toEqual(['shared_media_1', 'shared_media_1', 'shared_media_1']);
    expect(variants.map((variant) => variant?.src)).toEqual([
      'https://cdn.newspulse.co.in/images/shared.jpg',
      'https://cdn.newspulse.co.in/images/shared.jpg',
      'https://cdn.newspulse.co.in/images/shared.jpg',
    ]);
    expect(variants.map((variant) => variant?.caption)).toEqual(['English caption', 'हिंदी कैप्शन', 'ગુજરાતી કેપ્શન']);
  });

  it('preserves a valid canonical YouTube marker as a controlled embed block', () => {
    const html = formatArticleBodyHtml('<div data-np-block="youtube" data-np-video-id="AbCdEfGhIjK" data-np-url="https://www.youtube.com/watch?v=AbCdEfGhIjK"></div>');
    const embed = parseControlledYouTubeBlock(html);

    expect(html).toContain('class="np-youtube-embed"');
    expect(html).toContain('data-np-block="youtube"');
    expect(html).toContain('data-np-video-id="AbCdEfGhIjK"');
    expect(embed).toEqual({
      videoId: 'AbCdEfGhIjK',
      url: 'https://www.youtube.com/watch?v=AbCdEfGhIjK',
      embedUrl: 'https://www.youtube-nocookie.com/embed/AbCdEfGhIjK?rel=0&modestbranding=1&playsinline=1',
    });
  });

  it('generates youtube-nocookie embed URLs for controlled YouTube markers', () => {
    const html = formatArticleBodyHtml('<div data-np-block="youtube" data-np-video-id="ZyXwVuTsRqP" data-np-url="https://youtu.be/ZyXwVuTsRqP"></div>');

    expect(parseControlledYouTubeBlock(html)?.embedUrl).toBe('https://www.youtube-nocookie.com/embed/ZyXwVuTsRqP?rel=0&modestbranding=1&playsinline=1');
  });

  it('rejects malformed controlled YouTube markers', () => {
    const missingId = formatArticleBodyHtml('<div data-np-block="youtube" data-np-url="https://www.youtube.com/watch?v=AbCdEfGhIjK"></div>');
    const mismatchedId = formatArticleBodyHtml('<div data-np-block="youtube" data-np-video-id="WrongVideo1" data-np-url="https://www.youtube.com/watch?v=AbCdEfGhIjK"></div>');

    expect(missingId).toBe('');
    expect(mismatchedId).toBe('');
  });

  it('rejects arbitrary-domain controlled YouTube markers', () => {
    const html = formatArticleBodyHtml('<div data-np-block="youtube" data-np-video-id="AbCdEfGhIjK" data-np-url="https://example.com/watch?v=AbCdEfGhIjK"></div>');

    expect(html).toBe('');
    expect(parseControlledYouTubeBlock(html)).toBeNull();
  });

  it('rejects javascript URLs on controlled YouTube markers', () => {
    const html = formatArticleBodyHtml('<div data-np-block="youtube" data-np-video-id="AbCdEfGhIjK" data-np-url="javascript:alert(1)"></div>');

    expect(html).toBe('');
    expect(parseControlledYouTubeBlock(html)).toBeNull();
  });

  it('still strips raw iframe HTML from article bodies', () => {
    const html = formatArticleBodyHtml('<p>Before video.</p><iframe src="https://www.youtube.com/embed/AbCdEfGhIjK"></iframe><p>After video.</p>');

    expect(html).toContain('<p>Before video.</p>');
    expect(html).toContain('<p>After video.</p>');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('youtube.com/embed');
  });

  it('still strips raw script HTML from article bodies', () => {
    const html = formatArticleBodyHtml('<p>Before script.</p><script>alert(1)</script><p>After script.</p>');

    expect(html).toContain('<p>Before script.</p>');
    expect(html).toContain('<p>After script.</p>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
  });

  it('keeps legacy article HTML rendering through the YouTube marker change', () => {
    const html = formatArticleBodyHtml('<p>Legacy <strong>article</strong> body.</p><blockquote>Quoted context.</blockquote>');

    expect(html).toBe('<p>Legacy <strong>article</strong> body.</p><blockquote>Quoted context.</blockquote>');
  });

  it('keeps EN, HI, and GU controlled YouTube variants on the same video id', () => {
    const variants = ['en', 'hi', 'gu'].map(() => {
      const html = formatArticleBodyHtml('<div data-np-block="youtube" data-np-video-id="AbCdEfGhIjK" data-np-url="https://www.youtube.com/watch?v=AbCdEfGhIjK"></div>');
      return parseControlledYouTubeBlock(html);
    });

    expect(variants.map((variant) => variant?.videoId)).toEqual(['AbCdEfGhIjK', 'AbCdEfGhIjK', 'AbCdEfGhIjK']);
    expect(variants.map((variant) => variant?.embedUrl)).toEqual([
      'https://www.youtube-nocookie.com/embed/AbCdEfGhIjK?rel=0&modestbranding=1&playsinline=1',
      'https://www.youtube-nocookie.com/embed/AbCdEfGhIjK?rel=0&modestbranding=1&playsinline=1',
      'https://www.youtube-nocookie.com/embed/AbCdEfGhIjK?rel=0&modestbranding=1&playsinline=1',
    ]);
  });

  it('preserves a valid x.com marker as a controlled X embed block', () => {
    const html = formatArticleBodyHtml('<div data-np-block="x" data-np-post-id="2050104453630718079" data-np-url="https://x.com/i/status/2050104453630718079?s=20"></div>');
    const embed = parseControlledXBlock(html);

    expect(html).toContain('class="np-x-embed"');
    expect(html).toContain('data-np-block="x"');
    expect(html).toContain('data-np-post-id="2050104453630718079"');
    expect(embed).toEqual({
      postId: '2050104453630718079',
      url: 'https://x.com/i/status/2050104453630718079',
    });
  });

  it('preserves a valid twitter.com legacy marker as a controlled X embed block', () => {
    const html = formatArticleBodyHtml('<div data-np-block="x" data-np-post-id="2050104453630718079" data-np-url="https://twitter.com/newspulse/status/2050104453630718079"></div>');

    expect(parseControlledXBlock(html)).toEqual({
      postId: '2050104453630718079',
      url: 'https://twitter.com/newspulse/status/2050104453630718079',
    });
  });

  it('rejects malformed controlled X markers', () => {
    const missingId = formatArticleBodyHtml('<div data-np-block="x" data-np-url="https://x.com/i/status/2050104453630718079"></div>');
    const badId = formatArticleBodyHtml('<div data-np-block="x" data-np-post-id="abc" data-np-url="https://x.com/i/status/2050104453630718079"></div>');
    const nonEmpty = formatArticleBodyHtml('<div data-np-block="x" data-np-post-id="2050104453630718079" data-np-url="https://x.com/i/status/2050104453630718079"><blockquote class="twitter-tweet">raw embed</blockquote></div>');

    expect(missingId).toBe('');
    expect(badId).toBe('');
    expect(nonEmpty).toBe('');
  });

  it('rejects controlled X URL and post ID mismatches', () => {
    const html = formatArticleBodyHtml('<div data-np-block="x" data-np-post-id="2050104453630718079" data-np-url="https://x.com/i/status/1111104453630718079"></div>');

    expect(html).toBe('');
    expect(parseControlledXBlock(html)).toBeNull();
  });

  it('rejects controlled X lookalike domains', () => {
    const html = formatArticleBodyHtml('<div data-np-block="x" data-np-post-id="2050104453630718079" data-np-url="https://x.com.example.com/i/status/2050104453630718079"></div>');

    expect(html).toBe('');
    expect(parseControlledXBlock(html)).toBeNull();
  });

  it('rejects javascript and data URLs on controlled X markers', () => {
    const javascriptUrl = formatArticleBodyHtml('<div data-np-block="x" data-np-post-id="2050104453630718079" data-np-url="javascript:alert(1)"></div>');
    const dataUrl = formatArticleBodyHtml('<div data-np-block="x" data-np-post-id="2050104453630718079" data-np-url="data:text/html,boom"></div>');

    expect(javascriptUrl).toBe('');
    expect(dataUrl).toBe('');
  });

  it('keeps EN, HI, and GU controlled X variants on the same post id', () => {
    const variants = ['en', 'hi', 'gu'].map(() => {
      const html = formatArticleBodyHtml('<div data-np-block="x" data-np-post-id="2050104453630718079" data-np-url="https://x.com/i/status/2050104453630718079"></div>');
      return parseControlledXBlock(html);
    });

    expect(variants.map((variant) => variant?.postId)).toEqual(['2050104453630718079', '2050104453630718079', '2050104453630718079']);
    expect(variants.map((variant) => variant?.url)).toEqual([
      'https://x.com/i/status/2050104453630718079',
      'https://x.com/i/status/2050104453630718079',
      'https://x.com/i/status/2050104453630718079',
    ]);
  });

  it('preserves a valid Instagram /p/ marker as a controlled embed block', () => {
    const html = formatArticleBodyHtml('<div data-np-block="instagram" data-np-shortcode="C0ffee_Post1" data-np-url="https://www.instagram.com/p/C0ffee_Post1/" data-np-embed-url="https://evil.example/embed"></div>');
    const embed = parseControlledInstagramBlock(html);

    expect(html).toContain('class="np-instagram-embed"');
    expect(html).toContain('data-np-block="instagram"');
    expect(html).toContain('data-np-shortcode="C0ffee_Post1"');
    expect(html).not.toContain('data-np-embed-url');
    expect(html).not.toContain('evil.example');
    expect(embed).toEqual({
      kind: 'p',
      shortcode: 'C0ffee_Post1',
      url: 'https://www.instagram.com/p/C0ffee_Post1/',
      embedUrl: 'https://www.instagram.com/p/C0ffee_Post1/embed',
    });
  });

  it('preserves valid Instagram reel and tv markers with internally generated embed URLs', () => {
    const reelHtml = formatArticleBodyHtml('<div data-np-block="instagram" data-np-shortcode="Reel_Code9" data-np-url="https://instagram.com/reel/Reel_Code9/"></div>');
    const tvHtml = formatArticleBodyHtml('<div data-np-block="instagram" data-np-shortcode="Tv_Code99" data-np-url="https://www.instagram.com/tv/Tv_Code99/"></div>');

    expect(parseControlledInstagramBlock(reelHtml)).toEqual({
      kind: 'reel',
      shortcode: 'Reel_Code9',
      url: 'https://www.instagram.com/reel/Reel_Code9/',
      embedUrl: 'https://www.instagram.com/reel/Reel_Code9/embed',
    });
    expect(parseControlledInstagramBlock(tvHtml)?.embedUrl).toBe('https://www.instagram.com/tv/Tv_Code99/embed');
    expect(reelHtml).not.toContain('data-np-embed-url');
    expect(tvHtml).not.toContain('data-np-embed-url');
  });

  it('rejects malformed Instagram markers and marker URL mismatches', () => {
    const missingShortcode = formatArticleBodyHtml('<div data-np-block="instagram" data-np-url="https://www.instagram.com/p/C0ffee_Post1/"></div>');
    const badShortcode = formatArticleBodyHtml('<div data-np-block="instagram" data-np-shortcode="bad.code" data-np-url="https://www.instagram.com/p/bad.code/"></div>');
    const mismatchedShortcode = formatArticleBodyHtml('<div data-np-block="instagram" data-np-shortcode="C0ffee_Post1" data-np-url="https://www.instagram.com/p/Other_Code1/"></div>');
    const nonEmpty = formatArticleBodyHtml('<div data-np-block="instagram" data-np-shortcode="C0ffee_Post1" data-np-url="https://www.instagram.com/p/C0ffee_Post1/"><blockquote class="instagram-media">raw embed</blockquote></div>');

    expect(missingShortcode).toBe('');
    expect(badShortcode).toBe('');
    expect(mismatchedShortcode).toBe('');
    expect(nonEmpty).toBe('');
  });

  it('rejects unsafe Instagram URLs and unsupported Instagram paths', () => {
    const lookalike = formatArticleBodyHtml('<div data-np-block="instagram" data-np-shortcode="C0ffee_Post1" data-np-url="https://instagram.com.example.com/p/C0ffee_Post1/"></div>');
    const javascriptUrl = formatArticleBodyHtml('<div data-np-block="instagram" data-np-shortcode="C0ffee_Post1" data-np-url="javascript:alert(1)"></div>');
    const dataUrl = formatArticleBodyHtml('<div data-np-block="instagram" data-np-shortcode="C0ffee_Post1" data-np-url="data:text/html,boom"></div>');
    const profileUrl = formatArticleBodyHtml('<div data-np-block="instagram" data-np-shortcode="newspulse" data-np-url="https://www.instagram.com/newspulse/"></div>');
    const storyUrl = formatArticleBodyHtml('<div data-np-block="instagram" data-np-shortcode="C0ffee_Post1" data-np-url="https://www.instagram.com/stories/newspulse/C0ffee_Post1/"></div>');

    expect(lookalike).toBe('');
    expect(javascriptUrl).toBe('');
    expect(dataUrl).toBe('');
    expect(profileUrl).toBe('');
    expect(storyUrl).toBe('');
  });

  it('does not preserve raw Instagram blockquote/script HTML as a controlled embed', () => {
    const html = formatArticleBodyHtml('<p>Before Instagram.</p><blockquote class="instagram-media"><a href="https://www.instagram.com/p/C0ffee_Post1/">View post</a></blockquote><script src="https://www.instagram.com/embed.js"></script><p>After Instagram.</p>');

    expect(html).toContain('<p>Before Instagram.</p>');
    expect(html).toContain('<p>After Instagram.</p>');
    expect(html).not.toContain('instagram-media');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('embed.js');
    expect(parseControlledInstagramBlock(html)).toBeNull();
  });

  it('keeps EN, HI, and GU controlled Instagram variants on the same shortcode and URL', () => {
    const variants = ['en', 'hi', 'gu'].map(() => {
      const html = formatArticleBodyHtml('<div data-np-block="instagram" data-np-shortcode="C0ffee_Post1" data-np-url="https://www.instagram.com/p/C0ffee_Post1/"></div>');
      return parseControlledInstagramBlock(html);
    });

    expect(variants.map((variant) => variant?.shortcode)).toEqual(['C0ffee_Post1', 'C0ffee_Post1', 'C0ffee_Post1']);
    expect(variants.map((variant) => variant?.url)).toEqual([
      'https://www.instagram.com/p/C0ffee_Post1/',
      'https://www.instagram.com/p/C0ffee_Post1/',
      'https://www.instagram.com/p/C0ffee_Post1/',
    ]);
    expect(variants.map((variant) => variant?.embedUrl)).toEqual([
      'https://www.instagram.com/p/C0ffee_Post1/embed',
      'https://www.instagram.com/p/C0ffee_Post1/embed',
      'https://www.instagram.com/p/C0ffee_Post1/embed',
    ]);
  });

  it('preserves a valid Facebook /posts/ marker as a controlled embed block', () => {
    const html = formatArticleBodyHtml('<div data-np-block="facebook" data-np-url="https://www.facebook.com/NewsPulseIndia/posts/pfbid02SafePost123" data-np-embed-url="https://evil.example/plugin"></div>');
    const embed = parseControlledFacebookBlock(html);

    expect(html).toContain('class="np-facebook-embed"');
    expect(html).toContain('data-np-block="facebook"');
    expect(html).toContain('data-np-url="https://www.facebook.com/NewsPulseIndia/posts/pfbid02SafePost123"');
    expect(html).not.toContain('data-np-embed-url');
    expect(html).not.toContain('evil.example');
    expect(embed?.kind).toBe('post');
    expect(embed?.url).toBe('https://www.facebook.com/NewsPulseIndia/posts/pfbid02SafePost123');
    expect(embed?.embedUrl).toContain('https://www.facebook.com/plugins/post.php?');
    expect(embed?.embedUrl).toContain('href=https%3A%2F%2Fwww.facebook.com%2FNewsPulseIndia%2Fposts%2Fpfbid02SafePost123');
    expect(embed?.embedUrl).toContain('show_text=true');
  });

  it('preserves a valid Facebook permalink marker as a controlled embed block', () => {
    const html = formatArticleBodyHtml('<div data-np-block="facebook" data-np-url="https://facebook.com/permalink.php?story_fbid=pfbid02SafeStory123&id=123456789012345"></div>');
    const embed = parseControlledFacebookBlock(html);

    expect(embed).toEqual({
      kind: 'permalink',
      url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid02SafeStory123&id=123456789012345',
      embedUrl: 'https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fpermalink.php%3Fstory_fbid%3Dpfbid02SafeStory123%26id%3D123456789012345&show_text=true&width=500',
    });
  });

  it('rejects malformed and unsupported Facebook markers', () => {
    const missingUrl = formatArticleBodyHtml('<div data-np-block="facebook"></div>');
    const nonEmpty = formatArticleBodyHtml('<div data-np-block="facebook" data-np-url="https://www.facebook.com/NewsPulseIndia/posts/pfbid02SafePost123"><div class="fb-post">raw SDK</div></div>');
    const storyUrl = formatArticleBodyHtml('<div data-np-block="facebook" data-np-url="https://www.facebook.com/stories/NewsPulseIndia/1234567890"></div>');
    const profileUrl = formatArticleBodyHtml('<div data-np-block="facebook" data-np-url="https://www.facebook.com/NewsPulseIndia"></div>');
    const photoUrl = formatArticleBodyHtml('<div data-np-block="facebook" data-np-url="https://www.facebook.com/photo.php?fbid=1234567890"></div>');
    const pluginUrl = formatArticleBodyHtml('<div data-np-block="facebook" data-np-url="https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2FNewsPulseIndia%2Fposts%2Fpfbid02SafePost123"></div>');

    expect(missingUrl).toBe('');
    expect(nonEmpty).toBe('');
    expect(storyUrl).toBe('');
    expect(profileUrl).toBe('');
    expect(photoUrl).toBe('');
    expect(pluginUrl).toBe('');
  });

  it('rejects lookalike domains and unsafe Facebook URLs', () => {
    const lookalike = formatArticleBodyHtml('<div data-np-block="facebook" data-np-url="https://facebook.com.example.com/NewsPulseIndia/posts/pfbid02SafePost123"></div>');
    const javascriptUrl = formatArticleBodyHtml('<div data-np-block="facebook" data-np-url="javascript:alert(1)"></div>');
    const dataUrl = formatArticleBodyHtml('<div data-np-block="facebook" data-np-url="data:text/html,boom"></div>');
    const httpUrl = formatArticleBodyHtml('<div data-np-block="facebook" data-np-url="http://www.facebook.com/NewsPulseIndia/posts/pfbid02SafePost123"></div>');

    expect(lookalike).toBe('');
    expect(javascriptUrl).toBe('');
    expect(dataUrl).toBe('');
    expect(httpUrl).toBe('');
  });

  it('does not preserve raw Facebook iframe, script or SDK markup as a controlled embed', () => {
    const html = formatArticleBodyHtml('<p>Before Facebook.</p><div class="fb-post" data-href="https://www.facebook.com/NewsPulseIndia/posts/pfbid02SafePost123"></div><blockquote class="fb-xfbml-parse-ignore"><a href="https://www.facebook.com/NewsPulseIndia/posts/pfbid02SafePost123">View post</a></blockquote><iframe src="https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2FNewsPulseIndia%2Fposts%2Fpfbid02SafePost123"></iframe><script src="https://connect.facebook.net/en_US/sdk.js"></script><p>After Facebook.</p>');

    expect(html).toContain('<p>Before Facebook.</p>');
    expect(html).toContain('<p>After Facebook.</p>');
    expect(html).not.toContain('fb-post');
    expect(html).not.toContain('fb-xfbml-parse-ignore');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('plugins/post.php');
    expect(html).not.toContain('sdk.js');
    expect(parseControlledFacebookBlock(html)).toBeNull();
  });

  it('keeps EN, HI, and GU controlled Facebook variants on the same validated URL', () => {
    const variants = ['en', 'hi', 'gu'].map(() => {
      const html = formatArticleBodyHtml('<div data-np-block="facebook" data-np-url="https://www.facebook.com/NewsPulseIndia/posts/pfbid02SafePost123"></div>');
      return parseControlledFacebookBlock(html);
    });

    expect(variants.map((variant) => variant?.url)).toEqual([
      'https://www.facebook.com/NewsPulseIndia/posts/pfbid02SafePost123',
      'https://www.facebook.com/NewsPulseIndia/posts/pfbid02SafePost123',
      'https://www.facebook.com/NewsPulseIndia/posts/pfbid02SafePost123',
    ]);
    expect(variants.map((variant) => variant?.embedUrl)).toEqual([
      'https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2FNewsPulseIndia%2Fposts%2Fpfbid02SafePost123&show_text=true&width=500',
      'https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2FNewsPulseIndia%2Fposts%2Fpfbid02SafePost123&show_text=true&width=500',
      'https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2FNewsPulseIndia%2Fposts%2Fpfbid02SafePost123&show_text=true&width=500',
    ]);
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

  it('keeps controlled figures as their own article body blocks', () => {
    expect(splitArticleBodyBlocks('<p>Before.</p><figure data-np-block="inline-image"><img src="https://cdn.newspulse.co.in/story.jpg" /></figure><p>After.</p>')).toEqual([
      '<p>Before.</p>',
      '<figure data-np-block="inline-image"><img src="https://cdn.newspulse.co.in/story.jpg" /></figure>',
      '<p>After.</p>',
    ]);
  });

  it('keeps controlled YouTube markers as their own article body blocks', () => {
    expect(splitArticleBodyBlocks('<p>Before.</p><div class="np-youtube-embed" data-np-block="youtube" data-np-video-id="AbCdEfGhIjK" data-np-url="https://www.youtube.com/watch?v=AbCdEfGhIjK" data-np-embed-url="https://www.youtube-nocookie.com/embed/AbCdEfGhIjK?rel=0&amp;modestbranding=1&amp;playsinline=1"></div><p>After.</p>')).toEqual([
      '<p>Before.</p>',
      '<div class="np-youtube-embed" data-np-block="youtube" data-np-video-id="AbCdEfGhIjK" data-np-url="https://www.youtube.com/watch?v=AbCdEfGhIjK" data-np-embed-url="https://www.youtube-nocookie.com/embed/AbCdEfGhIjK?rel=0&amp;modestbranding=1&amp;playsinline=1"></div>',
      '<p>After.</p>',
    ]);
  });

  it('keeps controlled X markers as their own article body blocks', () => {
    expect(splitArticleBodyBlocks('<p>Before.</p><div class="np-x-embed" data-np-block="x" data-np-post-id="2050104453630718079" data-np-url="https://x.com/i/status/2050104453630718079"></div><p>After.</p>')).toEqual([
      '<p>Before.</p>',
      '<div class="np-x-embed" data-np-block="x" data-np-post-id="2050104453630718079" data-np-url="https://x.com/i/status/2050104453630718079"></div>',
      '<p>After.</p>',
    ]);
  });

  it('keeps controlled Facebook markers as their own article body blocks', () => {
    expect(splitArticleBodyBlocks('<p>Before.</p><div class="np-facebook-embed" data-np-block="facebook" data-np-url="https://www.facebook.com/NewsPulseIndia/posts/pfbid02SafePost123"></div><p>After.</p>')).toEqual([
      '<p>Before.</p>',
      '<div class="np-facebook-embed" data-np-block="facebook" data-np-url="https://www.facebook.com/NewsPulseIndia/posts/pfbid02SafePost123"></div>',
      '<p>After.</p>',
    ]);
  });
});