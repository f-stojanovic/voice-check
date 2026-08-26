# 006. Every lexicon entry carries the example that proves it works

Date: 2026-08-27
Status: Accepted
Evidence: Direct, from a defect this repository shipped and then caught.
          Two entries in `lexicons/sr.yaml` matched nothing at all:
          `neverovatn*` and `spektakularn*`, both broken on the Serbian
          fleeting `a` — the masculine forms are `neverovatan` and
          `spektakularan`, which share no prefix with the stems as written.
          The lists looked full. Every report they appeared in was clean for
          the wrong reason, and nothing in the tool distinguished an entry that
          found nothing from an entry that looked and approved.
          Verified by deliberate reversion, 2026-08-27: restoring both broken
          stems fails the build with the entry named —
          `entry "neverovatn*" matched nothing in "Rezultat je neverovatan."`
          Restoring the `ključ*` entry's exception to something that does not
          cover `ključna reč` fails with
          `entry "ključ*" fired on "Ključna reč …", which it is declared not
          to match`.
          MEASURED SIDE EFFECT: the first version of the `spektakular*`
          example used the feminine `spektakularne`, which the BROKEN stem also
          matches — so the guard passed against a dead entry. The example had
          to be changed to the masculine form. A test whose fixture avoids the
          failure mode is not a test.
          Unobserved: whether 66 entries with one example each is enough
          coverage. One example proves an entry is alive, not that it is right.

## Context

Phrase lists are data (ADR 003) so a writer can extend the tool without
touching code. The cost of that convenience is that nothing type-checks a
phrase. A stem with the wrong prefix, a typo, a diacritic that did not survive
a paste — each produces an entry that compiles, loads, validates against the
schema, and matches nothing.

The failure is silent by construction. A rule with a dead entry returns fewer
findings, which reads as a cleaner text. There is no error, no warning, and no
difference in the report between "this text has no promotional language" and
"two of the four things we look for are broken".

This is precisely the failure the project exists to catch, occurring inside
the project's own data, which is the sort of irony that should be written down
rather than quietly fixed.

## Decision

Every lexicon entry is an object, not a string:

```yaml
- phrase: ključ*
  matches: "Ovo je ključan trenutak."
  doesNotMatch: "Ključna reč u celoj priči je postepeno."
  except:
    - ključna reč
    - ključne reči
```

`matches` is **mandatory**: a text the entry must fire on.
`src/lexicon-entries.test.ts` runs every entry against its own example, and a
dead entry fails the build with its own text in the message.

`doesNotMatch` is optional and is where a known false positive is recorded. It
turns "`ključ*` also catches `ključna reč`" from a paragraph in a README into
an assertion that fails when somebody widens the stem.

`except` is the mechanism that makes a `doesNotMatch` satisfiable: literal
phrases inside which a match is suppressed. **This is a suppression mechanism,
and it was deliberately withheld on day one** — the instruction then was to
survey the false positives rather than invent a syntax for suppressing them.
The survey produced two, of two different shapes, and the narrower of the two
is what got built: a containing literal phrase, not a rule language.

The example must be the form that actually fails. See the Evidence line: an
example in the wrong grammatical form passed against a stem that was already
broken.

## Consequences

A dead entry is now a build failure with a name attached, instead of a quiet
improvement in everyone's score.

Known false positives live next to the thing that causes them, in the file a
writer edits, rather than in a README section a writer does not read. The
`ključna reč` case is now covered by an exception and asserted by a test; the
day-one survey's other finding, the `-ći` infinitive collision in
`verbal-adverb-close`, is NOT covered, because that rule is code and has no
lexicon entry to carry an exception. That asymmetry is real and unresolved.

The cost is that adding a phrase now costs three lines instead of one, and the
writer has to think of an example. That is the feature. An entry nobody can
write an example for is an entry nobody has tested.

`except` is a blunt instrument. It suppresses by containment, so it cannot
express "not when followed by a noun" or any other grammatical condition, and
a phrase with many inflected containers needs many exception lines — `ključ*`
carries five. When that list gets long enough to be unmaintainable, the answer
is probably a judge rather than a longer list, and that is a later decision.

## Alternatives rejected

**A test file listing expected matches, separate from the lexicon.** The list
and the lexicon drift, and the drift is invisible: adding a phrase without
adding a test is the default behaviour of a hurried afternoon. Putting the
example in the same object makes the schema enforce it.

**Coverage counting — "assert every entry produced at least one finding across
the sample corpus".** Depends on the corpus containing every tell, which no
corpus does, and would fail on entries that are correct but rare.

**Narrow `ključ*` to `ključan` and drop the stemmer.** Trades a false positive
for eleven false negatives. The Serbian rules are near-useless without
stemming, which ADR 003's consequences already record.

**Ship the false positives and keep documenting them in the README.** That was
day one, and it was the right call for day one — the data did not exist yet.
It stops being right the moment the survey has produced a shape.
