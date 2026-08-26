# 010. The analyst's only mechanical check is whether its evidence exists

Date: 2026-08-28
Status: Accepted. The gate is enforced; nothing else about the analyst is.
Evidence: Direct, from live runs. Two runs against
          `martinfowler.com/articles/2021-test-shapes.html` on 2026-08-27
          produced 12 of 12 quotes present in the source, and a third on
          2026-08-28 after the gate landed did the same. So the gate has
          never fired in production and its false-positive rate is unmeasured.
          What IS measured is the distinction it depends on: the day-two
          check normalised whitespace and case before comparing, so it could
          not tell "absent" from "present but reformatted". Both are now
          reported separately and tested against a hard-wrapped source and a
          case-folded quote, neither of which fails the run.
          The claim this ADR makes about everything ELSE the analyst produces
          is not evidence-backed and is not meant to be: it is an argument
          about what kind of thing those outputs are.

## Context

The analyst returns five fields. Four of them are judgement: whether a claim
is the central one, whether a point is genuinely new, whether an assertion is
unsupported, whether a question is left open. Reasonable readers disagree
about all four, and there is no procedure that settles them — checking them
means a judge, which needs its own calibration against human labels, or a
human, who is the person the brief was for.

One field is not judgement. Every statement carries a quote the analyst says
it came from, and whether that text is in the source is a fact. It admits a
procedure, the procedure is cheap, and its answer is not a matter of opinion.

Day two printed the result of that procedure as a statistic under the brief.
Which is to say: it was computed, formatted, and compared against nothing.

## Decision

**Traceability is a gate.** `analyse` verifies every quote against the source
and throws `UntraceableQuoteError` when any is absent. The analysis is
discarded, the `brief` command exits 7, and the failure names the field, the
statement, and the quote.

**Three outcomes, not two.** `exact` is byte-for-byte. `normalized` differs
only in collapsed whitespace and folded case. `absent` is neither. Only
`absent` fails.

That distinction is load-bearing rather than fussy. Sources are hard-wrapped
Markdown and scraped HTML; a quote spanning a line break is the same quote,
and a gate that conflated the two would fire on formatting on most real
inputs, get switched off within a week, and take the real check with it.

**Everything else the analyst produces is judgement, and this repository does
not check it.** No test asserts that the analyst found the right claim, and
none can. That is a statement about the boundary of what mechanical checking
reaches, not a gap to be filled by more assertions.

## Cost and latency are observations, not controls

They are recorded per call and printed on every brief: `$0.1024 · 6778 in /
2741 out`. **They are compared against nothing.** There is no budget, no
baseline, no threshold, and no run has ever failed because of either.

This is worth stating plainly because a printed number reads as a control.
agent-evals compares its cost against a committed baseline and fails a build
on a regression; here the same figure is a note under a report. The difference
is that a baseline needs a fixed set of cases to be a baseline of, and the
brief runs against whatever URL somebody passes it. Two runs against different
sources have no cost relationship, so there is nothing for a gate to compare.

What would change that: a fixed corpus of sources, run periodically, with
cost recorded per source. That is the same missing corpus every other
uncalibrated number in this repository is waiting on.

## Consequences

A fabricated quote fails loudly instead of appearing in a report as an
authoritative-looking blockquote. That is the failure mode with the worst
consequences here — the brief exists to save the writer reading the source,
so an invented quote is one he is least likely to catch.

The gate constrains the model in a useful direction. Asking for quotes and
then checking them is a stronger instruction than asking for accuracy: the
model has to find text that exists rather than produce text that sounds right.

The costs:

**A false positive is possible and would be infuriating.** A source with
unusual entity encoding, a smart quote the extractor mangled, or a quote the
model translated would all read as `absent`. The normalisation step handles
whitespace and case and nothing else. The first real failure will tell us
which of those matters, and until one happens this risk is asserted rather
than measured.

**It is not a check on truthfulness.** A quote can be present, correctly
copied, and attached to a statement it does not support. The gate catches
fabrication, not misattribution, and misattribution is the subtler failure.

**A retry is unlikely to help.** Unlike a malformed tool call, a fabrication
is something the model chose to produce, and asking again may produce it
again. The exit code is distinct (7 rather than 6) for that reason.

## Alternatives rejected

**Keep printing the ratio.** A number nobody compares against anything is an
observation. The whole day-two report ended by noticing that cost was the same
kind of number and that traceability was the one that could be more.

**Fail on anything short of an exact match.** Would fire on every hard-wrapped
source, so it would be turned off, and turning it off would remove the real
check too.

**Warn instead of failing.** A warning under a report that a human asked for
because they did not want to read the source is a warning that goes unread.

**Ask a judge whether the quote supports the statement.** That is the
misattribution check the gate does not do, and it is a judge with its own
calibration problem. It belongs after there are human labels to calibrate it
against — agent-evals ADR 021 is the precedent.
