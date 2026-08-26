# 011. Calibration recommends; a human moves the constant

Date: 2026-08-28
Status: Accepted. The command exists and has been run; no constant has moved.
Evidence: Direct, and the first run is the argument. Run against the author's
          own `scratch/` on 2026-08-28: two documents, 397 words total, one
          Serbian at 139 words and one English at 258. Every phrase rule
          abstained on both — the Serbian document is below the 167-word gate
          for a ceiling of 6, and both are below the 334-word gate for
          `negative-parallelism`. The report's headline is that the corpus is
          too small to calibrate anything, and the only rules producing a
          number at all produced one number each.
          So: **no constant moved, and the report says why in its first
          paragraph.** That is the mechanism working. A tool that had written
          a floor from an n of 1 would have produced a calibrated-looking
          number from a single document.
          Unobserved: everything the command exists for. No corpus of ten or
          more accepted drafts has been assembled, so no percentile has ever
          been computed from enough data to mean anything.

## Context

Twenty-one constants in this repository are declared as guesses, and the notes
attached to nearly all of them say the same thing: this would be justified by
measuring the author's own accepted drafts, a corpus that does not exist.

That sentence has been in the code since day one. Writing it is honest;
leaving it there indefinitely is not, because a declared guess that never
becomes anything is still a guess — the registry counts assumptions, it does
not retire them.

## Decision

`npm run calibrate -- <dir>` reads a directory of texts the author considers
good and reports, per rule and per language: the number of documents that
produced a density, the min, median, 90th percentile and max of those
densities, and the floor that distribution would imply.

**It recommends. It does not write.** Nothing in the command edits a constant,
and that is the decision rather than an unfinished feature.

A tool that tunes its own thresholds against a corpus it also scores is
measuring nothing. Set every floor to the p90 of the author's drafts and the
tool now reports that the author's drafts are excellent — which is true by
construction and carries no information. The number is only worth something if
a person looked at it and decided. agent-evals reached the same place from the
other direction: only a human may assign a calibration label (its ADR 021),
because a model grading itself produces a figure that measures the grading.

**A ceiling is not derivable from this corpus and none is offered.** A floor
answers "how much of this appears in writing you accept", which a corpus of
accepted writing contains. A ceiling answers "how much appears in writing that
has gone wrong", which it does not contain at all. Extrapolating one from the
maximum would produce a number that looks measured. The report says `not
derivable` in every ceiling cell and explains that calibrating ceilings needs
a second, negative corpus.

**Every figure carries its own n.** Below `calibrate.min-docs` (10, itself
declared as a guess) no percentile is reported at all — the cell reads `n=1,
too few` rather than a number. A 90th percentile of four values is the largest
of the four wearing a statistical hat, and it is indistinguishable in a table
from a percentile of four hundred.

**Abstentions are exclusions, not zeroes.** A document too short for a rule
contributes no density rather than a 0. A zero is a measurement — "this text
contains no weasel words" — and a short text supports no such claim; averaging
it in would drag every floor toward zero in proportion to how many short texts
the corpus happens to contain.

## Consequences

The path from "this is a guess" to "this is measured" now exists and is one
command. What is missing is the corpus, which is the honest bottleneck and was
always the bottleneck.

The floors are calibratable and the ceilings are not, which splits the
registry into two kinds of guess. Roughly half the constants can be settled by
assembling accepted drafts; the other half need a labelled set of texts the
author considers machine-written, which is a harder ask because it means
labelling.

The command found a defect in its own first implementation, which is worth
recording. It recovered each rule's abstention gate by string-matching the id
of the rule's ceiling constant, looking for a suffix of `.ceiling` — and the
shared phrase ceiling is `density.phrase-ceiling`, which ends in `-ceiling`.
The match failed, the fallback was 0, and six rules reported "no data" with no
exclusion listed to explain it. Two implementations of one gate is one too
many; the report now asks the rule for its own verdict.

The costs:

**Nothing enforces that the report was read.** A constant can still be changed
by editing the file, with or without a calibration run behind it, and the
registry note will keep claiming it is a guess until somebody rewrites it.
There is no `calibrated.json` recording which figure justified which value,
and there probably should be.

**`calibrate.min-docs = 10` is itself uncalibrated**, which is not as circular
as it sounds — it is a guess about when a percentile stabilises, answerable by
resampling any corpus — but it does mean the report's own threshold for
"enough data" is a number nobody measured.

## Alternatives rejected

**Write the constants directly, behind a `--apply` flag.** The flag is the
decision deferred, and the failure mode is silent: a run against a thin or
unrepresentative corpus rewrites the thresholds and nothing in the diff says
the corpus was thin.

**Emit a patch file for review.** Better, and still the tool proposing an
edit in a form designed to be applied without being read. The gap between "a
number in a report" and "a diff you can `git apply`" is exactly the friction
that makes somebody look at the figure.

**Calibrate against the sample texts in `samples/`.** Two of the four were
written to trip the rules and all four were written by the author of the tool.
Calibrating against them would produce numbers with a provenance nobody could
defend.

**Derive a ceiling as a multiple of the observed maximum.** The tempting one.
It produces a plausible number from data that contains no information about
ceilings, and the number would then be indistinguishable, in the registry,
from one that was measured.
