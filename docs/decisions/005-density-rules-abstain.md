# 005. A density rule may abstain, and an abstention is not a pass

Date: 2026-08-27
Status: Accepted
Evidence: Direct, and the defect it fixes was measured before the fix.
          Day one's `transition-density` scored a 7-word note containing one
          `međutim` at 0.00 — a perfectly ordinary connective, marked as a
          total failure, because at a floor of 4 per 1000 words a single
          occurrence in a short text lands at 143 per 1000. That figure was
          asserted in `src/rules/transition-density.test.ts` rather than
          hidden, which is how it survived long enough to be fixed.
          Since the change: the same note abstains, and the test now asserts
          the abstention and its reason.
          Second, unplanned observation, 2026-08-27: `samples/machine-sr.md`
          at 172 words became UNMEASURABLE — every one of its 13 density rules
          abstained and the report scored `null`. The sample had to be
          lengthened to 274 words to remain a demonstration. That is the cost
          of this decision arriving in one number, and it is real: the tool
          now says nothing about texts it used to grade confidently and
          wrongly.
          Unobserved: whether 200 is anywhere near right.

## Context

Every density rule reports a rate. A rate needs a denominator large enough
that a single occurrence does not dominate it, and short texts do not have
one. At a floor of 4 per 1000 words, one occurrence is "free" only past about
250 words; below that, a writer using one good connective in a paragraph gets
a 0.

Two outcomes were available on day one, and both are lies about a short text.
Scoring it reports a measurement that describes arithmetic rather than prose.
Passing it is worse in a specific way: it records that the rule looked and
approved, when the rule could not look. That is the same confusion this whole
project exists to catch — an entry that finds nothing being indistinguishable
from an entry that found nothing wrong.

## Decision

`RuleResult` is a discriminated union with an `outcome` of `'scored'` or
`'abstained'`. An abstained result carries no score, no `passed`, and no rate —
it carries a reason.

An abstention is excluded from `Report.score`. It is not counted as a pass, so
`hardFailures` never contains an abstaining hard rule. `Report.abstentions`
lists every one with its reason, and `Report.score` is `null` when no density
rule could be scored at all.

The threshold is `density.min-words = 200`, declared through the uncalibrated
registry.

**It is a different kind of guess from the floors and ceilings, and that is
the point of this ADR.** A floor is a guess about what counts as good prose —
a judgement a reader can disagree with, and being wrong about it means
disagreeing with a writer. This is a guess about whether a measurement is
POSSIBLE: whether the text is long enough for a rate to carry information at
all. Being wrong about it means reporting a number that describes arithmetic.
Those are different failures and they are calibrated against different things:
a floor wants a corpus of good writing, this wants only the ceilings the rules
already declare.

The principled version is in fact derivable: a rule cannot say anything until
one occurrence lands at or below its own ceiling, which is `1000 / ceiling`
words — 167 for a default phrase rule, 333 for `negative-parallelism`. A
single number is a simplification, and 200 sits inside that range rather than
at either end.

## Consequences

The union means the compiler enforces the distinction. `score: number | null`
would have put the check at every call site and let one forgotten `?? 0` turn
an abstention back into a failing grade; instead, reading `.score` off an
unrarrowed result does not compile.

`Report.score` becomes nullable, which every consumer now has to handle. That
is the honest shape: a two-sentence note has no prose score, and returning 1.0
would mean it scored better than anything ever written.

The cost landed immediately and is recorded in the Evidence above: a 172-word
sample that the tool used to grade at 0.216 now produces no score at all. Some
of what the tool said yesterday was noise, and this is what removing it looks
like — fewer numbers, and a report that more often says nothing.

Two rules now have two gates. `sentence-uniformity` abstains below the shared
word count OR below its own minimum sentence count, because it can fail to be
measurable in two different ways.

Tests had to grow. Fixtures are padded to a measurable length by a shared
filler, and `src/rules/padding.test.ts` asserts that filler trips no rule —
otherwise every padded fixture would carry findings belonging to the harness.

## Alternatives rejected

**Lower the floors so short texts pass.** Fixes the symptom by making the rules
worse at their actual job. The floor is about prose; the problem is arithmetic.

**A minimum-count guard instead of a minimum-length one — "one occurrence is
never a finding".** Sounds equivalent and is not: it would let a 40-word text
with two occurrences score 0 while a 4000-word text with one scores 1.0,
which is the same denominator problem with an extra step.

**Report the score with a "low confidence" flag.** The number still gets read.
A flag beside a number is a footnote beside a headline, and the headline wins.

**Score it and let the reader judge.** This was day one's behaviour. It
produced a 0.00 on a good sentence, which is how a style checker teaches
people to write worse.
