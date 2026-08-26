import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALL_RULES, rulesFor } from './index.js';
import { pad, runRule } from './rules.test-kit.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));

/** Files in this directory that are not rules. */
const NOT_RULES = new Set(['index.ts', 'helpers.ts', 'rules.test-kit.ts']);

describe('the rule registry', () => {
  it('registers every rule file', () => {
    // A rule that is written but not registered never runs, and nothing else
    // would notice: the report would simply be one rule shorter.
    const files = readdirSync(HERE)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !NOT_RULES.has(f))
      .map((f) => f.replace(/\.ts$/, ''))
      .sort();
    expect([...ALL_RULES].map((r) => r.name).sort()).toEqual(files);
  });

  it('gives every rule a unique name', () => {
    const names = ALL_RULES.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('declares at least one language per rule', () => {
    for (const rule of ALL_RULES) expect(rule.languages.length).toBeGreaterThan(0);
  });

  it('omits a rule that does not apply rather than passing it', () => {
    expect(rulesFor('en').map((r) => r.name)).not.toContain('diacritics');
    expect(rulesFor('sr').map((r) => r.name)).not.toContain('participial-close');
  });

  it('abstains or scores finitely on an empty text — never NaN', () => {
    // A NaN passes every naive range guard and poisons every mean it reaches.
    // On an empty text every density rule should abstain; if one ever scores,
    // the score still has to be a real number in range.
    for (const language of ['sr', 'en'] as const) {
      for (const rule of rulesFor(language)) {
        const result = runRule(rule, '', language);
        if (result.outcome === 'abstained') continue;
        expect(Number.isFinite(result.score), `${rule.name} on empty text`).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      }
    }
  });

  it('abstains rather than scoring every density rule on an empty text', () => {
    for (const language of ['sr', 'en'] as const) {
      for (const rule of rulesFor(language).filter((r) => r.kind === 'density')) {
        expect(runRule(rule, '', language).outcome, rule.name).toBe('abstained');
      }
    }
  });

  it('keeps every finding inside the text it was found in', () => {
    const text = pad(
      ['# Naslov', '', 'Stručnjaci kažu da je ovo — neverovatno.', '', '- **Ključ:** Radi.'].join(
        '\n',
      ),
      'sr',
    );
    for (const rule of rulesFor('sr')) {
      for (const finding of runRule(rule, text, 'sr').findings) {
        expect(text.slice(finding.offset, finding.offset + finding.text.length)).toBe(finding.text);
      }
    }
  });
});
