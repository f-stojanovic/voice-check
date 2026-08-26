import { describe, expect, it } from 'vitest';
import { extractReadableText } from './extract.js';

describe('readable text extraction', () => {
  it('prefers the article subtree over the surrounding page', () => {
    const html = `<html><body>
      <nav>Home Blog About Contact</nav>
      <article><h1>Naslov</h1><p>Prvi pasus.</p><p>Drugi pasus.</p></article>
      <footer>Copyright 2026</footer>
    </body></html>`;
    const text = extractReadableText(html);
    expect(text).toContain('Prvi pasus.');
    expect(text).not.toContain('Home Blog About');
    expect(text).not.toContain('Copyright');
  });

  it('drops scripts and styles wholesale', () => {
    const html = '<main><script>var x = "hello";</script><style>.a{}</style><p>Tekst.</p></main>';
    expect(extractReadableText(html)).toBe('Tekst.');
  });

  it('turns block tags into paragraph breaks so sentences survive', () => {
    // Without this the analyst sees one run-on line and loses every boundary.
    const text = extractReadableText('<main><p>Prva.</p><p>Druga.</p></main>');
    expect(text).toBe('Prva.\n\nDruga.');
  });

  it('decodes the entities that actually turn up', () => {
    const text = extractReadableText('<main><p>A &amp; B &mdash; C&nbsp;D &#x161;</p></main>');
    expect(text).toBe('A & B — C D š');
  });

  it('falls back to the body, boilerplate and all, when nothing is marked', () => {
    // Documented failure, asserted so it is not mistaken for a bug later: a
    // page with no <article> or <main> hands navigation text to the analyst.
    const text = extractReadableText('<html><body><div>Cookies</div><p>Tekst.</p></body></html>');
    expect(text).toContain('Cookies');
    expect(text).toContain('Tekst.');
  });

  it('returns nothing useful for a JavaScript-rendered shell', () => {
    // The most common real failure. The word-count guard in loadSource is what
    // turns this into an error message rather than an analysis of an empty div.
    expect(extractReadableText('<html><body><div id="root"></div></body></html>')).toBe('');
  });
});
