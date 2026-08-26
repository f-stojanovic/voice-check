/**
 * Lines shaped `- **Word:** the sentence that follows`.
 *
 * RENAMED from `bullet-bold-restate` on day two. The rule name appears in
 * every report, and the old one claimed a check the code does not perform:
 * nothing here decides whether the sentence restates the bolded word. A name
 * is the most-read part of a rule, and a name that overstates is a lie with
 * better distribution than any comment.
 *
 * The guide's complaint is not the shape. It is that the sentence after the
 * colon frequently restates the bolded word and adds nothing: "**Scalability:**
 * The system is designed to scale." A list of those is a table of contents
 * wearing the costume of an argument.
 *
 * WHAT THIS RULE ACTUALLY DOES TODAY: it detects the SHAPE. It does not — and
 * cannot, with a regular expression — decide whether the sentence restates the
 * bold word. That judgement needs a model reading both halves and answering a
 * narrow question, which is a later day of this project and will need its own
 * calibration against labelled examples before its output is trusted.
 *
 * So the number this rule reports is an upper bound on the real defect, and
 * the report says "shape" rather than "restatement" for that reason. A writer
 * who uses the shape well will score badly here, and that is a known
 * incompleteness rather than a finding. It is recorded as a density rather
 * than left out entirely because the shape's frequency is itself weak evidence,
 * and a rule that ships as a stub with an honest name is more useful than one
 * that ships as nothing.
 */

import { densityResult } from './helpers.js';
import { perThousand } from '../scoring.js';
import { findMatches } from '../text.js';
import { guess } from '../uncalibrated.js';
import type { Rule, RuleContext, RuleResult } from '../types.js';

const FLOOR = guess(
  'bullet-bold-shape.floor',
  2.0,
  'shaped bullets per 1000 words scored clean; higher than the phrase default ' +
    'because this rule detects a shape and not the defect, so it should be ' +
    'slow to accuse — a judgement, not a measurement',
);

const CEILING = guess(
  'bullet-bold-shape.ceiling',
  20.0,
  'shaped bullets per 1000 words scoring 0; will need revisiting once a judge ' +
    'can tell a restating bullet from a working one',
);

/**
 * `-`, `*` or `+`, then a bolded run, then an optional colon inside or outside
 * the bold, then something else on the line. The trailing content is required:
 * `- **Term**` alone is a definition list entry, not the pattern.
 */
const SHAPE = /^[ \t]*[-*+][ \t]+(?<hit>\*\*[^*\n]+\*\*:?)[ \t]*\S/gmu;

export const bulletBoldShape: Rule = {
  name: 'bullet-bold-shape',
  kind: 'density',
  languages: ['sr', 'en'],
  uncalibrated: [FLOOR, CEILING],
  check(text: string, ctx: RuleContext): RuleResult {
    const findings = findMatches(text, SHAPE);
    return densityResult({
      ctx,
      rule: 'bullet-bold-shape',
      findings,
      density: perThousand(findings.length, ctx.wordCount),
      floor: FLOOR,
      ceiling: CEILING,
      unit: 'shaped bullets per 1000 words (shape only — restatement is not checked)',
    });
  },
};
