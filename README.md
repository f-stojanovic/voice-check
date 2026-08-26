# voice-check

A style checker that grades prose against one writer's own rules, in Serbian
and English. You point it at a Markdown file and it tells you where the text
stops sounding like you and starts sounding like a language model.

```
npm run web                                     # the public page: check, in a browser
npm run check -- samples/machine-sr.md          # grade prose against the rules
npm run brief -- https://example.com/article    # prepare material from a source
npm run calibrate -- ~/drafts --generated corpus/generated/sr
```

It is not a general-purpose prose linter and it is not trying to be. The rules
are a compilation of one documented style guide: half of it describes how the
author's voice should sound, and half is a catalogue of the patterns that make
prose read as machine-written, adapted from Wikipedia's *Signs of AI writing*.
Somebody else's guide would produce a different tool.

## Two surfaces, split on marginal cost

**Public, free, no key — `check`.** One page: a textarea, a language selector,
a submit button, and the report with findings underlined in place. Hono,
server-rendered, **no client JavaScript at all** — a form post, not a fetch, so
it works in a text browser and with scripts disabled. Nothing is stored: no
database, no log of what you pasted, no analytics. The limits (40,000
characters, 20 submissions a minute) are printed on the page rather than
discovered by hitting them.

**Private, CLI only — `brief`.** It makes two Claude calls at about $0.11 a
run, on the author's key. A public endpoint for that is a public endpoint for
spending somebody else's money, and rate limiting does not fix it — it prices
the abuse. The split follows from which half has a per-request cost, and that
will not change when the UI gets nicer
([ADR 013](docs/decisions/013-the-public-surface-splits-on-marginal-cost.md)).

The web report is rendered from the same `check()` the CLI calls — one
implementation, two renderers, so the two cannot disagree about a score. The
underlining uses the `line`/`column`/`offset` recorded on day one, when
[ADR 004](docs/decisions/004-findings-carry-positions.md) justified carrying
them on the strength of an interface that did not exist yet.

## The idea

A rule that lives only in a document is a suggestion. The same rule compiled
into a check is a constraint. Nobody reads the style guide before writing the
paragraph; the check runs whether they read it or not.

This is the third substrate the author has run that idea through. The first was
an architecture decision compiled into a static-analysis rule, so that the
layering agreed in a meeting stops being a thing people remember and starts
being a thing the build knows. The second was
[agent-evals](https://github.com/f-stojanovic/agent-evals): an eval case
compiled into a CI gate, so that a model regression fails a build instead of
being noticed three weeks later. This one is a style rule compiled into a check
on prose.

The substrates are unrelated. The move is the same one every time: take the
sentence somebody wrote down, and make something execute it.

## Two kinds of rule

A style guide contains two different kinds of sentence, and flattening them
into one severity scale is the mistake this tool is built to avoid
([ADR 001](docs/decisions/001-two-kinds-of-rule.md)).

**Hard rules.** One violation fails, full stop. Serbian text containing none of
`š đ č ć ž` is not slightly worse prose — `ceo` and `ćeo` are different words,
and a reader who has to guess is reading a defect. The guide's rule about
address is equally absolute: always `ti`, never `Vi`. Hard failures are listed
separately and contribute **nothing** to the score. A text without diacritics
is not "0.7 good".

**Density rules.** Measured per 1000 words and scored continuously, because the
guide's own objection is not to any single word. One `međutim` is a transition.
Nine per thousand words is a machine. A boolean check would report the same
thing about both, throwing away exactly the signal the tool exists to measure
([ADR 002](docs/decisions/002-scores-are-continuous.md)).

**And a rule may abstain — at a threshold derived from its own ceiling.** A
density is a rate, and a rate needs a denominator. A rule can say nothing
about a text until one occurrence is distinguishable from its own ceiling,
which is `1000 / ceiling` words: 167 for a default phrase rule, **334 for
`negative-parallelism`**, whose ceiling is tightest.

That number is derived, not guessed, and it replaced a guess. Day two used a
single `density.min-words = 200` for every rule. It cost a real measurement:
`negative-parallelism` scored **0.00 on a single occurrence in a 258-word
text**, because 1/258 is 3.88 per thousand against a ceiling of 3. The style
guide asks for that construction "extremely rarely". One in 258 words is rare.
The rule was right to notice and wrong to grade it
([ADR 005](docs/decisions/005-density-rules-abstain.md)).

**An abstaining rule still reports what it found**, marked as observed and not
scored. Most of the author's posts are 150–400 words, and day two's version
answered a 139-word post with thirteen abstentions and nothing else. "Here is
what I noticed, I cannot give you a rate for it" is useful. Silence is not
more honest — the rule did look.

`Report.score` is `null` when nothing could be measured: the absence of a
claim rather than a bad one.

The CLI exits 1 on a hard failure and 0 otherwise, **whatever the score**. A
low score is a number to read and argue with, not a gate — the moment a good
piece fails CI at 0.79, the score becomes a threshold people route around.

## What it measures

Sixteen rules. Twelve apply to both languages, three are Serbian-only, one is
English-only. A Serbian run uses fifteen of them, an English run thirteen.

The **source** column matters more than it looks: only eight rules read the
lexicon, and only six of those are phrase lists a writer can extend without
touching code. The other eight are morphology, structure or statistics, and
changing them means changing TypeScript.

| rule | kind | languages | source | what it looks for |
| --- | --- | --- | --- | --- |
| `diacritics` | hard | sr | code | Serbian text with no `š đ č ć ž` in it |
| `formal-address` | hard | sr | code | `Vi` / `Vas` / `Vam` / `Vaš` capitalised mid-sentence |
| `negative-parallelism` | density | sr, en | regex | `nije X, već Y` · `not just X but Y` · `it's not X, it's Y` |
| `weasel-words` | density | sr, en | **phrases** | attribution that attributes nothing |
| `editorializing` | density | sr, en | **phrases** | the narrator telling you how to feel about the next sentence |
| `promotional-tone` | density | sr, en | **phrases** | adjectives that do the reader's reacting for them |
| `inflated-vocabulary` | density | sr, en | **phrases** | the long word standing where a short one would do |
| `summary-close` | density | sr, en | **phrases** | the paragraph that restates the piece to someone who just read it |
| `transition-density` | density | sr, en | **phrases** | good connectives, too many of them |
| `rule-of-three` | density | sr, en | regex | `X, Y i Z` — a list whose real length was two or five |
| `bullet-bold-shape` | density | sr, en | code | `- **Word:** …` — the *shape* only, see below |
| `verbal-adverb-close` | density | sr | code | `-jući` / `-ći` immediately before a sentence end |
| `participial-close` | density | en | code | an `-ing` clause closing a sentence |
| `em-dash-density` | density | sr, en | code | `—` per 1000 words |
| `bold-ratio` | density | sr, en | code | bolded characters per 1000 characters |
| `sentence-uniformity` | density | sr, en | code | standard deviation of sentence length — **low scores badly** |

`sentence-uniformity` is the only rule that is a statistic rather than a
pattern, and the only one that cannot be satisfied by search-and-replace.
Delete the em dashes and swap `delve` for `look at` and every other number
moves without the writing changing. This one does not move until the sentences
do.

`bullet-bold-shape` detects the shape and **not** the defect. Whether the
sentence after the colon merely restates the bolded word needs a model reading
both halves, which is a later day and will need calibrating against labelled
examples before its output is trusted. Until then its count is an upper bound,
and the report says "shape only" rather than pretending otherwise.

## What a report looks like

```
# voice-check: samples/machine-sr.md

**0.278** over 12 density rules · 274 words · `sr` · lexicon `0.3.0+a1e590743b64`

Hard rules: 2 passed.

## Not measured (1)

- `negative-parallelism` — not scored: 274 words. One occurrence here is 3.65
  per 1000, at or above this rule's ceiling of 3, so a single ordinary use
  would score 0. Needs 334 words (1000 / 3)

### Observed, not scored

**negative-parallelism** — 3 found

- `3:47` — "nije samo tehnologija, već"
- `18:5` — "nije mali korak, nego"
- `23:49` — "nije tehnički projekat, nego"

## Density rules

| rule | score | measured | findings |
| --- | --- | --- | --- |
| weasel-words | 0.00 | 14.60 | 4 |
| editorializing | 0.00 | 7.30 | 2 |
| promotional-tone | 0.00 | 14.60 | 4 |
| inflated-vocabulary | 0.00 | 25.55 | 7 |
...
```

Note what the abstention costs there. Three `nije … već` constructions in 274
words is plainly the pattern the rule exists for, and the rule still declines
to score it, because the gate is a property of the text's LENGTH and not of
what was found in it. The findings are reported rather than swallowed — that
is what "observed, not scored" is for — but the number is missing from a case
where the signal is strong. The gate as derived protects a single ordinary use
and cannot tell that apart from a third one.

Four sample texts ship in [`samples/`](samples/), two written to trip the rules
and two written as ordinary prose:

| file | words | score |
| --- | --- | --- |
| `machine-sr.md` | 274 | 0.278 |
| `machine-en.md` | 322 | 0.262 |
| `ordinary-sr.md` | 322 | 0.986 |
| `ordinary-en.md` | 352 | 0.992 |

Those four are the author's own guesses at good and bad prose. The generated
corpus in `corpus/generated/` is the first evidence in this project that did
not come from him, and it disagrees with two of them — see below.

The two machine samples were 172 and 199 words on day one. They had to be
lengthened, because at that length every density rule now abstains and the
report scores `null`. That is the cost of the abstention rule arriving, and it
is the honest version of what the tool can say about a short text.

`--json` emits the `Report` instead.

## Lexicons are versioned data

Phrase lists live in [`lexicons/`](lexicons/) as YAML, validated with Zod on
load, so adding a tell is a one-line diff a writer can make.

That convenience has a consequence: **changing a lexicon changes every score**,
uniformly and quietly, in exactly the shape of prose getting better or worse.
Each file declares a `version` and the loader hashes its content; both go into
`Report.lexiconVersion`. The declared version catches the edit somebody
remembered to record, and the hash catches the one they did not — which, on day
one of this repository, was already the common case
([ADR 003](docs/decisions/003-lexicons-are-versioned-data.md)).

Comparing two reports across different lexicon versions must eventually be
**refused**, the way agent-evals refuses a baseline recorded against a different
model. That is not built yet and the TODO says so.

### Every entry carries the example that proves it works

Two entries in the first version of `lexicons/sr.yaml` matched nothing at all —
`neverovatn*` and `spektakularn*`, both broken on the Serbian fleeting `a`,
whose masculine forms are `neverovatan` and `spektakularan`. The lists looked
full. Every report they appeared in was clean for the wrong reason, and nothing
in the tool distinguished an entry that found nothing from an entry that looked
and approved — the same failure this project exists to catch, occurring inside
its own data.

So an entry is now an object:

```yaml
- phrase: ključ*
  matches: "Ovo je ključan trenutak."
  doesNotMatch: "Ključna reč u celoj priči je postepeno."
  except:
    - ključna reč
    - ključne reči
```

`matches` is mandatory and a test runs every entry against it, so a dead entry
fails the build with its own text in the message. `doesNotMatch` is where a
known false positive is recorded — it turns a README paragraph into an
assertion. `except` suppresses a match inside a containing literal phrase, and
is the suppression mechanism deliberately withheld on day one until the survey
said what shape it needed ([ADR 006](docs/decisions/006-lexicon-entries-carry-their-examples.md)).

### The examples have to pin the stem

An example has to be the form that actually broke. The first `spektakular*`
example used the feminine `spektakularne`, which the *broken* stem
`spektakularn*` also matches — so the guard passed against a dead entry.

That is now a mechanical check rather than a thing to remember. A stemmed
entry must carry examples whose matched forms share **no prefix longer than
the declared stem**: if they did, a longer stem would pass the same examples
and they prove nothing. Under the stricter rule **all six stemmed Serbian
entries failed** — every one had a single example — and each gained a second
grammatical form:

```yaml
- phrase: kompleks*
  matches: "Materija je kompleksna."
  alsoMatches:
    - "Problem je kompleksan."      # the fleeting -a- the broken stem missed
```

### Structural rules get exception lists too

`except` reaches the eight rules that read phrase lists. The other eight are
regular expressions, and day one's second false positive was in that half:
`verbal-adverb-close` fires on `reći` in `neće ništa reći`, because `-ći` is
both the verbal-adverb ending the guide names and the Serbian infinitive
ending. It had nowhere to be fixed.

An `exceptions:` block gives it somewhere. The rule stays a regex; the 32
infinitives it must not fire on are data. Each carries a `suppresses` example,
and the test asserts **both** halves — that the rule fires on that text with
exceptions removed, and does not with them applied. An exception that
suppresses nothing is as dead as a phrase that matches nothing.

The English list is deliberately short — `nothing`, `something`, `anything`,
`everything`, `during`, `morning`, `evening`. `meaning`, `warning` and
`feeling` are **not** exempted: `, meaning the job fails silently` is exactly
the construction the rule exists for. An exception list that grows by adding
whatever last annoyed somebody ends up suppressing the rule.

## Uncalibrated constants

Every report ends with a count:

```
This run used 20 uncalibrated constants:
  density.phrase-ceiling = 6 — matches per 1000 words at which a phrase rule
    scores 0; should be where known machine-written text actually sits,
    measured rather than assumed
  ...
```

Nothing measured says three transitions per thousand words is fine and five is
not. Every threshold in this tool is a guess, so every one is declared with a
note saying what would have to be measured to justify it, and the report says
how many took part. The mechanism is
[agent-evals ADR 010](https://github.com/f-stojanovic/agent-evals/blob/main/docs/decisions/010-uncalibrated-constants-are-counted.md),
including the part that repository learned the hard way: constants belong to
the rule that guessed them, not to a global registry, so the count describes
the run rather than the import graph.

The count is a **floor** on how many assumptions a run made, never the total.
Nothing stops the next constant being written as a bare `0.75`.

## The brief: two agents, and one deliberate refusal

```
npm run brief -- <file|url> [--lang sr|en] [--json]
```

The checker grades prose that already exists. The brief prepares material for
prose that does not. It reads a source and produces, through two Claude calls:

**The analyst** — what the source actually claims, what it offers in support
(data, a demonstration, an anecdote, a citation, or nothing), what in it is
genuinely new versus restated, what it asserts without support, and what it
leaves open. Returned through a **forced tool call** with `strict: true`, never
as prose to be parsed ([ADR 007](docs/decisions/007-the-analyst-returns-structure.md)).

Every statement carries a quote, and **the quotes are a gate, not a
statistic**. `analyse` checks each one against the source and a quote that is
not there **fails the run** — the analysis is discarded and the command exits
7, naming the field, the statement and the quote.

Day two printed the ratio under the report. A number nobody compares against
anything is an observation; this is the one number here that can be a control,
because it is the one claim the analyst makes that is not judgement. Whether a
point is "genuinely new" is arguable. Whether a sentence is in the document is
not ([ADR 010](docs/decisions/010-the-analyst-has-one-mechanical-check.md)).

**The gate claims a consequence, not a cause.** An earlier version said a
missing quote meant the model invented it. It is one possibility of four: the
model fabricated it; the extractor damaged the source; the source changed
between fetch and check; or the model *translated* it. What is certain is the
consequence — this analysis cannot be relied on — and the failure message says
that and lists the causes rather than asserting one.

One cause is diagnosable and gets its own outcome. A quote in a different
script from the source, or an English quote of a Serbian source, was not copied
out of it. The four outcomes are `exact` (byte-for-byte), `normalized`
(whitespace or case only — a quote spanning a line break), `foreign`
(missing and in another script or language) and `absent`. The first two pass;
a gate that failed on `normalized` would fire on formatting on most real
inputs, be switched off within a week, and take the real check with it.

Translation is the likeliest Serbian failure and **has never been observed**,
because no Serbian source has been run through `brief`.

Empty is an answer. `novelty.genuinelyNew: []` is a value the system prompt
explicitly asks for, and the brief prints **"Nothing genuinely new"** in bold
when it comes back empty. An analyst that always finds novelty is a flattery
machine with a JSON schema.

**The angles agent** — two or three angles for a specific audience, each with a
hook, why that audience would care, and a **question back to you**: which of
your own experiences does this touch? That last field is the one that earns the
tool its place. From the live run:

> **Your turn:** Sećaš li se konkretnog spora — u firmi, u timu, sa klijentom —
> koji je nestao u trenutku kad je neko definisao termin? I obrnuto: spor gde
> si ti bio taj koji je mesecima koristio reč misleći da je svima jasna?

No model has that answer.

### There is no third agent

Turning the brief into a post is the writer's job. The drafting agent is the
easiest of the three to build — the analysis is structured, the audience is
described, the angles exist, and there is a style checker in the next directory
to grade the output — and it is not being built.

The style guide this repository compiles is, in its second half, a catalogue of
what prose looks like when there is nothing behind it. A drafting agent has
exactly that problem, necessarily: it has no experience to draw on. It would
produce that prose, and the checker next door would grade it, closing a loop
whose output is a text that passes a check and has nobody behind it. That is
worse than no tool, because it would be fast.

The boundary is not a limitation to be lifted when the models improve. Better
models make the draft more fluent; fluency was never the missing part.

The decision has a file — `src/agents/no-writer.ts` — and a test asserting the
set of agents is exactly two, so adding a third fails the build and sends
whoever adds it to read the argument first
([ADR 008](docs/decisions/008-there-is-no-writing-agent.md)).

### What a run costs

```
**Traceability:** 12 of 12 quotes found in the source — 12 exact. A quote that
was not there at all would have failed this run.

**Cost:** $0.1024 · 6778 in / 2741 out · `claude-opus-5` · rates as of 2026-06-24
```

Measured at the client seam, printed on every brief. `costUsd` returns `null`
for a model with no published rate rather than a zero, because a zero sums
into a total that reads as authoritative.

**Cost and latency are compared against nothing.** There is no budget, no
baseline, and no run has ever failed because of either — they are observations,
and a printed number reads as a control, so it is worth saying. A baseline
needs a fixed set of cases to be a baseline of, and `brief` runs against
whatever URL you pass it. Two runs against different sources have no cost
relationship for a gate to compare.

### The key comes from a file, by path

`.env` at the project root, read with `dotenv.parse`, which does not touch
`process.env`. An `ANTHROPIC_API_KEY` exported in your shell is **ignored**,
and so is an `ant auth login` profile. The zero-argument `new Anthropic()` would
find all of those, which is convenient in a terminal and a hazard in a tool
that spends money: a run authenticated by a credential nobody in this
repository chose succeeds identically to one that was.

### Agents are injected, so tests never call the network

Both agents take a `ModelClient`. The whole suite runs offline, in under a
second, with no key — including tests for a malformed tool call, an API error,
an unpriced model, and an empty source. Two of those cannot be produced on
demand against the live API
([ADR 009](docs/decisions/009-agents-are-injected.md)).

The gap this leaves is named rather than hidden: nothing in the suite tests the
real request shape, so a rejected parameter would pass every test and fail on
the first live call.

### Reading a URL

Extraction is deliberately crude — drop scripts, styles, nav, header, footer;
prefer `<article>` or `<main>`; strip tags; decode entities. **It will fail on**
JavaScript-rendered pages (most product blogs), paywalls and consent walls
(which it will happily hand to the analyst as if they were the article), pages
with no `<article>` or `<main>` (navigation text ends up in the source), PDFs,
anything needing a login, and non-UTF-8 pages. A word-count floor turns the
most common of those into an error instead of an analysis of an empty div.

When a page reads wrong, save it as Markdown and pass the file.

## Calibration: two corpora, and one of them is free

```
npm run corpus:generate -- --lang sr|en --count 15 --out corpus/generated/sr
npm run calibrate -- <accepted-dir> --generated corpus/generated/sr
```

Twenty-three constants are declared as guesses. Day three built `calibrate` and
found the wall: **a corpus of writing you accept gives a floor and never a
ceiling**, because it contains no information about where writing that has gone
wrong sits. That left half the registry uncalibratable, waiting on a corpus
nobody had assembled.

That corpus turns out to be free, because machine-written text can be generated
rather than found.

### The provenance is the label

`corpus:generate` asks the model for blog posts on ordinary subjects — coffee
grinders, compound interest, sourdough, moving city — and writes back what
comes out. Each file carries its own frontmatter:

```yaml
---
provenance: generated
subject: sourdough-howto
model: claude-opus-5
generated: 2026-08-26
words: 1422
prompt: Write a blog post about how to make sourdough bread.
---
```

**A text in that directory is machine-written because a machine wrote it.** No
annotator decides, nobody disagrees, and there is nothing for a second reader
to check. That is the *inverse* of the labelling problem in agent-evals rather
than a repeat of it: there, a label was a judgement about a model's output and
a model could not be trusted to make it. Here the judgement has moved entirely
to the other corpus — "I consider this good" is exactly the call a model cannot
make for you ([ADR 012](docs/decisions/012-the-negative-corpus-is-generated.md)).

**The prompts carry no style instruction.** No tone, no audience, no length,
not "write engagingly" and not "avoid clichés" — and no system prompt either,
because *you are a helpful assistant* is a style instruction wearing a
different hat. The measurement is the **default register**, which is what a
ceiling is supposed to describe.

The corpus is committed, in [`corpus/generated/`](corpus/generated/). It is not
personal writing, it is evidence, and a ceiling nobody can re-derive is a
ceiling nobody can check — every file carries the prompt that produced it, so
the experiment is repeatable rather than merely reported. A test asserts every
committed file is labelled, so a hand-written text dropped into the directory
cannot be silently counted as machine-written.

### Floors, ceilings, and rules that cannot separate

The floor goes at the **90th percentile of accepted writing** — nine documents
in ten of what you already accept pass untouched. The ceiling goes at the
**10th percentile of generated writing** — nine in ten generated documents
score zero. The gap between them is the rule's usable band.

**When the two overlap, the report says so and stops.** If the ceiling lands at
or below the floor, no pair of thresholds separates the distributions and the
rule cannot tell machine from human at any setting. That is a finding about the
rule, not a failed run — the same shape as agent-evals discovering its semantic
threshold could not classify its own labelled pairs, and recording the negative
result instead of inventing a number.

**It still only recommends.** Nothing edits a constant. A tool that tunes its
thresholds against a corpus it also scores converges on "this writing is
perfect", which is true by construction
([ADR 011](docs/decisions/011-calibration-recommends.md)).

**Every figure carries its own n.** Below ten documents no percentile is
reported at all, because a p90 of four values is the largest of the four
wearing a statistical hat and looks identical in a table to a p90 of four
hundred.

**An abstention is an exclusion, not a zero.** A document too short for a rule
contributes no density. A zero would be a measurement the text does not
support.

### The first run, verbatim

Accepted corpus: the author's `scratch/` — **two documents, 397 words**, which
is nowhere near enough and the report says so on every line. Generated corpus:
**30 documents, 33,621 words**. Every verdict below reads `too few`, because
the accepted side has an n of 1.

What the generated side shows is not `too few`, and it is the finding.

```
## en — 1 accepted, 15 generated

| rule                 | generated n / min / median / max |
| weasel-words         | n=15 | 0.00 | 0.00 |  0.00 |
| editorializing       | n=15 | 0.00 | 0.00 |  0.00 |
| promotional-tone     | n=15 | 0.00 | 0.00 |  0.00 |
| summary-close        | n=15 | 0.00 | 0.00 |  0.00 |
| transition-density   | n=15 | 0.00 | 0.00 |  0.00 |
| negative-parallelism | n=15 | 0.00 | 0.00 |  0.86 |
| inflated-vocabulary  | n=15 | 0.00 | 0.00 |  0.91 |
| participial-close    | n=15 | 0.00 | 2.21 |  4.12 |
| rule-of-three        | n=15 | 0.00 | 1.47 |  5.05 |
| bullet-bold-shape    | n=15 | 0.00 | 2.99 | 11.74 |
| em-dash-density      | n=15 | 5.44 |10.72 | 16.01 |
| bold-ratio           | n=15 | 0.00 |47.18 | 76.30 |
| sentence-uniformity  | n=15 | 5.88 | 7.75 | 10.06 |
```

Five rules have a **maximum of zero across fifteen machine-written
documents**. Two more never exceed 1 per thousand words. The four with real
signal are `em-dash-density`, `bold-ratio`, `bullet-bold-shape` and
`participial-close` — typography, structure and rhythm.

### What that means, and it is not what the guide predicts

Across **18,612 words** of machine-written English — 15 blog posts, no style
instruction — the phrase catalogue that makes up most of the rule set fired
almost not at all:

| tell | occurrences in 18,612 machine-written words |
| --- | --- |
| `delve`, `landscape`, `synergy`, `empower`, `robust`, `seamless`, `tapestry` | 0 |
| `leverage` | 2 |
| `incredible`, `stunning`, `breathtaking` | 0 |
| `experts say`, `many believe`, `reports suggest`, `critics argue` | 0 |
| `in conclusion`, `all in all`, `to summarize` | 0 |
| `however`, `moreover`, `furthermore`, `additionally`, `on the other hand` | **0** |
| — (em dash) | **202** |
| `**bold**` runs | **232** |

Six phrase rules never fired on any of the fifteen documents. `transition-density`
found nothing at all: not one `however` in eighteen thousand words.

**The rules that separate machine from human are typographic and structural,
not lexical.** `em-dash-density`, `bold-ratio`, `bullet-bold-shape` and
`sentence-uniformity` all show a usable band. The phrase rules — the ones
adapted most directly from Wikipedia's *Signs of AI writing* — cannot separate
the two corpora at any threshold, because the machine text does not contain the
phrases.

That catalogue describes a distribution of models across several years. It does
not describe `claude-opus-5` in August 2026, and this project had assumed it
did. The word lists are not wrong about what bad prose looks like; they are
measuring a register this model no longer writes in.

### The Serbian half came back in the wrong language

Prompted in Serbian, with no other instruction, the model wrote Croatian.
Across the Serbian corpus: **77 `što` against 29 `šta`**, and **58 ijekavian
forms** (`vrijeme`, `svjetlo`, `prije`) — every document affected, five of them
heavily.

The Serbian rules are ekavica-specific, so a ceiling calibrated against that
half would be a ceiling for a language the author does not write. **No Serbian
ceiling from this corpus should be adopted.** The English half is unaffected.

The fix is to name the variant in the prompt, which is a *language* constraint
rather than a style one and so is compatible with the design. It had not
occurred to anyone that it would be needed, which is what a first run is for.

Two things follow, and neither is "delete the phrase rules". They still catch
those phrases when a human writes them, which is what the *first* half of the
style guide asks for. But their ceilings cannot be calibrated against this
corpus, and any claim that they detect machine writing is now falsified for
this model.

## False positives: what fires on prose that is fine

Day one surveyed these. Day two encoded what could be encoded and left the rest
on the record.

`samples/ordinary-sr.md` is 322 words of ordinary Serbian written for the
purpose — a post about a slow query and a stale statistics table. It scored
**0.936** on day one and scores **0.968** now. What changed:

**`inflated-vocabulary` — fixed in the lexicon.** `Ključna` in `Ključna reč u
celoj priči` was the clearest false positive in the set: `ključan` is in the
guide's inflated list and is also the only ordinary word for "keyword". The
entry now carries `except: [ključna reč, …]` and a `doesNotMatch` counter-example,
so widening the stem fails the build instead of quietly accusing an ordinary
sentence. The entry still fires on `ključan trenutak`, which is the usage the
guide objects to, and a test asserts both halves.

**`verbal-adverb-close` — fixed on day three.** `reći` in `neće ništa reći` is
an infinitive, not a verbal adverb. Day two could not fix it: the rule is a
regex with no lexicon entry to hang an exception on. Day three gave structural
rules their own `exceptions:` block, and the 32 common `-ći` infinitives are
now data. `ići` and `ući` are deliberately absent — the pattern needs two
letters before `-ći`, so they never fire and an exception for them would be
dead.

**`sentence-uniformity` — not a false positive, an uncalibrated constant.**
Standard deviation 5.02 against an invented target of 6.0. The text reads fine.
This remains the single most tractable calibration in the project.

`samples/ordinary-en.md` scores **0.992**, with only `sentence-uniformity`
below 1.0. That is not evidence the English rules are cleaner, it is evidence
that one text is not a corpus. The known English noise source is
`participial-close`, which fires on any `-ing` word after a comma and so
catches adjectives — `The output was long, boring and repetitive.` — as
readily as participles. It is asserted as a known false positive in its own
test file.

**`rule-of-three` — a suppression was added and then reverted the same day.**
It fired on `care about architecture, code quality, and shipping`, an ordinary
enumeration in technical prose, and an `except` naming that literal list was
added. It was removed within hours: `DDD, TDD i code review` turned up in
another real post with exactly the same shape, and the list of literals to
suppress is unbounded.

There is **no structural difference** between an ordinary three-item list and
the tic — same shape, same punctuation, different intent — so a per-instance
exception is a category error inside a rule that measures a **rate**. One
tricolon is not a finding; twelve per thousand words is. The lever is the
floor, and the floor is what a corpus settles.

**What this survey is still missing.** Four texts, all written by the author of
the tool, two of them written specifically to trip it.

## The corpora

```
corpus/generated/sr/   15 Serbian blog posts, machine-written by construction
corpus/generated/en/   15 English, the same 15 subjects
```

Committed. Each file carries `provenance: generated`, the model, the date and
the exact prompt. Regenerate with:

```
npm run corpus:generate -- --lang sr --count 15 --out corpus/generated/sr
```

The accepted corpus is not in this repository and is not going to be — it is
the author's own writing. Point `calibrate` at wherever it lives.

## Install and run

Node 22 (`.nvmrc`), Node 20 or newer supported.

```
npm install
npm run check -- <file> [--lang sr|en] [--json]      # grade prose
npm run brief -- <file|url> [--lang sr|en] [--json]  # prepare material (2 API calls)
npm run calibrate -- <dir> [--lang sr|en]            # observe your own densities
npm test
npm run typecheck
npm run build
```

`check` is deterministic and offline. `brief` calls Claude twice and needs
`.env`:

```
cp .env.example .env   # then put a real key in it
```

`--lang` is optional. Without it, language is detected by a **stopword vote**,
with diacritics only breaking a tie.

That order is a day-two fix. Day one looked for `š đ č ć ž` first, which put
detection and the `diacritics` hard rule on the same signal reading it in
opposite directions: Serbian with its diacritics stripped is exactly the text
the hard rule exists to catch, and exactly the text the detector would have
handed to the English rules. The rule could only fire on texts detection had
already half-refused. Function words survive a stripped keyboard layout, so the
detector now says "Serbian" and `diacritics` gets to do its job.

It is still a heuristic and it will still be wrong sometimes. `--lang` is the
right answer whenever it is known.

## Status

Day four of a one-week project.

**Days one to three**

- [x] Sixteen rules, two kinds, continuous scoring, positions on every finding
- [x] Zod-validated YAML lexicons, versioned and content-hashed, every entry
      carrying the example that proves it works
- [x] Per-rule abstention derived from each rule's own ceiling
- [x] Analyst and angles agents through forced tool calls; no drafting agent
- [x] Traceability as a gate; injected client, so tests never touch the network
- [x] `calibrate` — observes densities, recommends, writes nothing

**Day four**

- [x] **The negative corpus, generated.** 15 Serbian and 15 English documents
      on ordinary subjects, no style instruction, ~$2.50 of inference. Each
      labelled by its own frontmatter — the provenance *is* the label, so
      nothing here needed an annotator
- [x] **`calibrate` takes both corpora** and reports floor, ceiling, margin,
      and — the part that matters — **which rules cannot separate them at any
      threshold**
- [x] **The `rule-of-three` suppression reverted.** A per-instance exception
      inside a rule that measures a rate is a category error, and a second real
      case proved it the same day
- [x] **The traceability gate reframed** around the consequence, with a
      `foreign` outcome for the one cause it can actually diagnose
- [x] **The public page** — `check` only, server-rendered, no client
      JavaScript, nothing stored, limits printed on the page
- [x] The ADR dates corrected: 005–011 carried dates incremented by hand rather
      than read from a clock

**Not done**

- [ ] **The accepted corpus.** Still the bottleneck. The negative half now
      exists; the half only a human can label does not
- [ ] **A single calibrated constant.** Ceilings are now derivable and none
      has been adopted — that is a commit the author signs, not the tool
- [ ] **A lockfile for the generating model.** The ceiling is calibrated
      against `claude-opus-5` in August 2026. A better model would move every
      ceiling and look like the tool going lenient — ADR 003's problem, one
      level up, unsolved
- [ ] **Length is uncontrolled** between the corpora. Generated documents
      average 1,241 words; the author's posts run 150–400
- [ ] Deployment. The page runs locally and has never seen traffic
- [ ] Refusing a comparison across lexicon versions
- [ ] A judge for `bullet-bold-shape`; a recorded-fixture test of the real
      request shape; CI

## Known limitations

Everything here is true of the current commit.

**No constant in this tool has been calibrated against anything.** Twenty-three
distinct guesses, each declared and counted, none measured. Ceilings are now
*derivable* — the negative corpus exists — and none has been adopted, because
adopting one is the author's commit and not the tool's.

**The accepted corpus still does not exist**, so no floor has a figure behind
it either. The negative half was the half that could be automated; the half
that needs a human to say "I consider this good" is the half that is left.

**The ceiling is calibrated against one model on one date.** `claude-opus-5` in
August 2026 is not "machine-written prose", it is one point in a space. A newer
model that writes better would move every ceiling down and look exactly like
the tool becoming lenient — ADR 003's failure mode, one level up, with no
lockfile.

**Length is not controlled between the corpora.** The generated documents
average 1,241 words against 150–400 for the author's posts, so a rule whose
density varies with length would show a separation that is partly about length.

**The agents have been run against one article.** Three times. Both runs returned
valid structures and 12-of-12 traceable quotes, which is one data point about
an easy case: a well-structured English essay with clear claims. Nothing has
been run against a transcript, a Serbian source, a badly-written source, or a
source the analyst should refuse to find novelty in.

**The abstention gate is now derived, which moves the guess rather than
removing it.** `1000 / ceiling` inherits whatever error is in the ceiling. If a
ceiling is wrong, so is the length at which the rule starts speaking.

**The corpus is four texts and two of them are targets.** `machine-sr.md` and
`machine-en.md` were written to trip the rules. A tool scoring the text written
to trip it is not a finding.

**Words inside fenced code blocks are counted as words.** This inflates the
denominator of a technical post and so understates every density in it.
Stripping code fences means a parser.

**`-ći` and `-ing` are not reliable markers**, and the two rhythm rules are not
comparable across languages for that reason. Serbian `-jući` marks a verbal
adverb; English `-ing` marks whatever it likes.

**Abbreviations end sentences.** `npr.` and `tj.` split a sentence that Serbian
does not. This shortens the mean and inflates the count, which pushes
`sentence-uniformity` in the forgiving direction — the error cannot manufacture
a failure.

## Decisions

- [001. Two kinds of rule: hard and density](docs/decisions/001-two-kinds-of-rule.md)
- [002. Scores are continuous, because the objection is accumulation](docs/decisions/002-scores-are-continuous.md)
- [003. Lexicons are versioned data, and a score is only comparable within a version](docs/decisions/003-lexicons-are-versioned-data.md)
- [004. Findings carry positions from the start](docs/decisions/004-findings-carry-positions.md)

## License

MIT © 2026 Filip Stojanović
