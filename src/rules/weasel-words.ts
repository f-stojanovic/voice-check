/**
 * "stručnjaci kažu", "experts say", "reports suggest".
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
