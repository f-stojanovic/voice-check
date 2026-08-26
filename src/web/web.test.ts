import { describe, expect, it } from 'vitest';
import { createApp, createRateLimiter, DEFAULT_OPTIONS } from './server.js';

const app = createApp();

async function post(text: string, lang = 'auto'): Promise<Response> {
  return app.request('/', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ text, lang }),
  });
}

const LONG_SR = Array.from(
  { length: 60 },
  (_, i) => `Upit ${i} je radio sporo pa smo merili trajanje češće u toku dana.`,
).join(' ');

describe('the page', () => {
  it('serves a form on GET', async () => {
    const html = await (await app.request('/')).text();
    expect(html).toContain('<form method="post"');
    expect(html).toContain('<textarea');
  });

  it('works without JavaScript: a form post, not a fetch', async () => {
    // The whole of C4. If this ever became a fetch, the page would stop
    // working in a text browser and with scripts disabled, and nothing else
    // in the suite would notice.
    const html = await (await app.request('/')).text();
    expect(html).not.toContain('<script');
    expect(html).toContain('method="post"');
  });

  it('checks a submitted text and reports a score', async () => {
    const html = await (await post(LONG_SR, 'sr')).text();
    expect(html).toContain('density rule');
    expect(html).toContain('Density rules');
  });

  it('underlines findings in place, using the recorded positions', async () => {
    const html = await (await post(`Stručnjaci kažu da je tako. ${LONG_SR}`, 'sr')).text();
    expect(html).toContain('<mark class="finding"');
    expect(html).toContain('Stručnjaci kažu');
  });

  it('escapes the submitted text everywhere it appears', async () => {
    // Escaping happens per fragment because escaping changes lengths, and
    // every offset was computed against the unescaped original.
    const html = await (await post(`<script>alert(1)</script> ${LONG_SR}`, 'sr')).text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('rejects an empty submission without pretending to have graded it', async () => {
    const response = await post('   ');
    expect(response.status).toBe(400);
    expect(await response.text()).toContain('Nothing to check');
  });

  it('refuses a text over the size limit and says the size', async () => {
    const response = await post('a '.repeat(DEFAULT_OPTIONS.maxChars));
    expect(response.status).toBe(413);
    expect(await response.text()).toContain('over the');
  });

  it('states the limits on the page rather than only enforcing them', async () => {
    const html = await (await app.request('/')).text();
    expect(html).toContain('characters per');
    expect(html).toContain('submissions per minute');
  });

  it('states that nothing is stored', async () => {
    const html = await (await app.request('/')).text();
    expect(html).toContain('Nothing here is stored');
  });

  it('shows a hard failure separately from the score', async () => {
    // The two-kinds split has to survive into the UI: a text that fails hard
    // must not read as a text with a mediocre number.
    const stripped = Array.from(
      { length: 40 },
      () => 'Upit je radio sporo pa smo merili trajanje redovno.',
    ).join(' ');
    const html = await (await post(stripped, 'sr')).text();
    expect(html).toContain('Hard failures');
    expect(html).toContain('diacritics');
  });

  it('says the text was not scored rather than showing a zero', async () => {
    const html = await (await post('Kratka beleška o upitu.', 'sr')).text();
    expect(html).toContain('not scored');
  });

  it('honours an explicit language over detection', async () => {
    const html = await (await post(LONG_SR, 'sr')).text();
    expect(html).not.toContain('Language was detected');
  });

  it('says so when it detected the language', async () => {
    const html = await (await post(LONG_SR, 'auto')).text();
    expect(html).toContain('Language was detected');
  });

  it('shows the uncalibrated count, as the CLI does', async () => {
    const html = await (await post(LONG_SR, 'sr')).text();
    expect(html).toMatch(/This run used \d+ uncalibrated/);
  });
});

describe('the rate limiter', () => {
  it('allows up to the limit inside a window', () => {
    const allow = createRateLimiter(3);
    expect([1, 2, 3].map(() => allow('a', 1000))).toEqual([true, true, true]);
    expect(allow('a', 1000)).toBe(false);
  });

  it('resets when the window rolls over', () => {
    const allow = createRateLimiter(1);
    expect(allow('a', 0)).toBe(true);
    expect(allow('a', 100)).toBe(false);
    expect(allow('a', 60_000)).toBe(true);
  });

  it('counts each address separately', () => {
    const allow = createRateLimiter(1);
    expect(allow('a', 0)).toBe(true);
    expect(allow('b', 0)).toBe(true);
    expect(allow('a', 0)).toBe(false);
  });
});
