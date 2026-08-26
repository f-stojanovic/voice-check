# 004. Findings carry positions from the start

Date: 2026-08-26
Status: Accepted
Evidence: Implemented and tested, unused by any consumer. Every rule that
          produces findings asserts a `line:column` in its test file
          (`src/rules/*.test.ts`), and a registry test slices every finding
          back out of the source text by its offset and checks it matches —
          the property that would break first if an offset were computed
          against a transformed string.
          Two rules produce NO findings by design: `diacritics` fails on an
          absence, and `sentence-uniformity` reports a property of a
          distribution. Both are asserted to return an empty array so that a
          later "every rule points somewhere" assumption fails loudly.
          Unobserved: any UI reading these positions, which is the whole
          justification. This ADR is a bet, and it is recorded as one.

## Context

The report this tool prints today is a table of counts and a mean. Positions
are not needed to print a count.

They are needed by the obvious next surface: an editor that underlines the span
it is objecting to. A rule that says "3 weasel words" is a grade. A rule that
puts a squiggle under `Stručnjaci kažu` is an edit the writer can make in two
seconds.

The asymmetry is the whole argument. Recording a position costs a few lines
now. Adding it later costs re-running every rule over every text that was ever
scored, because a position cannot be reconstructed from a number — and any
scores already stored are simply not upgradeable.

## Decision

`Finding` carries `text`, `line`, `column` and `offset` and is the only thing a
rule may report.

`line` and `column` are 1-based because that is what an editor, a compiler and
a human all mean by "line 4, column 12". `offset` is 0-based because that is
what `String.prototype.slice` means. Both are stored rather than one derived
from the other, since deriving at each call site is where off-by-ones live.

`text` is the matched span verbatim, so a report can quote without re-slicing —
and so a test can assert the slice and the span agree.

Positions are computed against the ORIGINAL string. No rule normalises,
lowercases or strips Markdown before matching; case-insensitivity is a regex
flag, not a transformation. A position computed against a transformed string is
wrong in a way that only shows up on the documents that needed it most.

## Consequences

The editor integration is a rendering problem rather than a re-measurement
problem.

Reports can quote findings with line numbers today, which turned out to matter
sooner than expected: the false-positive survey in the README is a list of
quoted spans with line numbers, and it is what makes "this rule is noisy"
concrete instead of an assertion.

The cost is that findings are heavier than counts, and a rule with four hundred
matches carries four hundred objects. Nothing truncates them today; the CLI
quotes the first three per rule and says how many more there are. If a stored
report format arrives, this is where it will hurt.

The second cost is the two rules that cannot participate. `Finding` implies
every objection has a location, and two of them do not, so any consumer has to
handle a result with a verdict and nothing to underline.

## Alternatives rejected

**Store counts, add positions when a UI needs them.** The cheap-sounding option
that quietly makes every already-scored text unupgradeable. This is the
decision this ADR exists to foreclose.

**Store offsets only, derive line and column at render time.** One number
instead of three, and it requires the renderer to hold the original text, which
a stored report does not. It also puts the same off-by-one in every consumer
rather than in one function with a test.

**Store the enclosing sentence instead of a span.** Enough to quote, not enough
to underline, and it makes the report's size depend on the prose rather than on
the number of findings.
