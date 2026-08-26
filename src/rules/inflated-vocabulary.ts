/**
 * "zaroniti", "delve", "landscape", "leverage", "robust", "tapestry".
 *
 * MEASURED, 2026-08-26, AND IT DID NOT HOLD. Across 15 machine-written English
 * blog posts (18,612 words, `claude-opus-5`, no style instruction) this rule
 * fired twice in 18,612 words, both `leverage`; `delve`, `synergy`, `robust`,
 * `seamless` and `tapestry` appeared zero times. The claim that it
 * identifies generated prose is withdrawn
 * for this model — see ADR 014. It stays because the style guide's FIRST half
 * still objects to the construction whoever wrote it: this rule checks a
 * voice, not an author.
 *
 * The long word standing where a short one would have done. Each entry has a
 * plain equivalent that costs nothing to substitute, and the reason a model
 * prefers the long one is that the long one is over-represented in the kind of
 * text that gets written to sound authoritative.
 *
 * THIS IS THE NOISIEST RULE IN THE SET and the lexicon comment says so.
 * `ključ*` catches `ključna reč` — "keyword" — which is not inflated
 * vocabulary, it is the only word for the thing. `landscape` is a tell in "the
 * evolving landscape of AI" and an ordinary noun in a sentence about
 * photography. No suppression exists today, on purpose: inventing a
 * suppression syntax before seeing which suppressions are actually needed
 * would be guessing at the shape of a problem that has not been measured.
 * The README reports what fires on ordinary prose; that list is the input.
 */

import { lexiconRule } from './helpers.js';

export const inflatedVocabulary = lexiconRule({
  name: 'inflated-vocabulary',
  languages: ['sr', 'en'],
});
