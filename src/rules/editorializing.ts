/**
 * "važno je napomenuti", "it's important to note", "in this article we".
 *
 * MEASURED, 2026-08-26, AND IT DID NOT HOLD. Across 15 machine-written English
 * blog posts (18,612 words, `claude-opus-5`, no style instruction) this rule
 * fired not once — min, median and max all 0.00. The claim that it
 * identifies generated prose is withdrawn
 * for this model — see ADR 014. It stays because the style guide's FIRST half
 * still objects to the construction whoever wrote it: this rule checks a
 * voice, not an author.
 *
 * The narrator stepping out from behind the prose to tell you how to feel
 * about the next sentence. If the point is important, its importance shows in
 * how it is written; announcing it is the writer marking their own homework.
 * "In this article we will explore" is the same move aimed at structure —
 * describing the text instead of being it.
 */

import { lexiconRule } from './helpers.js';

export const editorializing = lexiconRule({
  name: 'editorializing',
  languages: ['sr', 'en'],
});
