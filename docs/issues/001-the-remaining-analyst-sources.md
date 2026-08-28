# 001. The remaining seven analyst sources

Status: Open. Deferred from the analyst pilot, 2026-08-28.

## What is not done

The eval suite was planned around eight labelled sources. One exists:
`agentstep-korisnicka-podrska.md`, 101 sentences, Serbian. The other seven have
not been chosen, labelled, or run.

## Why they are not worth labelling yet

The pilot found that the marks moved more than the analyst did. Four labelling
passes over that one source produced means of 0.192, 0.111, 0.661 and 0.411
against an unchanged fixture — the same twenty quotes every time. See ADR 019.

The `E` definition was rewritten in response to that, and the ±1 window on
`analyst-claim-locates` was adopted and reverted. Both changes were made while
looking at this one article.

So labelling seven more sources now would spend seven afternoons producing
numbers against a vocabulary whose only evidence is the source that shaped it.
If the vocabulary is still wrong, that is seven sets of labels to redo — and the
labels are the most expensive artifact in the repository.

## What has to be true first

**One source that did not shape the vocabulary, labelled under the current
definitions, producing scores that do not require another edit to the
definitions.**

Concretely:

- `E` marked mechanically — a figure, a named source, a comparison, a described
  observation — without the labeller reaching for a judgement about whether the
  evidence is any good.
- `evidence-recall` computed over an `E` set large enough that the number means
  something. A denominator of 1 produced 1.00 in two passes and said nothing.
- `analyst-claim-locates` scoring without anyone wanting to widen it again. A
  second loosening would make it a fitting procedure rather than a scorer.

If that source comes back needing another vocabulary change, the answer is
probably not a third definition of `E`. It is that sentence-level marks are the
wrong instrument, and that is a bigger decision than this issue.

## What would then follow

Seven more sources, roughly half the author's own ADRs and READMEs and half
short public excerpts carrying their URL and retrieval date, a majority Serbian.
At 10-15 minutes each for a 60-80 sentence source — measured in ADR 018 — that
is under two hours of labelling, plus about $0.10 per live run to record each
fixture.

A baseline becomes worth writing at that point and not before. The precedent is
`agent-evals`' semantic scorer: calibration at margin -0.392, eight of ten pairs
overlapping, and no threshold adopted.
