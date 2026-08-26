/**
 * "sve u svemu", "u zaključku", "in conclusion", "to summarize".
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
