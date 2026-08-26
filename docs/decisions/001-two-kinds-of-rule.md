# 001. Two kinds of rule: hard and density

Date: 2026-08-26
Status: Accepted
Evidence: Weak, and weak in a specific way worth naming: both kinds exist and
          both fire, but no text has yet been judged by a human against the
          tool's output, so nothing confirms that the split matches how a
          reader experiences the two failures.
          What is observed, on this repository's own samples (2026-08-26):
          `samples/machine-sr.md` scores 0.216 across 13 density rules with
          both hard rules passing and exit code 0. The same file with its
          diacritics stripped fails `diacritics`, exits 1, and its density
          mean RISES to 0.265 — because several phrase rules stop matching
          words they can no longer recognise. That rise is the point: under a
          single blended number the stripped text would have looked BETTER
          than the original. Separating the two kinds is what stops it.
          The corpus is two files the author of the tool wrote to trip it,
          which is the weakest possible corpus.
          Unobserved: any case where a reader disagrees with the assignment of
          a rule to a kind. `summary-close` is the likeliest candidate.

## Context

A style guide contains two different kinds of sentence, and they are not
different in degree.

"Always `ti`, never `Vi`" is one kind. So is "write Serbian with its
diacritics". These are conditions on the text. There is no amount of `Vi` that
is acceptable, and `moze` for `može` is not a stylistic preference — `ceo` and
`ćeo` are different words, and a reader who has to guess which one is meant is
reading a defect.

"Don't overuse transitions" is the other kind. Every word on that list is a
good word. One "međutim" in a paragraph is prose working correctly. The guide's
objection is explicitly to accumulation: it is not a hunt for a single word, it
is the pattern of many.

The pressure is to flatten these into one scale — a severity field, or weights,
or a single mean with the hard rules given a large coefficient. That flattening
is what this ADR refuses.

## Decision

`RuleKind` is `'hard' | 'density'`.

A hard rule scores 0 or 1 and its result appears in `Report.hardFailures`. It
contributes NOTHING to `Report.score`. The CLI exits 1 when `hardFailures` is
non-empty and exits 0 otherwise, whatever the score.

A density rule measures a rate — per 1000 words, or per 1000 characters for
`bold-ratio`, or a standard deviation for `sentence-uniformity` — and scores
continuously. `Report.score` is the weighted mean of density rules only.

## Consequences

A text with no diacritics cannot arrive at "0.7 good". The number beside it
describes its prose; the failure beside the number describes its correctness,
and neither launders the other.

The exit code means one thing. Because a low score never exits 1, the score
stays a number a writer reads and argues with rather than a gate they learn to
route around — which is what would happen the first time a good piece failed
CI at 0.79.

The cost is that assigning a rule to a kind is a judgement made once, in code,
and it is not obviously right in every case. `summary-close` is scored by
density even though one "u zaključku" is usually one too many, because a long
piece may legitimately summarise a section — and a hard failure there would be
the tool overruling the writer on a judgement call. That reasoning is a
sentence in a comment, not a measurement.

Two rules also produce no findings at all — `diacritics` fails on an absence,
and `sentence-uniformity` reports a property of a distribution. Any UI built on
`Finding` has to handle a result that has a verdict and nothing to underline.

## Alternatives rejected

**One continuous scale with weights.** A hard rule at weight 10 still averages:
a text that fails `diacritics` and is otherwise excellent lands somewhere in
the middle, and the middle is where a reader stops looking.

**A severity enum (`error`, `warning`, `info`).** Familiar from linters, and it
describes how loudly to print rather than what kind of claim is being made. The
distinction that matters here is whether the measurement is a rate, and
severity does not carry it.

**Everything hard.** This is what a style guide feels like when you first
compile it, and it is why most prose linters get uninstalled. It fails good
writing for using a good word once.
