# 013. The public surface is `check` only, and the split is marginal cost

Date: 2026-08-26
Status: Accepted and deployed — https://voice-check-m8b7.onrender.com,
        Render free tier, Frankfurt.
Evidence: Direct. The page serves, checks, highlights findings at the offsets
          recorded on day one, and passes 28 tests including one asserting the
          rendered HTML contains no `<script>` tag at all.
          MEASURED AGAINST THE DEPLOYED INSTANCE, 2026-08-26: `/healthz`
          answers in 0.17s warm and reports `sr 0.3.0+a1e590743b64`,
          `en 0.3.0+0126033ab30f` — the same lexicon hashes as the local
          checkout. `POST /` on `samples/machine-sr.md` returns 0.257, which
          is byte-identical to what the CLI prints for the same file.
          THAT IS THE ANSWER TO A QUESTION ADR 003 ASKED AND COULD NOT ANSWER.
          A score is only comparable within a lexicon version, and until this
          endpoint existed that identity lived only inside a report — so a
          report could carry a hash and nobody could check it against the
          thing that produced it. It is now answerable from outside the
          machine, which is the only place the question matters: the person
          holding the report is not the person holding the server.
          The cost argument remains arithmetic rather than an observation:
          `check` calls no model and its marginal cost is zero; `brief` costs
          $0.10–$0.12 per run, measured across three live runs.
          Still unobserved: no traffic, no abuse, and therefore no evidence
          that a 20-per-minute limit or a 40,000-character cap is anywhere
          near right. The cold start is Render's documented "about one
          minute", has not been reproduced here in two attempts, and was
          quoted for two days as a "30–50 seconds" that appears nowhere in
          their documentation — see the consequences below.

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

## The blueprint is the configuration, not a document beside it

The service was created from `render.yaml` through Render's Blueprint flow
rather than through the manual one. That is worth recording, because the manual
path autofills four defaults and all four are wrong for this service: a
different region, a different build command, a different start command, and a
**paid** plan.

A `render.yaml` sitting in a repository next to a service configured by hand is
a document that describes something. Created through the Blueprint flow, it is
the thing itself — editing the file is how the service changes, and the file
cannot drift from the deployment because there is nothing for it to drift from.

That is the same claim this repository makes everywhere else, arriving one
layer down. A style rule in a document is a suggestion and compiled into a
check it is a constraint. A lexicon beside a score is a note; hashed into the
report it is an identity. A deployment configuration beside a service is
documentation; applied as a blueprint it is the service.

## The deploy gate

`autoDeployTrigger: checksPass`, verified against Render's blueprint spec on
2026-08-26: the field takes `commit` | `checksPass` | `off`, defaults to
`commit` for a new service, and replaces the deprecated `autoDeploy`.

The default is what this service did for its first hours: **deploy on every
push regardless of whether the tests passed**. A deploy that can outrun its own
tests is not a gate, and nothing about having written a test suite prevents
that on its own.

`.github/workflows/deploy.yml` is deleted. It was correct — it waited for `ci`
to conclude and exited 1 with an explanation when its hook secret was absent,
rather than reporting success against nothing. It goes anyway, for reasons that
have nothing to do with it being wrong:

- One mechanism instead of two. A second mechanism that agrees with the first
  is a second thing to keep in agreement, and the day they disagree is the day
  somebody debugs a deploy that both of them think they own.
- No deploy-hook token to store. A credential that does not exist cannot leak,
  cannot expire, and cannot be rotated wrongly. The workflow needed a secret;
  `checksPass` needs Render to read a status it can already see.

The gate itself is unchanged, and that is the point: it was the test suite
before and it is the test suite now. What changed is which system enforces it,
and how many of them there are.

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

**Deployed, but no traffic, so still no evidence.** 40,000 characters and 20
per minute are guesses, and unlike every other guess in this repository they
are not in the uncalibrated registry — that registry is about the measurement,
and these are about the service. They are stated on the page, which is a weaker
form of the same discipline. Deploying changed nothing about how well-founded
they are; only visitors would.

**GitHub Actions run creation on this repository lags a push by about twenty
minutes, and for several hours that was indistinguishable from never.**

MEASURED, 2026-08-26, commit time against run-creation time, both UTC:

| commit | pushed | run created | delay | result |
| --- | --- | --- | --- | --- |
| `40789d2` | 15:52:08 | 16:12:47 | 20.6 min | success |
| `909543d` | 15:54:10 | 16:13:41 | 19.5 min | success |
| `5d09669` | 15:55:14 | 16:15:04 | 19.8 min | success |
| `bdb79f0` | 15:56:51 | 16:17:50 | 21.0 min | success |
| `bed4388` (web UI) | 16:00:39 | 16:20:28 | 19.8 min | success |

The last row is the bisect commit — the one made in the GitHub web interface to
rule out every local cause. It ruled them out correctly and it also produced a
run, twenty minutes after the conclusion had been drawn from its silence. The
probe was right; it answered slower than the question was asked.

n=5, mean **20.2 minutes**, range 19.5–21.0. The backlog drained in push order,
and every run then completed in about 40 seconds, including the step that
starts the built server and probes `/healthz`.

Four observations of one queue on one afternoon. Whether twenty minutes is this
repository's steady state, an incident that day, or a property of a new
repository, four points cannot say — and the figure should be re-measured
before anyone depends on it.

**What was concluded before that, and why it was wrong.** Nine pushes produced
zero runs. Every local cause was excluded — a commit made in the GitHub web UI
straight to `main` also produced nothing, which excludes the git client, the
credential helper, token scopes and the committer identity; Actions was enabled
(`{"enabled": true, "allowed_actions": "all"}`), the workflow was `active`, the
trigger parsed correctly, the file was on the default branch, and the same
account had 17 successful runs on `agent-evals`. Two standard remedies were
tried and appeared to fail: renaming `ci.yml` to `build.yml` (which did
re-register the workflow under a new id, 343030651 → 343063754) and deleting
the workflow and restoring it in a second push.

**Neither remedy can be credited, and neither can be blamed.** Every
observation was taken inside a twenty-minute window and the delay explains all
of them without needing either. An exclusion table that rules out ten causes
and never considers *latency* is a table that was asking the wrong question:
it tested whether the mechanism was configured, and the mechanism was
configured and slow.

The error has a shape this repository should recognise. Nine consecutive
observations of zero, all taken faster than the thing being observed, read
exactly like a settled negative result — which is what the phrase catalogue
looked like before the corpus, and what a p90 from four documents looks like in
a table. Repetition is not independence. Nine measurements inside one latency
window are one measurement.

**THE GATE HAS NOW FIRED, ONCE, AND THE TIMING IS RECORDED.** The check for
`8b4790c` completed at 16:31:14 UTC; the service process restarted at 16:32:27,
73 seconds later. `checksPass` waited for the check, the check passed, and
Render deployed. That is the first time anything automated in this repository
has been the thing that let something through.

It has not yet been the thing that *stopped* something, which is the harder
half. A gate is only demonstrated by a failure it blocks, and no run has failed
here.

The correlation was established from outside: run completion time from the
GitHub API, process start time inferred from `uptimeSeconds` on `/healthz`. It
is not proof — nothing exposes which commit is deployed — and a 73-second gap
between a check passing and a process restarting is strong enough to act on and
weak enough to say so.

**The gate is `autoDeployTrigger: "checksPass"`.** A push deploys only after
the branch's checks pass, so a deploy trails its push by the queue delay above
— about twenty minutes. **That is expected and is not a fault**, and it is
documented as a number in the README so the next person does not spend an
afternoon rediscovering it.

The latency costs this project nothing. Nobody is waiting on a deploy, and the
thing being bought is that untested code cannot reach the service.

The value is quoted, and the quoting is about the syntax rather than this
particular value: YAML 1.1 reads bare `off`, `on`, `yes` and `no` as booleans
while YAML 1.2 reads them as strings — the trap that makes GitHub Actions' `on:`
key parse as `true`. `checksPass` is safe unquoted; it is quoted anyway so that
changing the value to `off` later cannot silently change its type.

It was `"off"` for part of an afternoon, set on the belief that no check would
ever arrive. That belief was wrong and the change was actively harmful while it
stood: it disabled a gate because the gate appeared unable to receive a signal.
The reasoning error has its own record in
[ADR 015](015-an-observation-window-shorter-than-the-phenomenon.md).

The rejected alternative remains `commit`, which is what this service did on
its first day: deploy every push whether or not the tests passed. A deploy that
can outrun its own tests is not a gate.

**THE COLD START IS STILL UNMEASURED AFTER TWO ATTEMPTS, and both failures were
caused by this investigation rather than by the service.**

Attempt one measured 0.169s after what was believed to be a 15-minute idle
window. It was 13 minutes: polling `/healthz` to check the deployment had kept
the service awake, and that polling was not counted as traffic when the window
was planned.

Attempt two measured 0.140s after a genuine 21-minute window with no requests
at all. Also not a cold start: `uptimeSeconds` showed 478, so the process had
restarted 8 minutes earlier — the deploy described above. The gate firing reset
the clock.

**AND THE FIGURE WAS NEVER RENDER'S.** Checking their documentation in order to
attribute it properly, it says: Render "spins down a Free web service that goes
15 minutes without receiving any inbound traffic", and spinning back up "takes
about one minute". There is no "30–50 seconds" anywhere in it.

That number was introduced on 2026-08-26 in commit `4b23fa6`, presented as
Render's documentation, and repeated into four files over two days. It was not
quoted from anything. It is a plausible-sounding range that was invented and
then attributed — which is a fabricated citation, and strictly worse than the
unverified vendor figure it was mistaken for, because a reader checking the
source would have found nothing to check against.

Corrected everywhere to the documented "about one minute", quoted, and labelled
as Render's rather than as this repository's.

The shape is the one ADR 014 describes: a figure adopted on authority, repeated
until it reads as established, never checked against the thing it describes.
The difference is that the catalogue really was Wikipedia's. This was nobody's.

There is a second possibility that neither attempt can exclude: that this
service does not spin down at all. `render.yaml` sets `healthCheckPath:
/healthz`, and whether Render's own health probing counts as traffic against
the free tier's idle timer is not something this repository can observe from
outside. If it does, the warning on the page describes an event that never
happens here.

**The health endpoint cannot say which build it is running.** It reports the
lexicon identity, which is the thing ADR 003 asked for, and not the commit. So
"is the deployed instance running the code in this repository?" is unanswerable
from outside — and on a free tier that sleeps, `uptimeSeconds` cannot
distinguish a redeploy from a wake-up. The gap is the same shape as the one the
lexicon hash closed, one layer up, and it is open.

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
