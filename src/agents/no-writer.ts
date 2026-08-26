/**
 * THERE IS NO WRITING AGENT. THIS FILE IS THE DECISION, NOT AN OVERSIGHT.
 *
 * The pipeline stops one step short of the obvious place. An analyst reads
 * the source, an angles agent prepares material, and then a person writes the
 * post. The third agent — the one that takes a brief and produces a draft in
 * the author's voice — is the easiest of the three to build and it is not
 * being built.
 *
 * WHY.
 *
 * The style guide this repository compiles is, in its second half, a
 * catalogue of what prose looks like when there is nothing behind it. Negative
 * parallelism, weasel attribution, promotional adjectives, the summary
 * paragraph that restates what you just read: none of those are stylistic
 * preferences. They are what writing looks like when the writer has no
 * specific thing to say and is filling the shape of an argument. The guide's
 * own conclusion is that the value is the writer's experience and depth.
 *
 * A drafting agent produces exactly that prose, necessarily, because it has
 * exactly that problem — it has no experience to draw on. The tool would then
 * hand the draft to the checker in the next directory, which was compiled from
 * the guide, which would grade it. The result is a machine that generates
 * hollow prose and a machine that detects hollow prose, closing a loop whose
 * output is a text that passes a checker and has nobody behind it. That is a
 * worse outcome than no tool at all, because it would be a fast one.
 *
 * The boundary is therefore not a limitation to be lifted when the models get
 * better. Better models make the draft more fluent; fluency was never the
 * missing part. `questionForWriter` in `angles.ts` is where the pipeline hands
 * over: it asks which of the writer's own experiences the angle touches, and
 * the answer to that question is the only thing in the eventual post a model
 * could not have supplied.
 *
 * WHY THIS IS A MODULE AND NOT A PARAGRAPH IN THE README.
 *
 * Deciding what is NOT an agent is the same kind of judgement as deciding what
 * is, and it is the kind that leaves no trace. A README paragraph gets skimmed;
 * an absence gets read as a gap somebody has not got round to filling yet. So
 * the decision has a file, and `no-writer.test.ts` asserts that the set of
 * agents in this directory is exactly the two named below — which means adding
 * a third fails the build and forces whoever adds it to come here, read this,
 * and decide against it deliberately rather than by not noticing.
 *
 * See ADR 008.
 */

/**
 * The complete set of agents in this repository.
 *
 * Enumerated rather than discovered, so that adding a module to `src/agents/`
 * does not silently add an agent. Guarded by `no-writer.test.ts`.
 */
export const AGENTS = ['analyst', 'angles'] as const;

export type AgentName = (typeof AGENTS)[number];

/**
 * What the pipeline deliberately does not do, in a form a report can print.
 *
 * The `brief` command ends with this line. A writer who reads it and disagrees
 * is welcome to; a writer who never sees it would reasonably assume the draft
 * button is coming in a later version.
 */
export const THE_REFUSAL =
  'voice-check prepares material and stops. There is no drafting agent, and ' +
  'there will not be one: the value is your experience, and an agent that ' +
  'wrote in your voice would be producing exactly the prose the style guide ' +
  'this tool was compiled from exists to reject. Answer the questions above ' +
  'and the post is yours to write.';
