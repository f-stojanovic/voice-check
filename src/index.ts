/** The public surface. Everything else is an implementation detail. */

export type {
  Finding,
  Language,
  Lexicon,
  Report,
  Rule,
  RuleContext,
  RuleKind,
  RuleResult,
  UncalibratedConstant,
} from './types.js';

export { check, formatMarkdown } from './report.js';
export type { CheckOptions, CheckOutcome } from './report.js';
export { detectLanguage } from './detect.js';
export type { Detection } from './detect.js';
export { loadLexicon, parseLexicon, lexiconIdentity, LexiconError } from './lexicon.js';
export { ALL_RULES, rulesFor } from './rules/index.js';
