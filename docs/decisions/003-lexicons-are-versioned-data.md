# 003. Lexicons are versioned data, and a score is only comparable within a version

Date: 2026-08-26
Status: Accepted for the recording half. NOT IMPLEMENTED for the enforcing
        half — nothing yet refuses a comparison across versions, and the TODO
        is in `src/lexicon.ts` and `src/types.ts`.
Evidence: Direct and accidental, from this repository on 2026-08-26. While
          writing the rules I made two edits to `lexicons/sr.yaml`: a
          fleeting-`a` stem fix (`neverovatn*` to `neverovat*`, so the entry
          would match `neverovatan` at all) and a loosening of the
          `rule-of-three` pattern to allow multi-word items. The declared
          `version` stayed at `0.1.0` through both, because neither felt like
          a version-worthy edit at the time.
          The content hash moved from `7324595bf71f` to `72354cb46b60`, and
          every report printed since carries the new one. The second edit
          changed a measured score: `rule-of-three` on
          `samples/machine-sr.md` went from 2 findings to 4, and the same
          rule stayed at 0 findings on `samples/ordinary-sr.md`.
          That is the argument in one incident: the hand-declared version
          caught nothing, the hash caught it, and the scores really did move
          under a version string that said they had not.
          Current identities: `sr` at `0.1.0+72354cb46b60`, `en` at
          `0.1.0+e2ae3178822c`.
          Unobserved and the reason the status is split: nothing has yet tried
          to compare two reports across versions, because nothing stores
          reports yet.

## Context

Phrase lists live in YAML so a writer can add a tell without touching code.
That is a small convenience with a large consequence: the lists are now an
input to every score, and inputs to scores drift.

Add one phrase to `inflated-vocabulary` and every text the tool has ever scored
would now score lower. Remove one and they all score higher. The movement is
uniform, quiet, and shaped exactly like the thing the tool exists to detect —
a body of writing getting better or worse.

agent-evals hit this one level down, with models: a cosine similarity is only
comparable to another from the same encoder, and a judge score only to another
from the same judge. Its answer is a committed `models.lock.json` checked
before the model loads (ADR 009). The same problem, one substrate up, wants the
same answer.

## Decision

Each lexicon file declares a `version`. The loader computes a SHA-256 over a
canonical rendering of the file's content — keys sorted, array order preserved,
the declared version included. `Report.lexiconVersion` is
`` `${version}+${hash.slice(0, 12)}` ``.

Two things are pinned because they fail differently. The declared version
catches the deliberate edit somebody remembered to record and gives it a name a
human can read. The hash catches the edit nobody recorded — which, as the
Evidence above shows, is the common case even when the person editing the file
is the person who wrote this ADR.

Key order does not change the hash, so reordering the YAML for readability is
not a content change. Array order does, because a phrase list is meaningfully a
sequence.

## Which rules this actually covers

**Eight of sixteen.** Stated here because the promise "a writer can extend the
tool without touching code" is true of half the rule set and the README used
to imply more.

Lexicon-driven, and of those, writer-editable:

| rule | how the tells are written | can a writer add one? |
| --- | --- | --- |
| `weasel-words` | phrase list | yes |
| `editorializing` | phrase list | yes |
| `promotional-tone` | phrase list | yes |
| `inflated-vocabulary` | phrase list | yes |
| `summary-close` | phrase list | yes |
| `transition-density` | phrase list | yes |
| `negative-parallelism` | regular expression | not realistically |
| `rule-of-three` | regular expression | not realistically |

The other eight read no lexicon at all: `diacritics`, `formal-address`,
`verbal-adverb-close` and `participial-close` are morphology, and
`bullet-bold-shape`, `em-dash-density`, `bold-ratio` and `sentence-uniformity`
are structure or statistics. None of them has a list to extend. Changing them
means changing code, and no version or hash records that they changed —
which is the gap the uncalibrated-constants report only partly covers, since
it counts numbers and not regular expressions.

So the current counts are: 30 Serbian entries and 31 English, of which 27 and
28 are phrases; three patterns each; one exception list each; three
counter-examples each ([ADR 006](006-lexicon-entries-carry-their-examples.md)).

## Consequences

Every score travels with the identity of the data that produced it. A report
from last week and a report from today are visibly from different lexicons even
when the declared version is identical.

Recording is not enforcing, and this ADR's status says so. Until a comparison
refuses to run across differing `lexiconVersion` values, the guarantee is "the
evidence is on the record" — which is weaker than it looks, because nobody
reads a string that looked the same last week. That refusal is the day-3 job
tracked in `src/types.ts`.

The hash is also only as good as its input. It covers the lexicon file and
nothing else: changing a floor constant in `src/scoring.ts` moves every score
and changes no hash at all. The uncalibrated-constants report (ADR 010 in
agent-evals, applied here in `src/uncalibrated.ts`) is what makes those visible
instead, and it is a weaker mechanism — a list a reader must notice rather than
a value a check can compare.

## Alternatives rejected

**Declared version only.** Requires a human to remember, and the Evidence line
above is a record of that human failing on day one, in the file this ADR is
about.

**Content hash only.** Catches every change and names none of them. `0.1.0` is
a thing a person can say in a sentence; `72354cb46b60` is not.

**Hash the phrase lists but not the declared version.** Then bumping the
version to mark a meaningful reorganisation produces no change in identity,
which makes the version a comment.

**Put the phrases in TypeScript and let git history be the version.** The lists
stop being editable by a writer, which was the reason they are data. Git also
records that a file changed, not which score a number was computed under.
