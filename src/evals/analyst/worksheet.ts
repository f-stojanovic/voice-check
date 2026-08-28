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
#   C  carries the source's central claim. IF THE THESIS SPANS SENTENCES, MARK
#      EVERY SENTENCE THAT CARRIES IT — do not pick the best one. The scorer is
#      strict: a quote either lands in a marked sentence or it does not, and
#      where the boundary falls is your judgement rather than a constant's.
#      A +/-1 sentence window was tried in the scorer and reverted; ADR 019 says
#      why.
#   E  the sentence OFFERS something measurable: a figure, a named source, a
#      comparison, or a described observation. Not whether it holds up.
#      Whether it holds up is H.
#   H  hype: an assertion the source does not support
#
# WHY E IS MECHANICAL. The schema asks what the source "offers in support", and
# whether an offer is any good is a separate question that H already carries.
# The first version of this header asked, in effect, what actually SUPPORTS the
# claim — a judgement — and the two questions pulled the marks apart from what
# the analyst returns. E is now a property of the sentence, not of your opinion
# of it.
#
# A sentence may take more than one mark, and [E, H] is the important pair: a
# sentence that offers a figure AND does not support what it is used for.
#
#     "Naša platforma smanjuje vreme odgovora za 90%."
#     ("Our platform reduces response time by 90%.")
#
#     E, because it offers a figure. H, because the figure has no source and
#     the sentence is the vendor's own claim about itself. Both marks, one
#     sentence, and they are not in conflict — they answer different questions.
#
# That example is invented. It is not from any source in this corpus, and it is
# not from the one you are about to label: an example lifted from a text
# somebody is about to mark tells them how to mark it.
#
# MOST SENTENCES GET NOTHING. Leave those exactly as they are — do not delete
# them. Every sentence stays in the file so the integrity check can verify all
# of them, not just the ones you marked.
#
# If you find yourself marking most of the list, the vocabulary is wrong for
# this source and that is worth saying rather than working around.
#
# E is the one to be mechanical about. Ask "does this sentence put something
# checkable on the table?" — not "is this a good reason to believe the claim?".
# If you find yourself weighing whether the evidence is persuasive, that is H's
# question and you have drifted.
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
