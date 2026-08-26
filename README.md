# voice-check

A style checker that grades prose against one writer's own rules, in Serbian
and English. You point it at a Markdown file and it tells you where the text
stops sounding like you and starts sounding like a language model.

```
npm run check -- samples/machine-sr.md          # grade prose against the rules
npm run brief -- https://example.com/article    # prepare material from a source
npm run calibrate -- ~/drafts                   # what densities do you write at?
```

It is not a general-purpose prose linter and it is not trying to be. The rules
are a compilation of one documented style guide: half of it describes how the
author's voice should sound, and half is a catalogue of the patterns that make
prose read as machine-written, adapted from Wikipedia's *Signs of AI writing*.
Somebody else's guide would produce a different tool.

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

**0.278** over 12 density rules · 274 words · `sr` · lexicon `0.3.0+…`

Hard rules: 2 passed.

## Density rules

| rule | score | measured | findings |
| --- | --- | --- | --- |
| negative-parallelism | 0.00 | 11.63 | 2 |
| weasel-words | 0.00 | 23.26 | 4 |
| editorializing | 0.00 | 11.63 | 2 |
...

### negative-parallelism — 0.00

2 found, 11.63 per 1000 words (clean at or below 0.5, zero at 3)

- `3:47` — "nije samo tehnologija, već"
- `18:5` — "nije mali korak, nego"
```

Four sample texts ship in [`samples/`](samples/), two written to trip the rules
and two written as ordinary prose:

| file | words | score |
| --- | --- | --- |
| `machine-sr.md` | 274 | 0.278 |
| `machine-en.md` | 322 | 0.262 |
| `ordinary-sr.md` | 322 | 0.986 |
| `ordinary-en.md` | 352 | 0.992 |

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

The gate has three outcomes, and the distinction matters: `exact` is
byte-for-byte, `normalized` differs only in whitespace or case — a quote
spanning a line break in a hard-wrapped file — and only `absent` fails. A gate
that conflated the last two would fire on formatting on most real inputs, be
switched off within a week, and take the real check with it.

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

## Calibration: against your own writing

```
npm run calibrate -- <dir> [--lang sr|en]
```

Twenty-three constants are declared as guesses, and nearly every note says the
same thing: *this would be justified by measuring the author's own accepted
drafts, a corpus that does not exist*. That sentence has been in the code since
day one. Writing it is honest; leaving it there forever is not.

`calibrate` reads a directory of texts you consider good and reports, per rule:
how many documents produced a density, the min, median, p90 and max of those
densities, and the floor that distribution would imply — the p90, so that nine
in ten of the writing you already accept passes untouched.

**It recommends. It does not write.** Nothing edits a constant, and that is the
decision rather than an unfinished feature. A tool that tunes its own
thresholds against a corpus it also scores converges on "this writing is
perfect", which is true by construction and carries no information. Moving a
constant is a commit somebody signs
([ADR 011](docs/decisions/011-calibration-recommends.md)).

**No ceiling is derivable and none is offered.** A floor answers "how much of
this appears in writing you accept", which a corpus of accepted writing
contains. A ceiling answers "how much appears in writing that has gone wrong",
which it does not contain at all. Every ceiling cell reads `not derivable`.
Calibrating ceilings needs a second, labelled corpus.

**Every figure carries its own n.** Below ten documents no percentile is
reported at all — the cell says `n=1, too few`, because a 90th percentile of
four values is the largest of the four wearing a statistical hat, and in a
table it looks identical to a percentile of four hundred.

**An abstention is an exclusion, not a zero.** A document too short for a rule
contributes no density. A zero would be a measurement — "this text contains no
weasel words" — and a short text supports no such claim; averaging it in would
drag every floor toward zero in proportion to how many short texts the corpus
happened to contain.

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

**`rule-of-three` — suppressed for one literal list, and that does not
generalise.** It fired on `care about architecture, code quality, and
shipping`, which is an ordinary enumeration in technical prose. There is **no
structural difference** between that and the tricolon tic the guide objects to
— same shape, same punctuation, different intent — so the only available fix
was an `except` naming that exact list. It is in the lexicon with a
`doesNotMatch` guarding it, and it suppresses precisely one sentence. Adding
lists one at a time will not scale, and the honest read is that this rule's
signal is the *rate* rather than any instance.

**What this survey is still missing.** Four texts, all written by the author of
the tool, two of them written specifically to trip it.

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

Day three of a one-week project.

**Day one — the checker**

- [x] Domain types, two kinds of rule, continuous density scoring
- [x] Zod-validated YAML lexicons, versioned and content-hashed
- [x] All sixteen rules registered, with positions on every finding
- [x] CLI with markdown and JSON output, exiting 1 only on hard failures

**Day two — the agents**

- [x] Analyst and angles agent, both through forced tool calls
- [x] The refusal: no drafting agent, as a module with a test that keeps it one
- [x] Injected client, so tests never touch the network
- [x] Usage and cost recorded per call; API key read from `.env` by path

**Day three — measurement**

- [x] **Per-rule abstention, derived** from each rule's ceiling
      (`1000 / ceiling` words). `density.min-words` is deleted — the gate now
      inherits the ceiling's error instead of adding its own
- [x] **An abstaining rule still reports what it found**, marked observed and
      not scored, so a 150-word post produces something usable
- [x] **Exception lists for structural rules** — 32 Serbian `-ći` infinitives,
      each with a `suppresses` example and a test that it is load-bearing
- [x] **Stemmed entries must pin their stem** with examples in two
      grammatical forms. All six Serbian stemmed entries failed the stricter
      check and were fixed
- [x] **Traceability is a gate.** An invented quote fails the run and names
      the statement; `normalized` matches pass, so it cannot fire on formatting
- [x] **`npm run calibrate`** — observes densities across a corpus, reports
      implied floors, refuses to derive ceilings, and writes nothing

**Not done**

- [ ] **A corpus.** The bottleneck everything else waits on. `calibrate` has
      run against two documents and reported that two is not enough
- [ ] **A single calibrated constant.** All 23 are still guesses
- [ ] **A negative corpus** — texts the author labels machine-written. Without
      one, no ceiling can be calibrated, only floors
- [ ] **Refusing a comparison across lexicon versions.** Recorded, not enforced
- [ ] **A record of which figure justified which constant.** Nothing enforces
      that a calibration run happened before a threshold moved
- [ ] **A judge for `bullet-bold-shape`**, so it checks restatement not shape
- [ ] **A recorded-fixture test of the real request shape.** Every agent test
      runs against a fake
- [ ] CI
- [ ] Editor integration — the reason positions are recorded

## Known limitations

Everything here is true of the current commit.

**No constant in this tool has been calibrated against anything.** Twenty-three
distinct guesses, each declared and counted, none measured. `calibrate` now
exists to change that and has been run once, against two documents, which it
correctly refused to draw a conclusion from. The scores discriminate between
the two sample sets by a wide margin (0.26–0.28 against 0.99), and that remains
the only evidence that any of the numbers are in the right place.

**Half the constants cannot be calibrated by the command that exists.** Floors
come from a corpus of accepted writing. Ceilings need a corpus of writing the
author considers machine-written, labelled by him, which nobody has assembled.

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
