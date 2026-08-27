/**
 * The worksheet: a numbered list of the source's sentences, every mark blank.
 *
 * WHAT THIS FILE IS ALLOWED TO AUTHOR
 * -----------------------------------
 * The sentence split, and nothing else. Every `marks:` it emits is empty.
 *
 * That is not a stylistic choice, it is ADR 021 in `agent-evals` and it is the
 * rule the whole suite rests on: the labels are what the analyst is measured
 * against, so a label written by a model makes the central measurement a model
 * grading a model. There is no version of that which is worth the time it saves.
 *
 * `emitWorksheet` is therefore written so that it CANNOT put a mark in: it has
 * no access to the analysis, no model client, and no argument that could carry
 * a suggestion. `worksheet.test.ts` asserts the output contains no mark, on a
 * source engineered to look like it has an obvious central claim.
 *
 * WHY YAML AND WHY THE MARKS ARE ON THE SENTENCE LINE
 * --------------------------------------------------
 * The file the human edits is the file the scorers read. An intermediate format
 * — fill in a text file, run a converter — is a step that can be skipped, done
 * wrong, or forgotten, and it puts a program between the labeller and the
 * record of what they meant.
 *
 * The cost is that YAML has opinions about strings, so every sentence is emitted
 * as a double-quoted JSON scalar. That is uglier to read than a bare string and
 * it is unambiguous, which matters more for a file whose whole job is to still
 * mean the same thing in six months.
 */

import type { Sentence } from './sentences.js';

export interface WorksheetOptions {
  readonly sourceName: string;
  readonly language: 'sr' | 'en';
  readonly sentences: readonly Sentence[];
}

/**
 * The instructions at the top of every worksheet.
 *
 * Repeated in the file rather than kept in a README, because the file is what
 * the labeller has open, and a vocabulary they have to go and look up is one
 * they will approximate from memory.
 */
const HEADER = `# Analyst eval — labelling worksheet
#
# Mark the SOURCE, not the model's answer. These marks say what the source
# contains; they are compared against what the analyst found. Label a source
# once and every future model is graded against the same answer.
#
# THE VOCABULARY
#
#   C  carries the source's central claim
#   E  load-bearing evidence — an analyst that misses this has failed
#   H  hype: an assertion the source does not support
#
# A sentence may take more than one mark: [C, H] is a real combination.
#
# MOST SENTENCES GET NOTHING. Leave those exactly as they are — do not delete
# them. Every sentence stays in the file so the integrity check can verify all
# of them, not just the ones you marked.
#
# If you find yourself marking most of the list, the vocabulary is wrong for
# this source and that is worth saying rather than working around.
#
# E is the one to be strict about. It means the analyst has FAILED if it misses
# this, not that the sentence is somewhere in the vicinity of evidence.
#
# HOW TO FILL IT IN
#
#   1. Set labelledBy and labelledAt.
#   2. For each sentence that needs a mark, put it in that entry's marks list:
#        marks: [E]
#   3. Leave everything else alone. Blank entries are expected and ignored.
#   4. Do not renumber, reword, or reformat the 'text' fields. They are checked
#      against the splitter's output, and that check is what stops a splitter
#      change from silently repointing your marks at different sentences.
#
# A blank worksheet is refused by the loader rather than scored as "nothing
# marked" — otherwise an unlabelled source and a genuinely unremarkable one
# would produce the same numbers.
`;

/**
 * Renders the worksheet. Deterministic, and blank by construction.
 *
 * Takes sentences rather than a source string: the split is done once, by the
 * caller, and the same array is what the scorers will use. Splitting twice
 * would be two chances to split differently.
 */
export function emitWorksheet(options: WorksheetOptions): string {
  const { sourceName, language, sentences } = options;

  const lines: string[] = [
    HEADER,
    `source: ${JSON.stringify(sourceName)}`,
    `language: ${JSON.stringify(language)}`,
    `labelledBy: ""      # REQUIRED — your name. A label with nobody behind it is not a label.`,
    `labelledAt: ""      # REQUIRED — the date you did it, YYYY-MM-DD.`,
    '',
    `# ${sentences.length} sentences.`,
    'entries:',
  ];

  for (const sentence of sentences) {
    lines.push(
      `  - index: ${sentence.index}`,
      `    text: ${JSON.stringify(sentence.text)}`,
      `    marks: []`,
      '',
    );
  }

  return lines.join('\n');
}
