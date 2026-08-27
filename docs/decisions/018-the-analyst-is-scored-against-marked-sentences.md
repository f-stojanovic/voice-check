# 018. The analyst is scored against sentences a human marked, deterministically

Date: 2026-08-27
Status: Accepted for the machinery, UNPROVEN ON REAL DATA. Every scorer, the
worksheet and the guards are built and tested; no source has been labelled and
no live run has happened, because the pilot source was never added to
`evals/analyst/sources/`. No baseline is written and none should be until the
remaining seven cases exist.
Evidence: THE SCORERS FAIL WHEN THEY SHOULD, which is the half worth proving —
          16 tests, each scorer shown at its maximum and then moved off it:
          `analyst-claim-locates` 1 → 0 when the claim quote moves to an
          unmarked sentence, and 0 with a reason naming traceability rather than
          a wrong sentence when the quote is translated.
          `analyst-evidence-recall` 1 → 0.5 when one evidence item is dropped,
          naming the missed sentence; 0 when the analyst offers none.
          `analyst-evidence-precision` 1 → 0.667 when the analyst pads with a
          quote from an unmarked sentence — the game recall alone cannot see.
          `analyst-hype-recall` 1 → 0 when the hype quote moves.
          THE POSITION MAPPING IS EXACT, 7 tests, each asserting the offsets by
          SLICING THE SOURCE rather than against a number written in the test: a
          quote crossing a hard line break, a case-folded match, a
          leading-whitespace source, and Serbian Latin with diacritics.
          THE INDEX GUARD FIRES: labelling against one split and checking
          against another throws, naming both strings.
          THE WORKSHEET IS BLANK, asserted on a source engineered to have an
          obvious claim, obvious evidence and obvious hype.
          446 tests, `npm run verify` exit 0.
          MEASURED, on real documents, for the labelling-cost question:
          `docs/decisions/013` splits into 139 sentences (2,902 words);
          `docs/decisions/007` into 50 (918 words);
          `sr-dns-explainer.md` into 82 (1,206 words);
          `sr-sleep-explainer.md` into 69 (962 words);
          `samples/ordinary-sr.md` into 34 (323 words).
          NOT MEASURED, and all of it waits on one labelled source: any real
          score, the live run's cost, the QuoteMatch distribution on real model
          output, whether the vocabulary fits a real source, and how long
          labelling actually takes as opposed to how long it looks like it will.

## Context

The analyst returns five fields, every statement carrying a quote. ADR 010 made
one property mechanically checkable — the quote is in the source — and that gate
ships. Everything else it produces is judgement.

The question this record answers is how to grade that judgement without a model
grading a model, which is what `agent-evals` ADR 021 forbids and what its judge
calibration (MAE 0.102 against Filip's labels) showed is not free.

## Decision

**A human marks SENTENCES OF THE SOURCE, not the model's answer.** Three marks:
`C` central claim, `E` load-bearing evidence, `H` hype the source does not
support. Blank is the fourth and commonest.

The direction matters more than the vocabulary. A judgement about an answer has
to be redone every time the model moves; a judgement about a source is made once
and every future model is graded against it. That is the whole reason labelling
is worth an afternoon at all.

**Four scorers, all deterministic**, comparing two sets of sentence indices:
what the human marked, and where the analyst's quotes landed. No model is
consulted, so a score moves only when the analyst moves.

**Precision ships with recall in the same commit.** Recall alone is gamed by
quoting every sentence; precision alone by quoting one safe sentence and
stopping. A baseline holding one of them holds a number that improves without
the analyst improving, and it sits in the file looking like evidence.

**Traceability is reported as a distribution, not folded into a score.** A
`foreign` quote is faithful and in the wrong language — the Serbian failure mode
`analyst.ts` documents. "Did not find it" and "found it and translated it" have
different fixes, so they get different lines, the way `agent-evals` keeps
`unpriced` apart from `uncomputable`.

**One matcher.** `verifyQuotes` was extended to report the position it already
computed. Nothing in the eval code compares a quote to a source.

## The hole, stated rather than filled

**A quote can land in exactly the right sentence while the `statement` attached
to it says something false about that sentence.** Nothing here notices. Every
scorer above measures WHERE the analyst looked, and none measures whether what
it said about what it found is true.

That is not a small gap. It is most of what a reader would call "was the
analysis any good", and the four numbers can all be 1.00 while the prose is
wrong.

The fix is a narrow per-item check — "does this `statement` restate this
`quote` faithfully, yes or no" — binary and anchored to a quote the human
already marked. That is a different shape from the holistic rubric that
calibrated at MAE 0.102 here, because it asks one bounded question about two
pieces of text rather than a global judgement about an analysis.

It is deferred because the pilot's question is whether the labelling workflow is
bearable, and adding a model call answers a question nobody has asked yet. It is
recorded so the four scores are never mistaken for a complete grade.

## Consequences

**No baseline, and that is a decision.** One case cannot support one. A baseline
is a claim that these numbers are the ones to defend, and a suite that freezes a
single observation gives the gate a number it cannot justify refusing changes
against.

**A source with no label file is skipped with a warning, not run.** It would
cost money and measure nothing — `agent-evals` ADR 005.

**A run that trips the traceability gate errors instead of being graded.**
`analyse()` throws on an absent or translated quote, correctly, and the analysis
is lost with it. Grading content and traceability separately would need the
analysis carried on the error. Not done here; recorded.

**The splitter will be wrong sometimes and that is the design.** It is a regex
and an abbreviation list, and it fails toward merging rather than splitting: an
over-long sentence is one mark applied to slightly too much text, while an
over-split one divides a claim across two rows and invites two marks for one
idea. Its mistakes appear as numbered lines a human reads before spending effort
on them. It handles Serbian ordinals (`27. avgusta`) by refusing to split, which
is the rule most likely to be wrong.

MEASURED WEAKNESS: on a markdown file with YAML front matter, the whole front
matter becomes one sentence, because it contains no terminator until the last
line. Harmless — it collects no marks — and visible, which is the property being
traded for.

**Labelling cost, estimated from the measured sentence counts and stated
plainly.** For a 900–1,200 word source at 50–80 sentences: about 5 minutes to
read it properly, then 5–10 to scan the numbered list and mark the six or ten
that need it. **Call it 10–15 minutes, at the top of the acceptable range.**

For a full ADR at 139 sentences it is 20–30 minutes, which is over the line.
The recommendation is to keep pilot sources near 60–80 sentences — roughly 1,000
words — and excerpt anything longer, which is what the plan already says for the
public half of the corpus.

An earlier design pushed this well past 30 minutes by telling the labeller to
DELETE every unmarked entry: about 130 four-line blocks on a 139-sentence
source. Blank entries are now kept and ignored, which removed that step and
incidentally strengthened the integrity check to cover unmarked sentences too.

## Alternatives rejected

**Score the analyst's output directly with a rubric.** It is what a judge does,
it is what calibrated at MAE 0.102 here, and it makes every score a function of
the grader as well as the subject.

**Label spans rather than sentences.** More precise, and materially more work
per source — the labeller would be selecting character ranges rather than
ticking a line. Sentence granularity is a bet that a claim usually occupies one
sentence, and it is the assumption most likely to be wrong on a source that
builds an argument across a paragraph. Revisit when a real worksheet shows it
failing rather than now.

**Have the model propose marks for a human to approve.** Cheaper per source and
it makes the labels a function of the model, which is the circle ADR 021 draws
wider rather than breaks. Approving a suggestion is also not the same cognitive
act as making a judgement, and the difference does not show up in the file.
