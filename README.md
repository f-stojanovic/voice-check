# voice-check

### → [voice-check-m8b7.onrender.com](https://voice-check-m8b7.onrender.com)

> **If it takes about a minute, that is a free service waking up.** Render
> spins a free service down after "15 minutes without receiving any inbound
> traffic" and documents the wake as "about one minute". Whether this one ever
> goes idle is not established — its health check may count as traffic — so
> the wait may never happen here.

A style guide, compiled into checks. It grades prose against one writer's own
documented rules, in Serbian and English.

**It does not identify authorship.** It used to claim it did. A corpus of
machine-written text was generated to calibrate that claim and retired it
instead — that measurement is the most interesting thing in this repository and
it is the next section.

```
npm run web                                   # the page: paste text, get the report
npm run check -- samples/machine-sr.md        # the same thing on the command line
npm run brief -- https://example.com/article  # prepare material from a source (calls Claude)
npm run calibrate -- <dir> --generated corpus/generated
```

---

## The finding

The rule set had two halves. One compiles the author's voice — *always `ti`,
never `Vi`; write Serbian with its diacritics*. The other was Wikipedia's
*Signs of AI writing*, a catalogue of phrases said to mark generated prose,
adopted on day one because it is a good list and nothing checked it.

Day four generated 15 English blog posts with `claude-opus-5`, on ordinary
subjects, with **no style instruction at all** — the default register, which is
what a detector would have to detect. 18,612 words.

| what the catalogue predicts | occurrences in 18,612 machine-written words |
| --- | --- |
| `delve`, `landscape`, `synergy`, `empower`, `robust`, `seamless`, `tapestry` | **0** |
| `leverage` | 2 |
| `incredible`, `stunning`, `breathtaking` | **0** |
| `experts say`, `many believe`, `reports suggest`, `critics argue` | **0** |
| `in conclusion`, `all in all`, `to summarize` | **0** |
| `however`, `moreover`, `furthermore`, `additionally`, `on the other hand` | **0** |
| — (em dash) | **202** |
| `**bold**` runs | **232** |

Not one `however` in eighteen thousand words.

Five rules have a **maximum of zero** across all fifteen documents. The
catalogue was assembled across several years and several models; it describes
prose this model does not write. Register moves faster than the catalogue does.

**The phrase rules stay.** If the author writes `važno je napomenuti`, that is
bad prose by his own standard, and it remains bad prose whoever wrote it. What
changed is the reason to run the check — from *this reads as generated* to
*this is not how I write*. ([ADR 014](docs/decisions/014-the-catalogue-was-adopted-on-authority.md))

### The three that do separate

Measured across the same corpus, per 1000 words:

| rule | machine (min / median / max) | what it measures |
| --- | --- | --- |
| **`bold-ratio`** | 0 / 47.18 / 76.30 | bolded characters per 1000 characters |
| **`em-dash-density`** | 5.44 / 10.72 / 16.01 | `—` per 1000 words |
| **`sentence-uniformity`** | 5.88 / 7.75 / 10.06 | standard deviation of sentence length |

`bullet-bold-shape` (0 / 2.99 / 11.74) and `participial-close` (0 / 2.21 /
4.12) also carry signal and are noisier for reasons recorded in their own
files.

The tells that survived are **typographic and structural, not lexical** — and
that is the more interesting result. Vocabulary shifts with every model.
Sentence-length variance does not, and it is the one rule here that cannot be
satisfied by search-and-replace: swap `delve` for `look at` and every other
number moves without the writing changing. That one does not move until the
sentences do.

---

## Two kinds of rule, and a third outcome

A style guide contains two different kinds of sentence, and flattening them
into one severity scale is the mistake this tool is built to avoid.

**Hard rules — one violation fails, full stop.** Serbian text containing none
of `š đ č ć ž` is not slightly worse prose: `ceo` and `ćeo` are different
words. Hard failures are listed separately and contribute **nothing** to the
score. A text without diacritics is not "0.7 good".

**Density rules — measured per 1000 words, scored continuously.** The guide's
objection is not to any single word. One `međutim` is a transition; nine per
thousand words is a tic. A boolean reports the same thing about both, throwing
away the only signal that distinguishes them. Storing the number rather than
the verdict also means "what would this have said at a stricter threshold?"
stays answerable about texts already scored.

**A rule may abstain**, at a threshold derived from its own ceiling
(`1000 / ceiling` words). One occurrence in a short text can exceed a ceiling
on its own, so a single ordinary use would score 0 — which is how a style
checker teaches people to write worse. From **two** occurrences upward it is
scored whatever the length, because two is not an accident. An abstaining rule
still reports what it found, marked *observed, not scored*.

The CLI exits 1 on a hard failure and 0 otherwise, **whatever the score**. A
low score is a number to argue with, not a gate.

---

## Measured, and guessed

| | |
| --- | --- |
| Uncalibrated constants | **23**, every one declared and counted in every report |
| Calibrated constants | **0** |
| Floors | no corpus behind them — needs the author's own accepted drafts |
| Ceilings, English | derivable for the three separating rules; **not adopted** |
| Ceilings, phrase rules | **unmeasurable** — machine text does not contain the phrases |
| Ceilings, Serbian | from a corpus that had to be regenerated once (below) |

Every report ends with the count and the list:

```
This run used 19 uncalibrated constants:
  em-dash-density.ceiling = 15 — em dashes per 1000 words scoring 0; roughly
    one every two sentences, which is where the punctuation has stopped being
    a choice — asserted, not measured
  ...
```

Nothing measured says three transitions per thousand words is fine and five is
not. Each threshold carries a note saying what would have to be measured to
justify it, and the count is a **floor** on how many assumptions a run made,
never the total — nothing stops the next constant being written as a bare
`0.75`. The mechanism is [agent-evals ADR 010](https://github.com/f-stojanovic/agent-evals/blob/main/docs/decisions/010-uncalibrated-constants-are-counted.md).

`npm run calibrate` reports the density distribution of a corpus you consider
good and the floor it would imply, alongside the generated corpus and the
ceiling it implies. **It recommends and never writes.** A tool that tunes its
thresholds against a corpus it also scores converges on "this writing is
perfect", which is true by construction.

---

## Known limitations

Written plainly, because the rest of this file is a list of things that were
measured and these are the things that were not.

**The accepted corpus is two documents.** Every floor in this tool is a guess,
`calibrate` exists to replace them, and it has run against 397 words — which it
correctly refused to draw any conclusion from. This is the bottleneck for
roughly half the constants, and it is the half that cannot be automated: "I
consider this good" is the judgement a model cannot make for you.

**The Serbian ceiling comes from a corpus that had to be regenerated.**
Prompted in Serbian with the subject and nothing else, the model returned
Croatian in all fifteen documents — 77 `što` against 29 `šta`, ijekavian
throughout. The Serbian rules are ekavica-specific, so that corpus could not
calibrate them. It is kept in [`corpus/archive/`](corpus/archive/) as the
evidence that made the constraint visible; the current corpus names the variant
in the prompt. A language variant is not a style instruction.

Naming it fixed the morphology outright — ijekavian forms **72 → 0** — and
improved the pronoun ratio without normalising it: `što`/`šta` went from 108:37
to 86:55. Serbian uses `što` legitimately in subordinating position, so part of
that residue is correct and nothing here separates it from the Croatian-leaning
part. The regenerated corpus is usable for rules that are ekavica-specific. It
is not a clean sample of the author's dialect.

**The traceability gate has never fired in production.** `brief` fails the run
if the analyst quotes text that is not in the source. Across three live runs it
has passed 12/12, 12/12 and 14/14 — so the mechanism is exercised only by
tests, and its false-positive rate is unmeasured.

**The phrase rules detect a voice, not an author.** See the finding above. Half
the rule set is now known to carry no signal against this model, and it is kept
because it serves the other half of the guide.

**One model, one date.** The ceilings describe `claude-opus-5` in August 2026.
A better model would move every ceiling down and look exactly like this tool
becoming lenient. There is no lockfile pinning which model a ceiling came from
— the same failure ADR 003 identifies for lexicons, one level up.

**Length is uncontrolled between the corpora.** Generated documents average
1,241 words; the author's posts run 150–400.

**Words inside fenced code blocks are counted as words**, which understates
every density in a technical post.

---

## The idea

A rule that lives only in a document is a suggestion. The same rule compiled
into a check is a constraint — it runs whether anyone read the document or not.

This is the third substrate: an architecture decision compiled into a
static-analysis rule, an eval case compiled into a CI gate in
[**agent-evals**](https://github.com/f-stojanovic/agent-evals), and now a style
rule compiled into a check on prose in **voice-check**. The substrates are
unrelated; the move is the same one every time.

---

## The two surfaces

**Public, free, no key — `check`.** One page: a textarea, a language selector,
a submit button, and the report with findings underlined in place. Hono,
server-rendered, **no client JavaScript** — a form post, not a fetch, so it
works in a text browser and with scripts disabled. Nothing is stored: no
database, no log of what you pasted, no analytics. The limits (40,000
characters, 20 submissions a minute) are printed on the page rather than
discovered by hitting them. Render documents a free service as spinning down
after 15 minutes without inbound traffic and waking in "about one minute";
whether this service ever goes idle is not established, because its health
check may count as traffic ([ADR 013](docs/decisions/013-the-public-surface-splits-on-marginal-cost.md)).

**Private, CLI only — `brief`.** It makes two Claude calls at about $0.11 a
run. A public endpoint for that is a public endpoint for spending somebody
else's money, and rate limiting prices abuse rather than preventing it. The
split follows from which half has a per-request cost
([ADR 013](docs/decisions/013-the-public-surface-splits-on-marginal-cost.md)).

The web report is rendered from the same `check()` the CLI calls — one
implementation, two renderers. The underlining uses the `line`/`column`/`offset`
recorded on day one, when [ADR 004](docs/decisions/004-findings-carry-positions.md)
justified carrying them on the strength of an interface that did not exist yet.

`GET /healthz` reports the lexicon version and content hash the instance is
running, because a score is only comparable within a lexicon version and a
deployed instance has to be able to say which one it has:

```json
{"status":"ok","lexicons":{"sr":"0.3.0+a1e590743b64","en":"0.3.0+0126033ab30f"},
 "rules":{"sr":15,"en":13},"uptimeSeconds":1,"node":"v22.22.1"}
```

Deployed from [`render.yaml`](render.yaml) through Render's Blueprint flow, so
the file in this repository is the configuration that is running rather than a
document beside it.

`autoDeployTrigger: "checksPass"` — a push deploys **only after CI passes**.
The default is `commit`, which deploys whether the tests passed or not, and a
deploy that can outrun its own tests is not a gate.

> ### Expect a deploy to trail its push by about twenty minutes
>
> **This is normal here and is not a fault.** GitHub creates the workflow run
> **19.5–21.0 minutes** after the push — n=5, mean **20.2 min**, measured
> 2026-08-26 — and each run then passes in about **40 seconds** once started.
> The deploy waits for the check, so it waits for the queue.
>
> If you push and nothing happens, wait twenty minutes before concluding
> anything. That sentence is in this README because its absence cost an
> afternoon: nine pushes produced zero runs, every local cause was excluded,
> two standard remedies appeared to fail, and all of it was observed inside the
> window. Nine measurements taken faster than the thing being measured are one
> measurement ([ADR 015](docs/decisions/015-an-observation-window-shorter-than-the-phenomenon.md)).

**The gate has fired once.** The check for `8b4790c` passed at 16:31:14 UTC and
the service process restarted 73 seconds later. It has not yet *stopped*
anything — no run here has failed — and a gate is only really demonstrated by a
failure it blocks.

---

## What it measures

Sixteen rules. Twelve apply to both languages, three are Serbian-only, one is
English-only. The **source** column matters: only eight read the lexicon, and
only six of those are phrase lists a writer can extend without touching code.
The **separates** column is the day-four measurement.

| rule | kind | lang | source | separates? | what it looks for |
| --- | --- | --- | --- | --- | --- |
| `diacritics` | hard | sr | code | — | Serbian text with no `š đ č ć ž` |
| `formal-address` | hard | sr | code | — | `Vi`/`Vas`/`Vaš` capitalised mid-sentence |
| `bold-ratio` | density | sr, en | code | **yes** | bolded characters per 1000 characters |
| `em-dash-density` | density | sr, en | code | **yes** | `—` per 1000 words |
| `sentence-uniformity` | density | sr, en | code | **yes** | sd of sentence length — *low* scores badly |
| `bullet-bold-shape` | density | sr, en | code | partly | `- **Word:** …` — the *shape* only |
| `participial-close` | density | en | code | partly | an `-ing` clause closing a sentence |
| `verbal-adverb-close` | density | sr | code | untested | `-jući`/`-ći` before a sentence end |
| `negative-parallelism` | density | sr, en | regex | no | `nije X, već Y` · `it's not X, it's Y` |
| `rule-of-three` | density | sr, en | regex | no | `X, Y i Z` |
| `inflated-vocabulary` | density | sr, en | **phrases** | no | the long word where a short one would do |
| `weasel-words` | density | sr, en | **phrases** | no | attribution that attributes nothing |
| `editorializing` | density | sr, en | **phrases** | no | the narrator telling you how to feel |
| `promotional-tone` | density | sr, en | **phrases** | no | adjectives that do your reacting for you |
| `summary-close` | density | sr, en | **phrases** | no | the paragraph that restates the piece |
| `transition-density` | density | sr, en | **phrases** | no | good connectives, too many of them |

"Separates" means the rule's density distribution on machine-written text is
distinguishable from a human's. "No" here means the rule **never fired** on the
generated corpus — a different finding from overlapping, and `calibrate` labels
them separately as `NO SIGNAL`:

```
| rule                | implied ceiling | verdict                        |
| weasel-words        |            0.00 | **NO SIGNAL** (0/15 generated) |
| editorializing      |            0.00 | **NO SIGNAL** (0/15 generated) |
| promotional-tone    |            0.00 | **NO SIGNAL** (0/15 generated) |
| summary-close       |            0.00 | **NO SIGNAL** (0/15 generated) |
| transition-density  |            0.00 | **NO SIGNAL** (0/15 generated) |
| em-dash-density     |            6.70 | separates                      |
| bold-ratio          |           21.08 | separates                      |
```

Serbian differs, and that is worth recording. Across its own 15 documents only
`weasel-words` and `summary-close` come back with no signal at all; the rest
fire at a low but non-zero rate — `promotional-tone` max 1.05,
`inflated-vocabulary` max 1.05, `editorializing` max 0.97,
`negative-parallelism` max 2.26 per 1000 words. Five rules return nothing in
English; two in Serbian.

The catalogue is more wrong about English than about Serbian. Whether that is
about the languages, about how much of each the model saw, or about the two
lexicons being different lists, one corpus cannot say.

---

## Where the money goes, per step

![Jaeger trace timeline of one analyst eval run: three nested spans — the eval
case, the analyse agent run, and the chat claude-opus-5 model call — with the
model call accounting for essentially the whole 43.59s
duration.](docs/images/jaeger-analyst-waterfall.png)

One eval case, traced. Three spans, nested: the **eval case**, the **agent run**
(`analyse`), and the **model call** (`chat claude-opus-5`). The model call is
43.58s of a 43.59s case, which is the shape you would expect and the reason the
picture is worth having — it says the harness costs nothing and the model costs
everything.

The `chat` span carries the OpenTelemetry
[GenAI semantic-convention](https://github.com/open-telemetry/semantic-conventions-genai)
attributes, and cost as a custom one:

```
gen_ai.operation.name          chat
gen_ai.provider.name           anthropic
gen_ai.request.model           claude-opus-5
gen_ai.request.max_tokens      4000
gen_ai.response.model          claude-opus-5
gen_ai.response.finish_reasons ["tool_use"]
gen_ai.usage.input_tokens      8280
gen_ai.usage.output_tokens     2347
voice_check.cost.usd           0.100075
voice_check.request.attempts   1
```

**THE COST IS NOT LEGIBLE IN THE SCREENSHOT ABOVE**, and the attributes are
printed here rather than cropped into view: Jaeger collapses span tags until you
click a span, and the run was captured headlessly, so no click happened. The
waterfall demonstrates the nesting and the timing; the per-step cost is real, is
on the span, and takes one click in the UI to see. Saying that is cheaper than a
screenshot arranged to imply otherwise.

**An unknown cost is an absent attribute, never a zero.** A model with no
price-table entry gets `voice_check.cost.unknown_reason` and no
`voice_check.cost.usd`, so anything summing cost across spans totals what is
known and visibly omits the rest. A zero would render as a legitimate-looking
bar beside real numbers, in the one artifact whose whole purpose is attribution.

Tracing is off by default:

```
npm run eval:analyst -- --live --trace           # export to a local Jaeger
npm run eval:analyst -- --trace --trace-console  # print spans, replay, free
docker run -d -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one:latest
```

## Everything else

The design decisions, each with a `Status:` and an `Evidence:` line saying what
has actually been observed — including when the answer is "nothing yet" — are
in [`docs/decisions/`](docs/decisions/). Twenty of them, one of which
([014](docs/decisions/014-the-catalogue-was-adopted-on-authority.md)) withdraws
a claim the other thirteen were built around, one
([015](docs/decisions/015-an-observation-window-shorter-than-the-phenomenon.md))
is about a wrong conclusion reached twice in one afternoon, and one
([016](docs/decisions/016-agent-evals-is-a-pinned-dev-dependency.md)) was
superseded the day after it was written by
([017](docs/decisions/017-the-pinned-dependency-costs-build-time-not-disk.md)),
which measured the same dependency and found the headline figure wrong by two
orders of magnitude.

Worth reading if you only read one: how the lexicon carries the examples that
prove each entry works ([006](docs/decisions/006-lexicon-entries-carry-their-examples.md)),
why there is no drafting agent ([008](docs/decisions/008-there-is-no-writing-agent.md)),
and why the negative corpus needs no annotator ([012](docs/decisions/012-the-negative-corpus-is-generated.md)).

```
npm install
npm test          # offline, no network, no API key
npm run typecheck
npm run build
```

`brief` needs a key in `.env` at the project root, read by path and never from
the environment. `check`, `calibrate` and the web page need nothing.

MIT © 2026 Filip Stojanović
