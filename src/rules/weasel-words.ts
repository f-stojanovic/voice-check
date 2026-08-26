/**
 * "stručnjaci kažu", "experts say", "reports suggest".
 *
 * MEASURED, 2026-08-26, AND IT DID NOT HOLD. Across 15 machine-written English
 * blog posts (18,612 words, `claude-opus-5`, no style instruction) this rule
 * fired not once — min, median and max all 0.00. The claim that it
 * identifies generated prose is withdrawn
 * for this model — see ADR 014. It stays because the style guide's FIRST half
 * still objects to the construction whoever wrote it: this rule checks a
 * voice, not an author.
 *
 * An attribution that attributes nothing. The sentence gains the authority of
 * a source and the writer takes on none of the obligation of naming one, which
 * is why it survives editing: it reads as sourced. The fix is always the same
 * and always specific — name the expert, cite the report, or drop the claim.
 *
 * This fires on legitimate usage. "Izveštaji pokazuju" is a correct thing to
 * write in a sentence that then cites the reports. Today the rule counts it
 * anyway; see the false-positive report in the README, which is the input to
 * whatever suppression eventually exists.
 */

import { lexiconRule } from './helpers.js';

export const weaselWords = lexiconRule({
  name: 'weasel-words',
  languages: ['sr', 'en'],
});
