/**
 * The committed negative corpus has to stay labelled.
 *
 * ADR 012's claim is that the provenance IS the label — nobody judges whether
 * a text belongs in the negative corpus, because the frontmatter says a
 * machine wrote it. That claim is only true while every file carries it. A
 * file dropped into this directory by hand would be an unlabelled sample
 * silently counted as machine-written, which reintroduces exactly the human
 * judgement the design avoids needing.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { readCorpus } from '../calibrate-report.js';
import { SUBJECTS } from './subjects.js';

const ROOT = fileURLToPath(new URL('../../corpus/generated/', import.meta.url));

describe('the committed negative corpus', () => {
  it('exists — a ceiling nobody can re-derive is a ceiling nobody can check', () => {
    expect(existsSync(ROOT), `${ROOT} is missing`).toBe(true);
  });

  const docs = existsSync(ROOT) ? readCorpus(ROOT) : [];

  it('has enough documents to say anything', () => {
    // agent-evals ADR 018: a check must prove it inspected something.
    expect(docs.length).toBeGreaterThanOrEqual(20);
  });

  it('labels every file as generated, in its own frontmatter', () => {
    for (const doc of docs) {
      expect(doc.provenance, `${doc.name} is not labelled`).toBe('generated');
    }
  });

  it('records the model, the date and the exact prompt for every file', () => {
    for (const language of ['sr', 'en'] as const) {
      const dir = join(ROOT, language);
      if (!existsSync(dir)) continue;
      for (const name of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
        const raw = readFileSync(join(dir, name), 'utf8');
        const meta = parseYaml(/^---\n([\s\S]*?)\n---/u.exec(raw)?.[1] ?? '') as Record<
          string,
          unknown
        >;
        expect(meta['model'], name).toBeTypeOf('string');
        expect(meta['generated'], name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        // The prompt has to be one of the declared subjects, so a file cannot
        // claim a provenance it did not have.
        const prompts = SUBJECTS.map((subject) => subject.prompt[language]);
        expect(prompts, `${name} carries a prompt no subject declares`).toContain(meta['prompt']);
      }
    }
  });

  it('is long enough per document for every rule to measure it', () => {
    // Not designed for — the prompts specify no length — and the reason the
    // ceilings are measurable at all. The tightest gate is 334 words.
    for (const doc of docs) {
      expect(doc.words, `${doc.name} is only ${doc.words} words`).toBeGreaterThan(334);
    }
  });
});
