# 015. An observation window shorter than the phenomenon produces a confident negative

Date: 2026-08-26
Status: Accepted. Two instances on one afternoon, from two people independently.
Evidence: Direct, and the measurement that settled it came after both
          conclusions had already been drawn and acted on.

          GitHub creates a workflow run 19.5–21.0 minutes after a push to this
          repository (n=5, mean 20.2), and each run then passes in about 40
          seconds:

          | commit | pushed | run created | delay |
          | --- | --- | --- | --- |
          | `40789d2` | 15:52:08 | 16:12:47 | 20.6 min |
          | `909543d` | 15:54:10 | 16:13:41 | 19.5 min |
          | `5d09669` | 15:55:14 | 16:15:04 | 19.8 min |
          | `bdb79f0` | 15:56:51 | 16:17:50 | 21.0 min |
          | `bed4388` | 16:00:39 | 16:20:28 | 19.8 min |

          Before that was known: nine pushes were observed to produce zero
          runs, `autoDeployTrigger` was set to `"off"` on the strength of it,
          and both conclusions were written into a decision record as settled.
          Every one of those observations was taken inside the window.

## Context

A workflow would not fire. The investigation was thorough in the way that
investigations are taught to be: eliminate causes one at a time, cheapest
first, and write down what each one excluded.

Ten candidates were excluded, each with a specific check — the git client, the
credential helper, token scopes, committer identity, whether the push landed,
Actions enabled at the repository, Actions enabled at the account, a repository
restriction, workflow state, trigger syntax, and whether the file was on the
default branch. A commit made in the GitHub web interface excluded the entire
local path at once. Two standard remedies were then tried and appeared to fail.

The conclusion — the fault is GitHub-side and terminal — was wrong. The
mechanism was configured correctly and slow, and **latency was not a row in
the table**.

## The failure, stated generally

**An observation window shorter than the phenomenon produces a confident
negative, and repetition inside the window does not fix it.**

Nine pushes produced nine observations of zero. They read as nine independent
confirmations. They were one measurement repeated, because every one was taken
faster than the thing being measured. Independence requires that observations
could have differed; inside a twenty-minute delay, none of them could.

**Thoroughness about the wrong question is indistinguishable from thoroughness
about the right one** until something external contradicts it. The ten-row
exclusion table did not look like a table with a hole in it. It looked like
diligence, and it made a wrong answer more persuasive than a bare assertion
would have been — a well-evidenced wrong conclusion is harder to dislodge than
a guess, because the evidence is real and the reasoning is sound and only the
frame is missing.

## Two instances, which is what makes it a pattern

**One.** The exclusion table above, and the decision to set
`autoDeployTrigger: "off"` on the basis of it. That change was actively harmful
for the hour it was in place: it disabled a gate on the belief that the gate
could never receive a signal.

**Two, independently.** A commit made through the GitHub web interface directly
to `main`, specifically to bisect whether the fault was local. It produced no
run, and the result was called decisive: *"That rules out every local cause."*

The inference about local causes was correct. The commit did produce a run —
19.8 minutes later, twenty minutes after the conclusion had been drawn from its
silence. The probe was well designed and answered slower than the question was
asked, which is the same error in a different hand.

Two people, two methods, one afternoon, the same mistake. That is what
distinguishes a pattern from an accident, and it is why this has an ADR rather
than a line in a commit message.

## Decision

**Before concluding that something does not happen, establish how long it takes
when it does.** The question "how long should I wait?" has to be answered
before, not after, a negative result is recorded.

Concretely, in this repository:

- The measured delay is documented as a number, in the README next to the
  deploy section and in [ADR 013](013-the-public-surface-splits-on-marginal-cost.md),
  with its n. A reader who pushes and sees nothing is told to wait twenty
  minutes before concluding anything.
- A negative result about a timed system records the observation window
  alongside the observation. "No runs" is not a finding; "no runs within 90
  seconds of the push, where the mechanism takes twenty minutes" is.
- Repeated observations inside one window are counted as one. Nine pushes are
  not n=9 unless the pushes were separated by more than the latency.

The generalisation is not new here. It is the same rule this repository already
applies to prose — `calibrate` refuses a percentile below ten documents, and a
rule abstains when one occurrence would dominate the rate — arriving in a place
nobody thought of as a measurement.

## Consequences

The twenty-minute figure is in the README, which is the only place it stops the
next person repeating the afternoon. The next person is most likely the author.

A negative result now costs more to record, because it has to carry its window.
That is the intended cost and it is small.

**The figure is itself thin.** Five observations of one queue on one afternoon.
Whether twenty minutes is this repository's steady state, an incident that day,
or a property of a new repository, five points cannot say, and the number
should be re-measured before anything depends on it. A rule against confident
negatives from thin data applies to this ADR's own evidence.

**Nothing enforces it.** There is no check that a negative claim in this
repository carries its observation window, and the two instances above were
committed by people who had both read the file arguing for exactly this
discipline in a different domain. Knowing the rule did not produce the
behaviour.

## Alternatives rejected

**Treat it as an incident and move on.** One instance is an accident. Two,
arrived at independently within an hour, is a method failing.

**Add a checklist item — "did you wait long enough?"** A checklist read by
somebody who already believes they know the answer is a checklist that gets
ticked. The number in the README does more, because it is read before the
belief forms.

**Blame the tooling.** GitHub was slow, which is a fact about GitHub. The error
was concluding from silence without knowing how long silence takes, and that
would have been an error whatever the platform did.
