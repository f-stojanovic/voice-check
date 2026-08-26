/**
 * "neverovatno", "spektakularno", "breathtaking", "must-try".
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
