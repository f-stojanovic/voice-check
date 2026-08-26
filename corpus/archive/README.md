# Archive

Corpora kept as evidence rather than as inputs. Nothing here is read by
`calibrate` — `corpus/generated/` is the corpus; this directory is the record.

## `sr-croatian-drift/`

The first Serbian negative corpus, generated 2026-08-26 from prompts that
specified the subject and nothing else.

Every one of the fifteen documents came back in Croatian rather than Serbian:
**77 instances of `što` against 29 of `šta`**, and **58 ijekavian forms**
(`vrijeme`, `svjetlo`, `prije`, `poslije`) across the set, with five documents
heavily ijekavian.

The Serbian rules are ekavica-specific, so a ceiling calibrated against this
corpus would have been a ceiling for a language the author does not write.

It is kept because it is the measurement that made the constraint visible. The
prompts in these files are the prompts that produced Croatian, and the ones in
`corpus/generated/sr/` are the same prompts with the variant named. The
difference between the two directories is the finding.

## What naming the variant changed

Regenerated with `Piši na srpskom jeziku, ekavicom.` appended:

| marker | this archive | `corpus/generated/sr/` |
| --- | --- | --- |
| ijekavian forms | 72 | **0** |
| `što` (non-subordinating), per document | ~6 | ~6 |

The morphology is fixed and the syntax is not. A variant instruction reaches
one and not the other, which is worth knowing before anybody assumes the
regenerated corpus is a clean sample of the author's dialect.

See [ADR 012](../../docs/decisions/012-the-negative-corpus-is-generated.md).
