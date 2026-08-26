# voice-check

A style checker that grades prose against one writer's own rules, in Serbian
and English. You point it at a Markdown file and it tells you where the text
stops sounding like you and starts sounding like a language model.

```
npm run check -- samples/machine-sr.md          # grade prose against the rules
npm run brief -- https://example.com/article    # prepare material from a source
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

**And a rule may abstain.** A density is a rate, and a rate needs a
denominator. A 40-word note containing one perfectly good `međutim` used to
score 0, because at a floor of 4 per 1000 words a single occurrence in a short
text lands at 143 per 1000. That number described arithmetic, not prose. Below
200 words a density rule now declines to measure: not scored, not counted as
passing, excluded from the mean, and listed in the report with its reason
([ADR 005](docs/decisions/005-density-rules-abstain.md)). `Report.score` is
`null` when nothing could be measured — the absence of a claim rather than a
bad one.

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

**0.257** over 13 density rules · 274 words · `sr` · lexicon `0.2.0+…`

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
| `machine-sr.md` | 274 | 0.257 |
| `machine-en.md` | 322 | 0.242 |
| `ordinary-sr.md` | 322 | 0.968 |
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

An example has to be the form that actually broke. The first `spektakular*`
example used the feminine `spektakularne`, which the *broken* stem also
matches — so the guard passed against a dead entry until the example was
changed to the masculine.

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

Every statement carries a quote, and **the quotes are checked against the
source** rather than trusted. The brief prints the ratio — on the live run
below, 12 of 12 found verbatim. A model that paraphrases a quote is not lying,
but a statement traced to text that is not in the source is traced to nothing,
and you are entitled to know which one you are holding.

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
**Traceability:** 12 of 12 quotes found verbatim in the source.

**Cost:** $0.1024 · 6778 in / 2741 out · `claude-opus-5` · rates as of 2026-06-24
```

Measured at the client seam, printed on every brief. Knowing what a brief costs
is the difference between a tool and a demo. `costUsd` returns `null` for a
model with no published rate rather than a zero, because a zero sums into a
total that reads as authoritative.

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

**`verbal-adverb-close` — still fires, and cannot be fixed the same way.**
`reći` in `neće ništa reći` is an infinitive, not a verbal adverb. The rule
matches `-ći` because the guide names `-ći`, and `-ći` is also the Serbian
infinitive ending. This rule reads no lexicon — it is a regular expression in
TypeScript — so it has no entry to hang an exception on. **That asymmetry is
the day-two finding**: the suppression mechanism only reaches the eight
lexicon-driven rules, and the false positive that most obviously needs it is in
one of the other eight. The fix it wants is a closed list of common infinitives
(`reći`, `ići`, `moći`, `naći`, `doći`), which is a different mechanism again.

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

**What this survey is still missing.** Four texts, all written by the author of
the tool, two of them written specifically to trip it.

## Install and run

Node 22 (`.nvmrc`), Node 20 or newer supported.

```
npm install
npm run check -- <file> [--lang sr|en] [--json]      # grade prose
npm run brief -- <file|url> [--lang sr|en] [--json]  # prepare material (2 API calls)
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

Day two of a one-week project.

**Day one — the checker**

- [x] Domain types — the contract, documented with why rather than what
- [x] Two kinds of rule, with hard failures kept out of the mean
- [x] Continuous density scoring with a documented linear shape
- [x] YAML lexicons validated with Zod, with actionable load errors
- [x] Lexicon version and content hash recorded in every report
- [x] All sixteen rules, registered, with a test that no rule file goes unregistered
- [x] Findings carry line, column and offset from the start
- [x] CLI with markdown and JSON output, exiting 1 only on hard failures

**Day two — closing day one's findings**

- [x] **A density rule may abstain.** Below 200 words it declines to measure
      rather than reporting arithmetic ([ADR 005](docs/decisions/005-density-rules-abstain.md))
- [x] **No dead lexicon entries.** Every entry carries a `matches` example a
      test runs; `doesNotMatch` and `except` encode known false positives in
      the data ([ADR 006](docs/decisions/006-lexicon-entries-carry-their-examples.md))
- [x] Language detection votes on stopwords first, diacritics as a tiebreak
- [x] `bullet-bold-restate` renamed to `bullet-bold-shape` — the name must not
      claim a check the code does not perform
- [x] README and ADR 003 state which eight rules are lexicon-driven

**Day two — the agents**

- [x] Analyst returning structure through a forced tool call, with every
      statement traced to a quote and the quotes verified against the source
- [x] Angles agent, ending each angle in a question back to the writer
- [x] **The refusal**: no drafting agent, as a module with an argument and a
      test that keeps it a decision ([ADR 008](docs/decisions/008-there-is-no-writing-agent.md))
- [x] Both agents behind an injected client; 250 tests, no network, no key
- [x] Usage and cost recorded per call and printed
- [x] `npm run brief` against a file or a URL
- [x] API key read from `.env` by path, never from the environment

**Not done**

- [ ] **Refusing a comparison across lexicon versions.** Recorded, not enforced
      ([ADR 003](docs/decisions/003-lexicons-are-versioned-data.md))
- [ ] **A single calibrated constant.** All 23 are guesses.
      `sentence-uniformity.target-sd` has the clearest path to a measurement
- [ ] **Suppression for the eight non-lexicon rules.** `except` reaches only
      the lexicon-driven half, and `verbal-adverb-close` — the survey's other
      false positive — is in the half it does not reach
- [ ] **A judge for `bullet-bold-shape`**, so it checks restatement not shape
- [ ] **A recorded-fixture test of the real request shape.** Every agent test
      runs against a fake, so a rejected parameter would pass the whole suite
      and fail on the first live call
- [ ] A corpus. Four texts, all written by the author of the tool
- [ ] CI
- [ ] Editor integration — the reason positions are recorded

## Known limitations

Everything here is true of the current commit.

**No constant in this tool has been calibrated against anything.** Twenty-three
distinct guesses — twenty-one take part in a Serbian run, twenty in an English
one — each declared and counted, none measured. The scores discriminate between
the two sample sets by a wide margin (0.24–0.26 against 0.97–0.99), and that is
the only evidence that any of the numbers are in the right place.

**The agents have been run against one article.** Twice. Both runs returned
valid structures and 12-of-12 traceable quotes, which is one data point about
an easy case: a well-structured English essay with clear claims. Nothing has
been run against a transcript, a Serbian source, a badly-written source, or a
source the analyst should refuse to find novelty in.

**The 200-word abstention threshold is a guess.** A better one is derivable per
rule — `1000 / ceiling` words — and was not implemented.

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
