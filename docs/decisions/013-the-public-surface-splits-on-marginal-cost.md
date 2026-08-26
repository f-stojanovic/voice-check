# 013. The public surface is `check` only, and the split is marginal cost

Date: 2026-08-26
Status: Accepted. The page exists and runs locally; it is not deployed.
Evidence: Direct but narrow. The page serves, checks, highlights findings at
          the offsets recorded on day one, and passes 21 tests including one
          asserting the rendered HTML contains no `<script>` tag at all.
          The cost argument is arithmetic rather than an observation:
          `check` calls no model and its marginal cost is zero; `brief` costs
          $0.10–$0.12 per run, measured across three live runs.
          Unobserved: everything about running this in public. No deployment,
          no traffic, no abuse, and therefore no evidence that a
          20-per-minute limit is anywhere near right.

## Context

The tool has two halves with the same shape from the outside — text in, report
out — and completely different economics.

`check` runs sixteen deterministic rules over a string. No network, no model,
no key. The marginal cost of a request is CPU measured in milliseconds.

`brief` makes two Claude calls at roughly $0.11. On the author's key.

The obvious product move is one interface over both. It is also the move that
turns a personal tool into a stranger's spending account.

## Decision

**Public, free, no key: `check`.** A single page — Hono, server-rendered HTML,
no framework, no build step, no client JavaScript. A textarea, a language
selector defaulting to auto-detect, a submit button, and the report rendered
from the same `check()` the CLI calls, with findings underlined in place using
the positions recorded on day one.

**Private, CLI only: `brief`.** Not "not yet". A public endpoint for `brief` is
a public endpoint for spending somebody else's money, and rate limiting does
not fix that — it prices the abuse rather than preventing it. Any future
public version needs the caller to bring a key, which is a different product.

**The split is marginal cost, not maturity.** That is the whole of this ADR. It
is not a staging decision to revisit when the UI is nicer; it follows from
which half of the tool has a per-request price, and that will not change.

Three constraints follow from taking the public part seriously:

**Nothing is stored.** No database, no log line carrying the text, no
analytics. The only copy is the one being rendered back to the sender. This is
stated on the page rather than buried in a policy, because a style checker that
keeps your writing is a style checker nobody pastes into — and that sentence is
a product observation, not a privacy stance.

**The limits are on the page.** 40,000 characters, 20 submissions per minute.
A limit somebody discovers by being refused reads as a bug. The character cap
is not about protecting the server — the rules are linear and a megabyte would
be fine — it is about the response: a 200,000-character text produces a report
nobody reads and a highlighted block that hangs a browser.

**It works with JavaScript disabled.** A form post, not a fetch. This is about
twenty lines of decision and it means the page works in a text browser, on a
locked-down machine, and on a bad connection. A test asserts the page contains
no `<script>` tag, so the day somebody adds one is a day the build says so.

## Consequences

The public thing is the thing with no marginal cost, so it can be left running
without a budget alarm.

One `check()` with two renderers. The web report and the CLI report cannot
disagree about a score, an abstention or an uncalibrated count, because they
are the same object formatted twice. A second implementation would be a second
tool wearing the first one's name.

Day one's positions finally do the job they were recorded for. ADR 004 argued
for carrying `line`, `column` and `offset` on the strength of an editor that
did not exist, and noted that a position cannot be reconstructed from a count.
`highlight.ts` slices the original string at those offsets with no re-matching
and no rule re-run.

The costs:

**The rate limiter is in-memory and per-process.** It resets on restart and
does not survive a second instance. Both are fine for one process and both stop
being true the moment this is deployed behind more than one, which is recorded
in the code rather than discovered later.

**No deployment, so no evidence.** 40,000 characters and 20 per minute are
guesses, and unlike every other guess in this repository they are not in the
uncalibrated registry — that registry is about the measurement, and these are
about the service. They are stated on the page, which is a weaker form of the
same discipline.

**A page with no JavaScript reloads on every check.** For a form somebody uses
every few minutes that is not a cost. For someone iterating on a paragraph it
is, and the honest answer is that it would take client-side rendering to fix
and that trade has not been made.

## Alternatives rejected

**One UI over both, with `brief` behind a login.** A login is an account
system, a session store, and a decision about who gets an allowance. That is a
product, and this is a tool.

**`brief` in public with a tight rate limit.** Sets a price on abuse rather
than preventing it, and the price is paid by the author. Twenty briefs a minute
is $130 an hour.

**A single-page app.** Needs a build step, a bundle, and a second rendering of
the report in the client. Every one of those is a way for the page to disagree
with the CLI or fail where the CLI works.

**Store submissions to build the calibration corpus.** Tempting — the accepted
corpus is the project's bottleneck (ADR 011) and this would fill it. It is
refused because the texts would be strangers' unpublished writing, collected
from a page that would have to stop saying it stores nothing, and a corpus of
"things people pasted into a style checker" is a corpus of drafts people were
unsure about rather than writing anybody accepted.
