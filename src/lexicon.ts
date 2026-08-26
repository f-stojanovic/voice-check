/**
 * Loading the phrase lists, and pinning which ones produced a score.
 *
 * THE POINT OF THIS FILE is the last two lines of {@link parseLexicon}: the
 * declared version and the content hash. Changing a lexicon changes every
 * score in the same direction at once — which is indistinguishable, in the
 * numbers, from the author's prose improving. That is the most expensive false
 * positive this tool can produce, because it looks exactly like the true
 * positive the tool exists to find. agent-evals hit the same problem one level
 * down, with model revisions, and answered it with a committed lockfile
 * (ADR 009). Here the answer is smaller: every report carries the identity of
 * the lexicon that produced it.
 *
 * TODO(day 3+): recording the identity is not yet enforcing it. Comparing two
 * reports whose `lexiconVersion` differs must be REFUSED, the way agent-evals
 * refuses a baseline recorded against a different model — not warned about,
 * refused. Until that exists the guarantee is "the evidence is on the record",
 * which is weaker than it looks, because nobody reads a string that looked the
 * same last week.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import type { Language, Lexicon, LexiconEntry } from './types.js';

/**
 * WHY Zod at this boundary rather than a cast: a YAML file is somebody typing.
 * A misspelt key silently becomes an empty phrase list, and an empty phrase
 * list scores every text a clean 1.0 — the failure mode where the tool reports
 * that everything is fine because it stopped looking.
 */
const EntrySchema = z.object({
  matches: z.string().min(1, 'matches must be a text this entry fires on'),
  /** Further examples. Required for a stemmed entry — see LexiconEntry. */
  alsoMatches: z.array(z.string().min(1)).default([]),
  doesNotMatch: z.string().min(1).optional(),
  except: z.array(z.string().min(1)).default([]),
});

const ExceptionSchema = z.object({
  phrase: z.string().min(1, 'phrase must be the literal text to suppress'),
  suppresses: z.string().min(1, 'suppresses must be a text this exception silences'),
});

const PhraseEntrySchema = EntrySchema.extend({
  phrase: z.string().min(1, 'phrase must be the literal text to look for'),
});

const PatternEntrySchema = EntrySchema.extend({
  pattern: z.string().min(1, 'pattern must be a regular expression source'),
});

const LexiconSchema = z.object({
  version: z.string().min(1, 'version must be a non-empty string, e.g. "0.1.0"'),
  language: z.enum(['sr', 'en']),
  phrases: z.record(z.string(), z.array(PhraseEntrySchema).min(1)).default({}),
  patterns: z.record(z.string(), z.array(PatternEntrySchema).min(1)).default({}),
  exceptions: z.record(z.string(), z.array(ExceptionSchema).min(1)).default({}),
});

/** Thrown with the file name and the exact path into the document. */
export class LexiconError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LexiconError';
  }
}

/**
 * Parses and validates lexicon source. Separate from the file read so a test
 * can hand it a malformed string without writing to disk.
 */
export function parseLexicon(source: string, origin: string): Lexicon {
  let raw: unknown;
  try {
    raw = parseYaml(source);
  } catch (cause) {
    throw new LexiconError(
      `${origin}: not valid YAML — ${(cause as Error).message}`,
    );
  }

  const parsed = LexiconSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
        return `  at ${path}: ${issue.message}`;
      })
      .join('\n');
    throw new LexiconError(`${origin}: does not match the lexicon schema\n${detail}`);
  }

  const data = parsed.data;

  // Compile every pattern now rather than at first use. A regex that only
  // fails on the one text that would have matched it is a rule that quietly
  // never fires, which reads as a clean score.
  for (const [rule, entries] of Object.entries(data.patterns)) {
    entries.forEach((entry, i) => {
      try {
        new RegExp(entry.pattern, 'giu');
      } catch (cause) {
        throw new LexiconError(
          `${origin}: patterns.${rule}[${i}] is not a valid regular expression — ` +
            `${(cause as Error).message}\n  source: ${entry.pattern}`,
        );
      }
    });
  }

  const entries: Record<string, LexiconEntry[]> = {};
  const push = (rule: string, entry: LexiconEntry): void => {
    (entries[rule] ??= []).push(entry);
  };
  for (const [rule, list] of Object.entries(data.phrases)) {
    for (const e of list) {
      push(rule, {
        source: e.phrase,
        kind: 'phrase',
        matches: [e.matches, ...e.alsoMatches],
        except: e.except,
        ...(e.doesNotMatch === undefined ? {} : { doesNotMatch: e.doesNotMatch }),
      });
    }
  }
  for (const [rule, list] of Object.entries(data.patterns)) {
    for (const e of list) {
      push(rule, {
        source: e.pattern,
        kind: 'pattern',
        matches: [e.matches, ...e.alsoMatches],
        except: e.except,
        ...(e.doesNotMatch === undefined ? {} : { doesNotMatch: e.doesNotMatch }),
      });
    }
  }

  return {
    language: data.language,
    version: data.version,
    contentHash: contentHash(data),
    entries,
    exceptions: data.exceptions,
  };
}

/**
 * SHA-256 over a canonical rendering of the lexicon's content.
 *
 * Canonical means key order cannot change the hash, so reordering the YAML for
 * readability does not read as a content change — while adding a single phrase
 * does. Array order IS significant and is preserved: a phrase list is
 * meaningfully a sequence, and pretending otherwise hides a real edit.
 */
function contentHash(data: {
  version: string;
  language: string;
  phrases: Record<string, readonly unknown[]>;
  patterns: Record<string, readonly unknown[]>;
  exceptions: Record<string, readonly unknown[]>;
}): string {
  const canonical = JSON.stringify({
    version: data.version,
    language: data.language,
    phrases: sortKeys(data.phrases),
    patterns: sortKeys(data.patterns),
    // Exceptions change what every score means exactly as much as phrases do.
    exceptions: sortKeys(data.exceptions),
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function sortKeys(
  record: Record<string, readonly unknown[]>,
): Array<[string, readonly unknown[]]> {
  return Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The string that goes into {@link import('./types.js').Report.lexiconVersion}. */
export function lexiconIdentity(lexicon: Lexicon): string {
  return `${lexicon.version}+${lexicon.contentHash.slice(0, 12)}`;
}

/** `lexicons/` sits beside `src/` and `dist/`, so one relative path serves both. */
export const DEFAULT_LEXICON_DIR = fileURLToPath(new URL('../lexicons/', import.meta.url));

export function loadLexicon(language: Language, dir: string = DEFAULT_LEXICON_DIR): Lexicon {
  const path = `${dir}${language}.yaml`;
  let source: string;
  try {
    source = readFileSync(path, 'utf8');
  } catch (cause) {
    throw new LexiconError(`cannot read lexicon for "${language}" at ${path} — ${(cause as Error).message}`);
  }
  const lexicon = parseLexicon(source, path);
  if (lexicon.language !== language) {
    throw new LexiconError(
      `${path}: declares language "${lexicon.language}" but was loaded as "${language}"`,
    );
  }
  return lexicon;
}
