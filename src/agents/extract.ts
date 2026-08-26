/**
 * Getting readable text out of a file or a URL.
 *
 * DELIBERATELY CRUDE, AND HERE IS THE LIST OF PAGES IT WILL FAIL ON. A real
 * extractor is Readability or Mercury — a scoring pass over the DOM that
 * guesses which subtree is the article. That is a dependency with a DOM
 * implementation behind it, and it is not warranted for a tool whose input is
 * usually a file the author already has.
 *
 * What this does: fetch, drop `<script>`, `<style>`, `<nav>`, `<header>`,
 * `<footer>`, `<aside>` and `<form>` wholesale, prefer the contents of
 * `<article>` or `<main>` when either exists, strip the remaining tags, decode
 * the handful of entities that actually turn up, and collapse whitespace.
 *
 * WHERE IT WILL BE WRONG:
 *
 * - **Anything rendered by JavaScript.** A React or Next.js page that ships an
 *   empty `<div id="root">` yields nothing. This is most product blogs.
 * - **Paywalls and consent walls.** Returns the wall, confidently, and the
 *   analyst then analyses the wall. The word-count guard below is the only
 *   defence and it is a weak one.
 * - **Pages with no `<article>` or `<main>`.** Falls back to the whole body,
 *   so navigation text, cookie notices and footer link farms end up in the
 *   source. The analyst sees them as part of the argument.
 * - **PDFs.** Not handled at all; the bytes are not HTML and the result is
 *   garbage. Download and convert first.
 * - **Anything needing cookies, a login, or a non-default user agent.**
 * - **Non-UTF-8 pages.** Decoded as UTF-8 regardless of what the server said,
 *   which mangles older Serbian pages in windows-1250.
 *
 * When the text looks wrong, save the page as Markdown and pass the file. That
 * path has none of these problems and is the one to prefer.
 */

import { readFileSync } from 'node:fs';

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtractionError';
  }
}

export interface Source {
  readonly text: string;
  readonly origin: string;
  /** How the text was obtained, printed in the brief so a bad read is visible. */
  readonly via: 'file' | 'url';
}

/**
 * Below this many words, a fetched page is much more likely to be a consent
 * wall or an empty JavaScript shell than an article. It is a guess and it is
 * the only thing standing between the analyst and a cookie banner.
 */
const MIN_FETCHED_WORDS = 120;

export async function loadSource(target: string): Promise<Source> {
  if (/^https?:\/\//iu.test(target)) return fetchSource(target);
  try {
    return { text: readFileSync(target, 'utf8'), origin: target, via: 'file' };
  } catch (cause) {
    throw new ExtractionError(`cannot read ${target} — ${(cause as Error).message}`);
  }
}

async function fetchSource(url: string): Promise<Source> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'voice-check/0.2' },
      redirect: 'follow',
    });
  } catch (cause) {
    throw new ExtractionError(`cannot fetch ${url} — ${(cause as Error).message}`);
  }

  if (!response.ok) {
    throw new ExtractionError(`cannot fetch ${url} — HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!/html|text/iu.test(contentType)) {
    throw new ExtractionError(
      `${url} is ${contentType || 'of unknown type'}, not HTML. This extractor ` +
        `handles HTML only — convert a PDF to text and pass the file instead.`,
    );
  }

  const text = extractReadableText(await response.text());
  const words = text.split(/\s+/u).filter(Boolean).length;
  if (words < MIN_FETCHED_WORDS) {
    throw new ExtractionError(
      `${url} yielded only ${words} words. That usually means a JavaScript-rendered ` +
        `page, a paywall, or a consent wall rather than a short article. Save the ` +
        `page as Markdown and pass the file.`,
    );
  }

  return { text, origin: url, via: 'url' };
}

/** Exported for testing: the whole extraction, with no network involved. */
export function extractReadableText(html: string): string {
  const withoutJunk = html
    .replace(/<!--[\s\S]*?-->/gu, ' ')
    .replace(/<(script|style|noscript|svg|form|nav|header|footer|aside)\b[\s\S]*?<\/\1>/giu, ' ');

  // Prefer the main article subtree when the page marks one. When it does not,
  // the fallback is the whole body and the boilerplate comes with it.
  const main =
    /<article\b[^>]*>([\s\S]*?)<\/article>/iu.exec(withoutJunk)?.[1] ??
    /<main\b[^>]*>([\s\S]*?)<\/main>/iu.exec(withoutJunk)?.[1] ??
    /<body\b[^>]*>([\s\S]*?)<\/body>/iu.exec(withoutJunk)?.[1] ??
    withoutJunk;

  // Block-level tags become paragraph breaks before the rest are stripped, so
  // the analyst sees sentence boundaries rather than one run-on line.
  return decodeEntities(
    main
      .replace(/<\/(p|div|li|h[1-6]|blockquote|tr|section)>/giu, '\n\n')
      .replace(/<br\s*\/?>/giu, '\n')
      .replace(/<[^>]+>/gu, ' '),
  )
    .replace(/[ \t]+/gu, ' ')
    .replace(/\n{3,}/gu, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/** The entities that actually turn up. Numeric references are handled generally. */
const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/giu, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/gu, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/giu, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole);
}
