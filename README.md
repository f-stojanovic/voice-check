# voice-check

A style checker that grades prose against one writer's own rules, in Serbian
and English. You point it at a Markdown file and it tells you where the text
stops sounding like you and starts sounding like a language model.

```
npm run check -- samples/machine-sr.md
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

The CLI exits 1 on a hard failure and 0 otherwise, **whatever the score**. A
low score is a number to read and argue with, not a gate — the moment a good
piece fails CI at 0.79, the score becomes a threshold people route around.

## What it measures

Sixteen rules. Twelve apply to both languages, three are Serbian-only, one is
English-only. A Serbian run uses fifteen of them, an English run thirteen.

| rule | kind | languages | what it looks for |
| --- | --- | --- | --- |
| `diacritics` | hard | sr | Serbian text with no `š đ č ć ž` in it |
| `formal-address` | hard | sr | `Vi` / `Vas` / `Vam` / `Vaš` capitalised mid-sentence |
| `negative-parallelism` | density | sr, en | `nije X, već Y` · `not just X but Y` · `it's not X, it's Y` |
| `weasel-words` | density | sr, en | attribution that attributes nothing |
| `editorializing` | density | sr, en | the narrator telling you how to feel about the next sentence |
| `promotional-tone` | density | sr, en | adjectives that do the reader's reacting for them |
| `inflated-vocabulary` | density | sr, en | the long word standing where a short one would do |
| `summary-close` | density | sr, en | the paragraph that restates the piece to someone who just read it |
| `transition-density` | density | sr, en | good connectives, too many of them |
| `rule-of-three` | density | sr, en | `X, Y i Z` — a list whose real length was two or five |
| `bullet-bold-restate` | density | sr, en | `- **Word:** …` — the *shape* only, see below |
| `verbal-adverb-close` | density | sr | `-jući` / `-ći` immediately before a sentence end |
| `participial-close` | density | en | an `-ing` clause closing a sentence |
| `em-dash-density` | density | sr, en | `—` per 1000 words |
| `bold-ratio` | density | sr, en | bolded characters per 1000 characters |
| `sentence-uniformity` | density | sr, en | standard deviation of sentence length — **low scores badly** |

`sentence-uniformity` is the only rule that is a statistic rather than a
pattern, and the only one that cannot be satisfied by search-and-replace.
Delete the em dashes and swap `delve` for `look at` and every other number
moves without the writing changing. This one does not move until the sentences
do.

`bullet-bold-restate` detects the shape and **not** the defect. Whether the
sentence after the colon merely restates the bolded word needs a model reading
both halves, which is a later day and will need calibrating against labelled
examples before its output is trusted. Until then its count is an upper bound,
and the report says "shape only" rather than pretending otherwise.

## What a report looks like

```
# voice-check: samples/machine-sr.md

**0.216** over 13 density rules · 172 words · `sr` · lexicon `0.1.0+72354cb46b60`

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
| `machine-sr.md` | 172 | 0.216 |
| `machine-en.md` | 199 | 0.181 |
| `ordinary-sr.md` | 322 | 0.936 |
| `ordinary-en.md` | 352 | 0.992 |

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

## False positives: what fires on prose that is fine

This is the survey, not a solution. No suppression mechanism exists and none
was built, because inventing a suppression syntax before seeing which
suppressions are actually needed would be guessing at the shape of a problem
nobody has measured yet.

`samples/ordinary-sr.md` is 322 words of ordinary Serbian written for this
purpose — a post about a slow query and a stale statistics table. It scores
**0.936**. Three rules move off 1.0, and here is what each one caught:

**`inflated-vocabulary` — 0.58, one finding.** `Ključna` at line 34, in
`Ključna reč u celoj priči je „postepeno"` — "the key word in the whole story".
`ključan` is in the guide's inflated list and is also the only ordinary word
for the thing. The lexicon entry is `ključ*`, so the stemmer is doing exactly
what it was asked to do, and it is wrong here. **This is the clearest case for
suppression in the whole set**, and the shape it wants is probably a
context-sensitive exception (`ključna reč` as a unit) rather than removing the
word.

**`verbal-adverb-close` — 0.75, one finding.** `reći` at line 31, in
`poređenje sa prošlom nedeljom neće ništa reći` — "the comparison will say
nothing". `reći` here is an infinitive, not a verbal adverb. The rule matches
`-ći` because the guide names `-ći`, and `-ći` is also the Serbian infinitive
ending. The suppression this wants is a closed list of common infinitives
(`reći`, `ići`, `moći`, `naći`, `doći`), which is a different mechanism from
the one `ključna reč` needs.

**`sentence-uniformity` — 0.84, no findings.** Standard deviation 5.02 words
against an invented target of 6.0. This is not a false positive, it is an
uncalibrated constant: nothing says 6.0 is the right target, and the text reads
fine. It is the single most tractable calibration in the project — measure the
deviation across the author's published pieces and the guess becomes a figure.

`samples/ordinary-en.md`, the same post in English at 352 words, scores
**0.992** with only `sentence-uniformity` below 1.0. That is not evidence the
English rules are cleaner — it is evidence that one text is not a corpus. The
known English noise source is `participial-close`, which fires on any `-ing`
word after a comma and so catches adjectives (`The output was long, boring and
repetitive.`) as readily as participles. It is asserted as a known false
positive in its own test file.

**What this survey is missing.** Four texts, all written by the author of the
tool, two of them written specifically to trip it. It measures whether the
rules fire, not whether they fire on the right things. What would count as
progress: thirty published pieces the author considers good, scored in one
batch, with every finding read.

## Install and run

Node 22 (`.nvmrc`), Node 20 or newer supported.

```
npm install
npm run check -- <file> [--lang sr|en] [--json]
npm test
npm run typecheck
npm run build
```

`--lang` is optional. Without it, language is detected: Serbian diacritics
first, then a stopword vote. **This is a heuristic and it is wrong on Serbian
written without diacritics**, which has lost the strong signal. The saving
grace is that the failure is loud — if the vote gets it right, `diacritics`
fails the text immediately; if it gets it wrong, the report is nonsense nobody
could mistake for a pass. There is no path where stripped Serbian quietly
scores well.

## Status

Day one of a one-week project.

- [x] Domain types — the contract, documented with why rather than what
- [x] Two kinds of rule, with hard failures kept out of the mean
- [x] Continuous density scoring with a documented linear shape
- [x] YAML lexicons validated with Zod, with actionable load errors
- [x] Lexicon version and content hash recorded in every report
- [x] All sixteen rules, registered, with a test that no rule file goes unregistered
- [x] Findings carry line, column and offset from the start
- [x] CLI with markdown and JSON output, exiting 1 only on hard failures
- [x] 120 tests: per-rule counts, per-rule positions, lexicon loading, hashing, detection
- [x] False-positive survey on ordinary prose (above)
- [ ] **Refusing a comparison across lexicon versions.** Recorded, not enforced
      ([ADR 003](docs/decisions/003-lexicons-are-versioned-data.md))
- [ ] **A single calibrated constant.** All 22 are guesses. `sentence-uniformity.target-sd`
      is the one with the clearest path to a measurement
- [ ] **Suppression for known false positives.** Deliberately absent; the survey
      above is the input to the design
- [ ] **A judge for `bullet-bold-restate`**, so it checks restatement and not shape
- [ ] Short-text handling. A 40-word note with one `međutim` scores 0 on
      `transition-density`, because a rate needs a denominator. Asserted in the
      tests so it cannot change unnoticed, and unfixed
- [ ] A corpus. Four texts, all written by the author of the tool
- [ ] CI
- [ ] Editor integration — the reason positions are recorded

## Known limitations

Everything here is true of the current commit.

**No constant in this tool has been calibrated against anything.** Twenty-two
distinct guesses — twenty take part in a Serbian run, nineteen in an English
one — each declared and counted, none measured. The scores discriminate
between the two sample sets by a wide margin (0.18–0.22 against 0.94–0.99), and
that is the only evidence that any of the numbers are in the right place.

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
