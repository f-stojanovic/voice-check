# 012. The negative corpus is generated, and the provenance is the label

Date: 2026-08-26
Status: Accepted
Evidence: Direct. 15 English documents generated on 2026-08-26 —
          18,612 words, mean 1,241, $1.2312 on `claude-opus-5` — and 15
          Serbian, from the same 16 ordinary subjects across four formats
          (review, explainer, personal experience, how-to). Every file carries
          `provenance: generated`, the model id, the date and the exact prompt.
          The mean length matters: at 1,241 words every generated document
          clears every rule's abstention gate, including the 334-word gate on
          `negative-parallelism`. That was not designed for — the prompts
          specify no length — and it is why the ceilings are measurable at all.
          THE CORPUS IMMEDIATELY FALSIFIED AN ASSUMPTION THE PROJECT WAS
          BUILT ON. Across the 18,612 English words: `delve` 0, `landscape` 0,
          `synergy` 0, `robust` 0, `seamless` 0, `tapestry` 0, `leverage` 2;
          `incredible`/`stunning`/`breathtaking` 0; all four weasel phrases 0;
          all three summary closers 0; and all five transition words 0 — not
          one `however` in eighteen thousand words. Against 202 em dashes and
          232 bold runs.
          Six phrase rules never fired on any generated document, so their
          ceilings cannot be calibrated against this corpus and their claim to
          detect machine writing is falsified for this model. The rules that
          separate are typographic and structural. That was not known before
          the corpus existed and is exactly what a negative corpus is for.
          THE SERBIAN HALF OF THE CORPUS IS NOT USABLE AS SHIPPED, and this
          was measured rather than assumed. Every one of the Serbian
          documents drifts into Croatian: 77 instances of `što` against 29 of
          `šta`, and 58 ijekavian forms (`vrijeme`, `svjetlo`, `prije`) across
          the set, with five documents strongly ijekavian. The prompts are
          written in Serbian and specify nothing else, and the model answered
          in a neighbouring standard. The Serbian rules are ekavica-specific,
          so a ceiling calibrated against this half would be a ceiling for a
          language the author does not write. The English half is unaffected.
          Unobserved: whether one model's default register is representative
          of machine-written prose generally. It is not, and the ceiling is
          therefore a ceiling for text from this model.

## Context

ADR 011 established that a corpus of accepted writing yields a floor and can
never yield a ceiling: it contains no information about where writing that has
gone wrong sits. That left roughly half the constants uncalibratable, waiting
on a corpus of machine-written text that somebody would have to assemble and
label.

The assembling and labelling is the expensive part in the usual version of
this problem, and it is expensive because it is a JUDGEMENT. Somebody has to
read a text and decide whether it counts. Two people disagree. One person
disagrees with themselves a week later. agent-evals hit exactly this and
answered it with its ADR 021: only a human may assign a calibration label,
because a model grading its own output produces a figure that measures the
grading.

## Decision

**The negative corpus is generated, and generation IS the label.**

`npm run corpus:generate -- --lang sr|en --count 15 --out <dir>` asks the model
for blog posts on ordinary subjects and writes what comes back. A text in that
directory is machine-written because a machine wrote it, on a date, from a
prompt, all three recorded in its own frontmatter.

**This is the inverse of the agent-evals labelling problem, not a repeat of
it.** There, the label was a judgement about a model's output and a model could
not be trusted to make it. Here there is no judgement to make at all. Nobody
decides whether a text belongs in the negative corpus; the question does not
arise. There is no annotator to disagree with, no inter-rater reliability to
measure, and nothing for a second reader to check.

The judgement has moved entirely to the other corpus, and that is the right
place for it: "I consider this good" is precisely the call a model cannot make
for the author, and the accepted corpus is where a human is irreplaceable.

**The prompts carry no style instruction.** Not a tone, not an audience, not a
length, not "write engagingly" and not "avoid clichés". The measurement is the
DEFAULT REGISTER — what the model produces when nobody constrains it — because
that default is what a ceiling is supposed to describe. There is no system
prompt either: "you are a helpful assistant" is a style instruction wearing a
different hat.

**The subjects are ordinary.** Coffee grinders, compound interest, sourdough,
moving city. A corpus about AI would measure the model's most hype-saturated
register and flatter every rule in the set.

**The corpus is committed.** It is not personal writing; it is evidence. A
ceiling nobody can re-derive is a ceiling nobody can check, and a reader with
the repository can regenerate it from the prompts in the frontmatter and see
whether they get the same distribution.

## Consequences

Half the registry becomes calibratable for the price of about $2.50 of
inference, which is the cheapest thing in this project by a wide margin.

The corpus is reproducible in a way a scraped one would not be. Every file
carries the prompt that produced it, so the experiment is repeatable rather
than merely reported.

The costs, and the first is serious:

**It measures one model's default register, on one date.** `claude-opus-5` in
August 2026 is not "machine-written prose"; it is one point in a space that
includes every other model and every future version of this one. A ceiling
calibrated here is a ceiling against this model. A newer model that writes
better prose would move every ceiling down and make the tool look like it had
become lenient — the same false positive ADR 003 identifies for lexicons, one
level up, and there is no lockfile for it yet.

**Length was not specified and turned out to matter.** The generated documents
average 1,241 words while the author's posts run 150–400. Comparing the density
distribution of long machine text against short human text risks measuring
length rather than register, since some rules' densities vary with length.
Nothing here controls for that.

**The Serbian corpus came back in the wrong standard.** Prompted in Serbian
with no other instruction, the model produced text with Croatian syntax and
ijekavian morphology in every document. That is a true fact about the default
register — it is what the model does when asked in Serbian — and it makes the
corpus useless for calibrating Serbian ceilings, because the rules are
ekavica-specific. Fixing it means naming the variant in the prompt. A variant
is not a style instruction, so that is compatible with this ADR; it had simply
not occurred to anyone that it would be needed, which is what a first run is
for. Until it is regenerated, **no Serbian ceiling from this corpus should be
adopted.**

**A model asked for a blog post may produce something unlike what a person
using it to write a blog post would produce.** The realistic adversary is a
human prompting carefully and editing the result, not a bare subject line. This
corpus is the easy case, and a ceiling calibrated against the easy case is a
ceiling that a careful user clears.

**Frontmatter had to be stripped before measurement.** The label contains a
prompt sentence, a model id and a date; left in the text it would add words to
every denominator and put the prompt into the sentence-length distribution —
the corpus measuring its own labels. Caught before the first run, and it is the
kind of thing that would have been invisible in the numbers.

## Alternatives rejected

**Collect machine-written text from the web and label it.** Reintroduces the
judgement, at higher cost, with worse provenance: nobody can prove a scraped
text was generated, so every sample carries an unfalsifiable claim.

**Ask the model to write badly on purpose.** Produces a parody of machine
writing, which is a different distribution and an easier one. The tells the
guide catalogues are the model's defaults, not its idea of bad writing.

**Use the two `samples/machine-*.md` files already in the repository.** They
were written by the author to trip the rules. Calibrating against them would
measure how well the author predicted his own tool.

**Skip ceilings and ship floors only.** Leaves the rules unable to score 0 at
any density, which makes every score a floor-relative number and removes the
top half of the range. Half a calibration is not obviously better than an
honest guess, and it would have been sold as more.
