/**
 * "neverovatno", "spektakularno", "breathtaking", "must-try".
 *
 * MEASURED, 2026-08-26, AND IT DID NOT HOLD. Across 15 machine-written English
 * blog posts (18,612 words, `claude-opus-5`, no style instruction) this rule
 * fired not once — min, median and max all 0.00. The claim that it
 * identifies generated prose is withdrawn
 * for this model — see ADR 014. It stays because the style guide's FIRST half
 * still objects to the construction whoever wrote it: this rule checks a
 * voice, not an author.
 *
 * Adjectives that do the reader's reacting for them. The guide's objection is
 * not that enthusiasm is forbidden — it is that these particular words carry
 * no information: nothing about a system is learned from being told it is
 * stunning. They are the register of a brochure, and they arrive in generated
 * prose because a model asked to be engaging has no other lever to pull.
 */

import { lexiconRule } from './helpers.js';

export const promotionalTone = lexiconRule({
  name: 'promotional-tone',
  languages: ['sr', 'en'],
});
