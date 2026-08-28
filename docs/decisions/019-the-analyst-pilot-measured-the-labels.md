# 019. The analyst pilot measured the labels at least as much as the analyst

Date: 2026-08-28
Status: Accepted as a record of what the pilot found, and as a REVERSAL: the
±1 window this record originally defended was removed the same day it was
adopted (see "The window"). **No baseline is adopted, and none should be** until
the vocabulary has survived a source it was not rewritten for. The machinery
ships; the numbers do not. The remaining seven sources are deferred — see
`docs/issues/001-the-remaining-analyst-sources.md`.
Evidence: THREE LABELLING PASSES OVER ONE SOURCE — a 101-sentence Serbian
          article — against ONE recorded fixture. No model call after the first:
          every score below is a replay.

            pass  marks              claim  ev-prec  ev-recall  hype   mean
            1     C 8 · E 8 · H 9    0.00   0.20     0.13       0.44   0.192
            2     C 1 · E 7 · H 9    0.00   0.00     0.00       0.44   0.111
            3     C 1 · E 1 · H 9    1.00   0.20     1.00       0.44   0.661
            4     C 1 · E 1 · H 9    0.00   0.20     1.00       0.44   0.411

          Rows 3 and 4 are THE SAME LABELS AND THE SAME FIXTURE. The only
          difference is that row 3 was scored with a ±1 sentence window on
          `claim-locates` and row 4 without it, after the window was reverted.
          A quarter of the mean was a constant.

          THE ANALYST DID NOT CHANGE ACROSS ANY OF IT. Same twenty quotes, same
          five evidence items, same sentences. The mean moved 0.192 → 0.111 →
          0.661 because the labels moved, and once because a scorer was
          loosened (below).
          PASS 2 IS THE FINDING. Sharpening `E` made the score WORSE, to zero
          overlap: the model located the statistics, the labels located the
          descriptions. A vocabulary that gets further from the subject as it
          gets more precise is measuring something other than the subject.
          `hype-recall` HELD AT 0.44 ACROSS ALL FOUR. It is the only mark that
          asks about the text rather than about the reader's relationship to the
          text, and it is the only number that stayed still. THE HONEST CAVEAT:
          that is also exactly what it would look like if `H` had simply never
          been edited, which it was not — the H set is identical in every pass.
          Stability under no change is not evidence of stability.
          QUOTE TRACEABILITY, all three passes: exact 20, normalized 0,
          foreign 0, absent 0. Every quote byte-exact against a Serbian source.
          C DENSITY, pass 3: 1/101 = 1.0%.
          COST: $0.1018 for the single live run, on 8,280 in / 2,417 out. This
          pass spent $0.00.
          NOT MEASURED: any second source. Every conclusion here is drawn from
          one article, and the vocabulary was edited in response to it, so the
          next source is the first real test rather than the second data point.

## Context

The pilot asked one question: is the labelling workflow bearable? It answered a
different and more useful one.

Three passes over one source produced three different scores from an unchanged
analyst. That is not noise around a measurement — it is the measurement moving
because the ruler moved.

## What the vocabulary got wrong

`E` was defined as *"load-bearing evidence — an analyst that misses this has
failed"*. That asks the labeller what actually SUPPORTS the claim, which is a
judgement about argument quality.

The schema asks something else. `evidence` is *"What the source offers in
support"* — an offer, not a verdict on the offer.

Two different questions, and the marks and the model answered one each. The
model listed the statistics the article puts forward; the labeller marked the
passages that genuinely bear weight. Both are defensible readings and they
barely intersect, which is why sharpening the definition drove the overlap to
zero rather than up.

`E` is now mechanical:

> `E` — the sentence offers something measurable: a figure, a named source, a
> comparison, or a described observation. Not whether it holds up. Whether it
> holds up is `H`.

The quality question did not disappear; it moved to `H`, which was always asking
it. `[E, H]` — offers a figure, and the figure does not support what it is used
for — is now a documented pair with a worked example.

**The example in the worksheet is invented.** An example drawn from a text
somebody is about to label tells them how to label it.

## The window: adopted, defended, and reverted

`analyst-claim-locates` briefly accepted a quote landing within **±1 sentence**
of a marked `C`. The model quoted sentence 2; the label marked sentence 3.

**IT WAS ADOPTED AFTER WATCHING THE SCORER RETURN 0.00.** The justification was
about prose: a thesis is commonly stated in one sentence and completed in the
next, so which of the two a labeller marks is close to arbitrary, and an exact
rule measures that arbitrariness as much as it measures the analyst.

**IT WAS REVERTED, AND THE ARGUMENT AGAINST IT IS BETTER.** The prose claim does
not pick 1. "A thesis spans a sentence or two" argues just as well for 2, and
the only thing that actually fixed the value was that the observed gap was 1. A
justification that cannot derive its own constant is a rationalisation of a
number chosen from the data.

The arithmetic makes it plain. Rows 3 and 4 above are the same labels, the same
fixture, the same twenty quotes: 0.661 with the window, 0.411 without. **A
quarter of the mean was the constant**, on a suite whose purpose is to notice
when the analyst moves.

WHERE THE BOUNDARY ACTUALLY BELONGS: with the person reading. Where a thesis
genuinely spans sentences, the labeller marks every sentence that carries it,
and the worksheet header now says so. That puts the judgement in the hands of
someone who has read the article, instead of in a constant that has not.

This is the second reversal on the record here, and the pattern in both is the
same: a number was adjusted to fit an observation, the adjustment was written
down, and writing it down is what made it reviewable. A decision that was right
first time teaches nobody anything.

`C` density is reported per case — pass 4 is 1/101, 1.0% — so a case whose
target is unusually wide is visible next to the score rather than discovered
later.

## Why no baseline

One source. Three labelling passes. A vocabulary rewritten underneath them. A
scorer loosened after seeing it fail.

Freezing 0.661 would hand the gate a number that nothing can defend: every
future run would be compared against a figure produced by a definition that no
longer exists and a rule adopted to fix the case it was measured on.

This repository has the precedent and it points the same way. `agent-evals`
calibrated its semantic scorer against ten labelled pairs, got a margin of
−0.392 with eight of ten pairs overlapping, and **adopted no threshold** — the
constant is still declared a guess and the report still prints it as one. Same
call here, same reason: a measurement that failed to separate is not a number
you build a gate from.

What would change this: the vocabulary applied to a source it was not rewritten
for, by the same labeller, producing scores that do not need another edit.

Stated as plainly as it can be: **the vocabulary was not stable enough to
measure with, and one source cannot say whether it is stable now, because it was
rewritten to fit that source.** Four passes over one article moved the mean
0.192 → 0.111 → 0.661 → 0.411 without the analyst changing once.

## Consequences

**The marks are the expensive artifact and they are now tracked.** `evals/analyst/`
— source, labels, fixture — was untracked until this commit. The labels
represent three passes of human reading and were the only thing in the
repository that could not be regenerated.

**Two report lines were lying and are fixed; both are the ADR 026 family.** The
replay printed `cost: $0.1018` for a run that made no request — true of the
recording, false of the run printing it. And it printed *"live subject:
responses came from the model, not from replayed data"* on a replay. Both are a
number or a claim that is real in one frame, printed in another, with nothing
marking the change of frame. The report now states this run's spend and the
recording's separately, and passes the fixture provenance through.

**A prediction in `analyst.ts` has one observation against it.** The comment
said a translated quote is *"on a Serbian source the likeliest failure of the
four"*. One Serbian source has now been run: 20 quotes, `foreign 0`. That
retracts nothing and it stops the sentence being stated as established. If
`foreign` stays at zero across the remaining cases, that arm is machinery
guarding something that does not happen.

**The judge is still absent and the hole is now visibly larger.** Every scorer
here measures WHERE a quote landed. Passes 3 and 4 score `evidence-recall` at
1.00 off a single marked sentence — one hit out of one. That number is
**arithmetically true and evidentially worthless, and it flatters the run**: it
says nothing whatever about whether the analyst understood the article, and it
is the largest contributor to a mean anyone might mistake for a result. A per-item check of whether a
`statement` restates its `quote` faithfully is the missing half, and one source
is not the place to add a model call.

## Alternatives rejected

**Adopt 0.661 as the baseline and move on.** It is the number the suite
currently produces and it is the least defensible thing in the pass.

**Drop `C` and `E` and keep only `H`.** Tempting on the evidence — `H` is the
only mark that held still — and too early. One source cannot establish that two
marks are unusable; it establishes that they were badly defined, which has been
fixed rather than tested.

**Have the labeller redo passes 1 and 2 under the new definition.** It would
make the three rows comparable and it would also be relabelling to a number
already seen, which is the same defect as tuning the window and worse for being
applied to the labels themselves.
