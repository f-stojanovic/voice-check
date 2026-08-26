/**
 * "važno je napomenuti", "it's important to note", "in this article we".
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
