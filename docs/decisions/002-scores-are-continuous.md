# 002. Scores are continuous, because the objection is accumulation

Date: 2026-08-26
Status: Accepted
Evidence: Direct, from the samples in this repository, 2026-08-26.
          `samples/ordinary-sr.md` — 322 words of ordinary Serbian written for
          the purpose — scores 0.936. `samples/machine-sr.md` scores 0.216.
          Under a boolean threshold at any value between those, both texts
          would be a single tick, and the interesting fact — that the ordinary
          text loses points on exactly two rules, one of which is the known
          `ključna reč` false positive — would not be visible at all.
          Also measured: `transition-density` on the ordinary text finds zero
          transitions and scores 1.0, while a 40-word note containing one
          "međutim" scores 0. That second figure is not a success. It is
          recorded here because it is what the continuous scale makes visible
          about short texts, and it is asserted in
          `src/rules/transition-density.test.ts` so it cannot quietly change.
          Unobserved: a revision that improves a text without crossing any
          threshold, which is the strongest form of this argument.

## Context

The style guide this tool compiles says, about the catalogue of machine-writing
tells, that it is not a hunt for a single word but the accumulation of
patterns. That sentence is a specification for a measurement, and the
measurement it specifies is a rate.

A boolean throws that away. "Contains a transition word: yes" is true of every
well-written essay ever published. The signal is not presence, it is how much,
and a check that reports presence reports the thing that does not vary.

The pressure towards booleans is structural: CI wants an exit code, a report
wants a green tick, and a number in [0, 1] is harder to act on than a red
cross. The temptation is to record the boolean and discard the number that
produced it.

## Decision

`RuleResult.score` is a number in [0, 1] where 1 is clean. `RuleResult.passed`
is derived from `PASS_THRESHOLD` and is a reporting convenience. The score is
what gets stored; the boolean is what gets printed.

The scoring shape is documented once, in `src/scoring.ts`: 1.0 at or below a
floor, falling linearly to 0 at a ceiling. Both bounds are declared as
uncalibrated constants (ADR 003's mechanism, borrowed from agent-evals
ADR 010).

The floor is above zero on purpose. Scoring the first occurrence of a good word
below 1.0 would tell a writer to delete a word that is doing its job, which is
how a style checker teaches people to write worse.

## Consequences

Improvement that crosses no threshold is still visible, and the mean moves when
quality moves.

Thresholds become a display decision rather than a measurement one. Because the
number is stored, "what would this have said at 0.9?" can be asked of texts
already scored. A stored boolean bakes today's threshold in permanently.

The cost is NaN, which is the same cost agent-evals pays. A rate with an empty
denominator is 0/0, which passes every naive range guard and poisons every mean
it reaches. `perThousand` returns 0 for an empty text and `densityScore`
rejects non-finite input, and a registry test runs every rule against the empty
string to check that no score comes back NaN.

The second cost is short texts. A rate needs a denominator large enough to
mean something, and at a floor of 4 per 1000 words a single transition is only
"free" once the text runs past about 250 words. Below that, one perfectly good
connective scores 0. This is a real defect of the current design and it has no
fix in this version — see the README's status list.

## Alternatives rejected

**Pass/fail per rule.** Identical output for a paragraph with one "moreover"
and one with nine. Those are the two cases the guide exists to distinguish.

**Counting findings and reporting the raw count.** A count is not comparable
between a 200-word note and a 2000-word essay, so every reading of it requires
a division the reader performs in their head, badly.

**Buckets (clean / borderline / bad).** A boolean with more edges. Movement
inside a bucket is invisible, and the boundaries are as invented as a threshold
while looking more considered.
