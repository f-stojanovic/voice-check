/**
 * "sve u svemu", "u zaključku", "in conclusion", "to summarize".
 *
 * MEASURED, 2026-08-26, AND IT DID NOT HOLD. Across 15 machine-written English
 * blog posts (18,612 words, `claude-opus-5`, no style instruction) this rule
 * fired not once — min, median and max all 0.00. The claim that it
 * identifies generated prose is withdrawn
 * for this model — see ADR 014. It stays because the style guide's FIRST half
 * still objects to the construction whoever wrote it: this rule checks a
 * voice, not an author.
 *
 * The closing paragraph that restates the piece to a reader who has just
 * finished reading it. It exists because an essay format demands a conclusion,
 * not because the text has one, and the giveaway is that deleting it removes
 * no information.
 *
 * Scored by density rather than as a hard rule even though one is usually one
 * too many, because a long piece may legitimately summarise a section — and a
 * hard failure here would be the rule overruling the writer on a judgement
 * call, which is not what a hard rule is for.
 */

import { lexiconRule } from './helpers.js';

export const summaryClose = lexiconRule({
  name: 'summary-close',
  languages: ['sr', 'en'],
});
