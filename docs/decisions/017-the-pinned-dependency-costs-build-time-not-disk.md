# 017. The pinned eval harness costs build time, not disk — and the ONNX runtime is still downloaded

Date: 2026-08-27
Status: Accepted, and **its central cost figure is wrong** — corrected below
2026-08-27 against the first real deploy. It still supersedes
[016](016-agent-evals-is-a-pinned-dev-dependency.md), whose title, headline
figure and unresolved question are all answered here: `agent-evals` is pinned to
a commit SHA rather than a tag, `npm ci` works, and the 400MB it named is not
what a consumer installs.

        WHAT IT GOT WRONG. This record said the pin costs "roughly a minute of
        extra build time" per deploy, from a 73.03s cold-cache install measured
        on a laptop. The Render build took **14 seconds** for the whole
        `npm ci --include=dev`. The arithmetic was right and the number was
        real; it was a measurement of a different machine, presented as this
        one's cost.

        THE GENERAL FORM, because it will happen again: a figure measured where
        it is convenient becomes the figure quoted where it matters, and the
        substitution is invisible once the sentence is written. Nothing in the
        original said "on this laptop" at the point where the cost was claimed —
        it said so in `Evidence:` and then dropped the qualifier in the prose
        eleven lines later. The qualifier has to travel with the number.

        AND A SECOND ERROR, MINE AND SHARPER. I had both figures — 73.03s cold,
        4.38s warm — and wrote that the cold one was "the number that matters,
        because it is the one a build container sees". The build log opens with
        `==> Downloading cache...` and `==> Downloaded 37MB in 1s`, before the
        build command runs. The builder is not a cold cache. My own warm figure
        was the better predictor and I argued past it.
Evidence: MEASURED IN THIS REPOSITORY, 2026-08-27, Node 22.22.1 / npm 10.9.4,
          against `github:f-stojanovic/agent-evals#2e6633ee`. Each figure is
          this repository before and after the pin — the only pairing that is a
          before-and-after. (ADR 016's 477,152 KB and last pass's 27,328 KB
          clean-room figure are NOT comparable to each other and neither is
          quoted here as a delta.)
          `node_modules` — **78,852 KB → 81,288 KB**, +2,436 KB, +3.1%.
          Top-level entries 59 → 65.
          `npm ci --include=dev`, COLD npm cache (`--cache` at a path that did
          not exist) — **8.00s → 73.03s**. 9.1x.
          The same, WARM cache — **0.77s → 4.38s**. 5.7x.
          `npm run build` — **0.74s → 0.73s**. Succeeds both times, emits
          `dist/index.js`. Unchanged, within noise.
          `onnxruntime-node` / `onnxruntime-web` / `@huggingface/transformers`
          in the installed tree: **absent at any depth**
          (`find node_modules -name 'onnxruntime*' -o -name transformers`
          returns nothing). The optional peer works.
          BUT THEY ARE STILL DOWNLOADED. After the cold `npm ci` above, the npm
          cache directory went **17M → 160M**, and its index contains
          `onnxruntime-common`, `onnxruntime-node`, `onnxruntime-web`,
          `@huggingface/transformers`, `@huggingface/tokenizers` and
          `@huggingface/jinja`. None of them is in `node_modules`.
          WHERE THE 65 SECONDS GO, isolated by running each step alone:
          `git clone` of `agent-evals` over HTTPS — 1.17s, 1,912 KB.
          Its own `npm install` (the devDependencies npm installs so `prepare`
          can run) — **71.38s, materialising 474,544 KB of `node_modules`**.
          `tsc -p tsconfig.build.json` — 0.63s.
          So the entire delta is installing `agent-evals`' devDependencies,
          which still contain `@huggingface/transformers`, and then pruning them.
          `npm ci` from a clean `node_modules`: "added 73 packages, and audited
          74 packages in 4s", exit 0. `node_modules/agent-evals/dist/index.js`
          present.
          `git ls-remote` reports `2e6633ee914f4e916910261a69a54b40651a3d85` as
          `refs/heads/main`, checked before pinning.
          The lockfile records `git+ssh://git@github.com/...`. With
          `GIT_SSH_COMMAND=/bin/false`, `SSH_AUTH_SOCK` unset and a cold cache,
          `npm ci` still succeeded — npm falls back to HTTPS for a public repo.
          `@anthropic-ai/sdk` resolves to ONE copy, at 0.120.0.
          `npm test` 389 → 389. `npm run typecheck` exit 0. `npm run verify`
          exit 0. `npm run eval:fixture` exit 0.
          MEASURED ON RENDER, 2026-08-27, the deploy of commit 1400103 — the
          "one deploy" this line originally said was the only thing that would
          settle it. Verbatim from the build log:

            04:01:16  ==> Downloading cache...
            04:01:17  ==> Checking out commit 140010374314ef0babb098df89f943c8392ac265 in branch main
            04:01:18  ==> Downloaded 37MB in 1s. Extraction took 1s.
            04:01:20  ==> Running build command 'npm ci --include=dev && npm run build'...
            04:01:33  added 74 packages, and audited 75 packages in 14s
            04:01:33  > voice-check@0.1.0 build
            04:01:33  > tsc -p tsconfig.build.json
            04:01:37  ==> Uploading build...
            04:01:40  ==> Build successful 🎉
            04:02:03  ==> Your service is live 🎉

          `npm ci --include=dev`: **14s** by npm's own count, 04:01:20 → 04:01:33
          by the clock. Against 73.03s measured locally on a cold cache.
          `tsc`: 04:01:33 → 04:01:37, about 4s, against 0.73s locally.
          Build command start to "Build successful": 04:01:20 → 04:01:40, 20s.
          Push to live: service up at 04:02:03.
          No disk warning, no memory warning, no failure. The build survived,
          which no local figure could have established.
          A CACHE IS RESTORED BEFORE THE BUILD — `Downloading cache` /
          `Downloaded 37MB`. What that 37MB contains is not stated in the log
          and is not inferred here. It is enough to say the builder is not the
          cold-cache case this record measured.
          74 PACKAGES ON RENDER, 73 LOCALLY. One more, unexplained; the obvious
          candidate is a platform-specific optional binary that differs between
          linux-x64 and darwin-arm64, and that is a guess rather than a
          finding — nothing was run to confirm it.
          STILL NOT MEASURED: the transient 474,544 KB and the ~143 MB of
          downloads, on Render. The log reports neither, and with a cache
          restored beforehand the local figures may not transfer at all. Build
          duration, memory and disk limits for the Free instance type remain
          undocumented as far as I could find.

## Context

ADR 016 took `agent-evals` as a dev dependency and recorded that it cost 400MB,
of which 340MB was ONNX runtime pulled in by `@huggingface/transformers` for a
scorer this repository does not use. It also left the manifest pointing at a tag
that was never created, so the branch could not install at all.

`agent-evals` has since made that dependency an optional peer. This pass pins
the resulting commit and measures what the deployed build actually pays.

## Decision

Pin to `github:f-stojanovic/agent-evals#2e6633ee914f4e916910261a69a54b40651a3d85`,
in `devDependencies`, with `package-lock.json` regenerated by `npm install`.

A SHA rather than the tag ADR 016 proposed. A tag is a mutable pointer that
reads as an immutable one, and the lockfile's SHA survives only until something
regenerates the lockfile. For a dependency on the tool that computes a baseline,
the manifest should state something that cannot move.

`devDependencies`, unchanged and for the unchanged reason: the deployed surface
is `check`, which calls no model, and `render.yaml` treats the absence of
`ANTHROPIC_API_KEY` as the signal that model-calling code has not been deployed.

`render.yaml` is untouched.

## What the numbers mean, and what they do not

**The disk cost is small and the optional peer is why.** +2,436 KB, and no ONNX
runtime anywhere in the tree. ADR 016's headline — "it costs 400MB" — is now
wrong by two orders of magnitude, and it was a true measurement of a package
that has since changed.

**The build cost is not small, and it is the opposite of what the disk figure
suggests.** A cold `npm ci --include=dev` goes from 8.00s to 73.03s. That is not
disk and it is not this repository: it is npm cloning `agent-evals` and
installing that package's own devDependencies so its `prepare` script can build
it, then pruning them again.

**AND THOSE DEVDEPENDENCIES STILL INCLUDE `@huggingface/transformers`.** The
optional peer keeps 340MB of ONNX runtime out of the FINAL tree. It does not
keep it off the wire or off the disk during the build: the npm cache grew from
17M to 160M on a cold install, and it holds `onnxruntime-node`,
`onnxruntime-web` and `@huggingface/transformers` — packages that appear nowhere
in `node_modules` afterwards. Building the git dependency materialises
474,544 KB transiently.

This was not anticipated by ADR 025 in `agent-evals`, which reasoned about what
a consumer *ends up with*. A git dependency with a `prepare` script does not
only deliver its output; it runs its whole development install on the
consumer's machine first.

**What this says about Render — CORRECTED 2026-08-27, and the original is kept
below it because the way it was wrong is the useful part.**

The deploy happened. `npm ci --include=dev` took **14 seconds**, the build
command ran 04:01:20 → 04:01:40, and the service was live at 04:02:03, with no
disk or memory complaint. The build survives, comfortably.

What the original said: "this change costs, on every deploy, roughly a minute of
extra build time and roughly 143 MB of extra download — both recurring, both
metered." The minute is wrong by a factor of five, and the 143 MB is unverified
on the builder rather than confirmed by it.

Two things went wrong and only one of them is about Render. The first is that a
laptop figure was quoted as a deploy cost, with the qualifier left behind in
`Evidence:`. The second is that I had a warm-cache measurement of 4.38s, chose
the 73.03s cold one, and justified the choice with "it is the one a build
container sees" — a claim about Render made without looking at Render, which the
log's own first line refutes.

What survives intact is the shape of the finding rather than its size: the cost
of this dependency is install time, not disk, and it is spent building the git
dependency rather than on anything this repository ships.

## Consequences

**The remedy, if the numbers turn out to matter, is in the other repository.**
Nothing here can avoid installing `agent-evals`' devDependencies; that is npm's
git-dependency contract. The lever is `@huggingface/transformers` moving out of
`agent-evals`' `devDependencies` — it is there so the semantic scorer's own
tests run, which is a CI concern rather than a packaging one. Deliberately not
done in this pass: `agent-evals` is untouched here, and the figure that would
justify it is a Render build that has not happened.

**`npm ci` works over a real GitHub URL**, which had never been tested — every
prior probe used `git+file://`. The `prepare` hook fires and `dist/index.js`
arrives.

**The lockfile names an SSH URL and that is not a problem.** npm rewrites the
`github:` shorthand to `git+ssh://git@github.com/...`. With SSH forced to fail
and a cold cache, `npm ci` still succeeded. Recorded because the failure it
would have caused — a builder with no GitHub SSH key — is invisible on a
developer machine that has one.

**One `@anthropic-ai/sdk`, at 0.120.0.** The peer-dependency change in
`agent-evals` is confirmed in a real consumer rather than in a scratch probe.

## Alternatives rejected

**Keep the tag.** It does not exist, and ADR 016 left the choice open. A SHA
costs readability and buys immutability, which is the property this pair of
repositories argues for everywhere else.

**Vendor the harness.** No install cost, no git dependency. It forks the thing
whose value is being one implementation with one recorded history.

**Change `render.yaml` — `--omit=optional`, a cache mount, anything.** The
numbers describe a laptop. Tuning a deploy against them would be tuning against
a measurement taken somewhere else.
