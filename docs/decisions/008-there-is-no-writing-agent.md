# 008. There is no writing agent

Date: 2026-08-27
Status: Accepted. Enforced by `src/agents/no-writer.test.ts`.
Evidence: The argument is a priori, and this line should not pretend
          otherwise: no drafting agent was built, so no draft has been graded
          by the checker in the next directory, and the specific claim below —
          that a generated draft would score badly against the style guide —
          is UNTESTED.
          What is observed, from the live run of 2026-08-27: the angles agent
          produced three `questionForWriter` fields, and every one of them
          asks for something only the writer has. One reads, in translation,
          "when did you last stay silent in a meeting because you did not want
          to admit you did not know what a word meant — and how did that end?"
          No model has that answer. That is the shape of the handover this
          decision exists to protect, and it is the closest thing to evidence
          available without building the thing being refused.
          A cheap experiment that would test the claim: draft a post from a
          brief with a third agent, run `npm run check` on it, and record the
          score. It has not been run.

## Context

The pipeline is analyst → angles → **a person writes the post**. The third
agent is the easiest of the three to build. Everything it needs already
exists: a structured analysis, an audience profile, angles, and a style
checker to grade its output. It would take an afternoon.

Every part of the surrounding design points at it. There is a voice to imitate,
a documented guide describing that voice, and a deterministic grader sitting in
the same repository. The tool looks unfinished without it.

## Decision

There is no drafting agent, there will not be one, and the decision has a file:
`src/agents/no-writer.ts`. `AGENTS` enumerates the two that exist, and
`no-writer.test.ts` asserts that the modules in `src/agents/` are exactly
those two — so adding a third fails the build and sends whoever added it to
read the argument and disagree with it deliberately.

The reasoning:

The style guide this repository compiles is, in its second half, a catalogue of
what prose looks like when there is nothing behind it. Negative parallelism,
weasel attribution, promotional adjectives, the summary paragraph that restates
what you just read — none of those are stylistic preferences. They are what
writing looks like when the writer has no specific thing to say and is filling
the shape of an argument. The guide's own conclusion is that the value is the
writer's experience and depth.

A drafting agent has exactly that problem, necessarily: it has no experience to
draw on. It would produce that prose, and the tool would then hand the draft to
the checker next door, which was compiled from the guide, which would grade it.
The output of that loop is a text that passes a checker and has nobody behind
it — worse than no tool at all, because it would be fast.

**The boundary is therefore not a limitation to be lifted when the models get
better.** Better models make the draft more fluent. Fluency was never the
missing part.

`questionForWriter` in `angles.ts` is where the handover happens, and it is
documented as the field that matters most. The writer's answer to it is the
only part of the eventual post a model could not have supplied.

## Consequences

The tool ends by saying what it will not do. `THE_REFUSAL` is printed at the
bottom of every brief, because an absence in a product reads as a feature
somebody has not got round to, and a writer who never sees the reasoning would
reasonably wait for the draft button.

Deciding what is not an agent leaves no trace unless you leave one. This ADR
and that module are the trace. A README paragraph would have been skimmed.

The cost is real and worth naming: the tool stops at the point where the work
gets hard. Anyone comparing it to a product that drafts will find it does less,
and "it does less on purpose" is a claim every underpowered tool makes. The
only defence is that the reasoning is written down and can be argued with.

The refusal is also narrow. Nothing here objects to using a model for prose in
general — the analyst reads and the angles agent writes hooks, both in a
model's voice. The objection is specific: not drafting **in the author's voice**
material that is then presented as his.

## Alternatives rejected

**A drafting agent behind a flag, off by default.** A flag is a decision
deferred, and defaults erode. It also means building the thing and then relying
on nobody turning it on.

**A drafting agent whose output is explicitly marked as a draft.** The mark
survives exactly as long as the first copy-paste.

**An outline agent — structure without sentences.** The most tempting middle
position, and the one this ADR is least sure about. An outline is not hollow
prose; it might genuinely help. It is refused for now because an outline
determines the argument, and the argument is where the writer's experience
enters. Reconsidering this is a legitimate future decision; it should arrive as
ADR 0NN superseding this section, not as a quiet commit.

**Build it and grade it with the checker, then decide.** The honest version of
this ADR's Evidence problem, and a real option. It was not taken because
building the thing to prove it should not exist tends to end with it existing.
