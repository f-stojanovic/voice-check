/**
 * `npm run web` — the public surface.
 *
 * WHAT IS PUBLIC AND WHY IT IS ONLY THIS.
 *
 * `check` is here: it runs deterministic rules against text in memory, calls
 * no model, and costs nothing per request. It can be handed to a stranger.
 *
 * `brief` is not here and is not going to be. It makes two Claude calls per
 * run, on the author's key, at roughly $0.11 each. A public endpoint for it is
 * a public endpoint for spending somebody else's money, and no amount of rate
 * limiting turns that into a good idea — it only sets a price on the abuse.
 * The split is not a staging decision to be revisited when the UI is nicer; it
 * follows from which half of the tool has a marginal cost.
 *
 * See ADR 013.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { detectLanguage } from '../detect.js';
import { check } from '../report.js';
import { renderError, renderHome, renderReport, type PageOptions } from './page.js';
import type { Language } from '../types.js';

/**
 * Both limits are stated on the page (C3).
 *
 * The character cap is not about protecting the server — the rules are linear
 * and a megabyte would be fine — it is about the response. A 200,000-character
 * text produces a report nobody reads and a highlighted block that hangs a
 * browser, so the cap is a limit on the usefulness of the answer.
 */
export const DEFAULT_OPTIONS: PageOptions = {
  maxChars: 40_000,
  rateLimitPerMinute: 20,
};

/**
 * A fixed-window counter, in memory, per address.
 *
 * Deliberately the simplest thing that works for one process. It resets on
 * restart and does not survive a second instance, which are both real
 * limitations and both irrelevant until this runs behind more than one
 * process. Recording them here so that whoever adds a second instance knows
 * this stops being a rate limit at that moment.
 */
export function createRateLimiter(perMinute: number, windowMs = 60_000) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return function allow(key: string, now: number): boolean {
    const entry = hits.get(key);
    if (entry === undefined || now >= entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    // Unbounded growth is bounded in practice by the sweep below; a map keyed
    // by address with a one-minute window is a few thousand entries at worst.
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
    }
    entry.count += 1;
    return entry.count <= perMinute;
  };
}

export function createApp(options: PageOptions = DEFAULT_OPTIONS): Hono {
  const app = new Hono();
  const allow = createRateLimiter(options.rateLimitPerMinute);

  app.get('/', (c) => c.html(renderHome(options)));

  app.post('/', async (c) => {
    const address =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'local';

    if (!allow(address, Date.now())) {
      return c.html(
        renderError(
          options,
          `Rate limit: ${options.rateLimitPerMinute} submissions per minute. Try again shortly.`,
        ),
        429,
      );
    }

    // A form post, not a fetch (C4). This is the whole reason the page works
    // with JavaScript disabled, and it is four lines rather than a philosophy.
    const body = await c.req.parseBody();
    const text = typeof body['text'] === 'string' ? body['text'] : '';
    const langField = typeof body['lang'] === 'string' ? body['lang'] : 'auto';

    if (text.trim().length === 0) {
      return c.html(renderError(options, 'Nothing to check — the text was empty.'), 400);
    }
    if (text.length > options.maxChars) {
      return c.html(
        renderError(
          options,
          `That is ${text.length.toLocaleString('en-GB')} characters, over the ` +
            `${options.maxChars.toLocaleString('en-GB')} limit.`,
          text.slice(0, options.maxChars),
        ),
        413,
      );
    }

    const declared: Language | undefined =
      langField === 'sr' || langField === 'en' ? langField : undefined;
    const detected = declared === undefined ? detectLanguage(text) : undefined;
    const language = declared ?? detected?.language ?? 'en';

    try {
      const outcome = check(text, { language });
      // Nothing is written anywhere: no log line carrying the text, no file, no
      // database. The only copy is the one being rendered back to the sender.
      return c.html(renderReport(options, outcome, text, detected?.basis));
    } catch (cause) {
      return c.html(renderError(options, `Internal error: ${(cause as Error).message}`, text), 500);
    }
  });

  return app;
}

/** Only starts a server when run directly, so tests can import `createApp`. */
const invokedDirectly = process.argv[1] !== undefined && process.argv[1].includes('web/server');

if (invokedDirectly) {
  const port = Number(process.env['PORT'] ?? 8787);
  serve({ fetch: createApp().fetch, port }, (info) => {
    process.stdout.write(
      `voice-check is on http://localhost:${info.port}\n` +
        `  check only — deterministic, no model calls, no key needed\n` +
        `  nothing is stored\n`,
    );
  });
}
