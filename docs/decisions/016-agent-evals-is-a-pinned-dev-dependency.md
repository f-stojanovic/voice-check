# 016. `agent-evals` is a pinned dev dependency, and it costs 400MB

Date: 2026-08-27
Status: Accepted with one unresolved question — tag versus commit SHA, argued
        below, not settled. THE COMMITTED MANIFEST DOES NOT INSTALL YET:
        `github:f-stojanovic/agent-evals#v0.1.0` names a tag that does not
        exist, so `npm ci` fails until it is created. See "Ordering".
Evidence: THE FOUR NUMBERS, measured on this machine, Node 22.22.1 / npm
          10.9.4, with `agent-evals` installed from a local
          `git+file://` URL because nothing has been pushed yet.
          `node_modules` — 78,760 KB before, 477,152 KB after. A 6.1x increase,
          of which `onnxruntime-node` is 215,288 KB and `onnxruntime-web` is
          132,852 KB: 340MB of the 400MB delta is two ONNX runtimes reached
          only through `@huggingface/transformers`.
          `npm ci --include=dev`, COLD npm cache (`--cache` at a path that did
          not exist) — 8.97s before, 150.92s after. 17x, and the number that
          matters, because it is the one a build container sees.
          The same command with a WARM cache — 0.81s before, 5.41s after.
          `npm run build` — 0.74s before, 0.75s after. Succeeds both times and
          emits `dist/index.js`. The dependency does not touch the build.
          `npm test` — 389 passed before, 389 passed after. Unchanged.
          `npm run typecheck` — exit 0 after.
          THE SMOKE EVAL RUNS: `npm run eval:fixture` reports
          "**GATE: PASS**", one case, `format-compliance` 1.00, arrived via
          `tool-call`, exit 0. No network call and no API key.
          IT ALSO FAILS WHEN IT SHOULD, which is the half worth measuring.
          Moving the installed package's `dist/` aside: exit 1, with
          `ERR_MODULE_NOT_FOUND ... /node_modules/agent-evals/dist/index.js`.
          Pointing the fixture at a caseId that no case declares:
          "**GATE: FAIL** — 1 errored", exit 1.
          NOT MEASURED: any of this on Render. Every figure here is a laptop
          with an SSD and a nearby npm registry, and the free-tier builder is
          neither. What would count: one deploy, timed, after the tag exists.
          ALSO NOT MEASURED: whether the free-tier build has 400MB of disk to
          spare. I did not find a documented limit and did not guess at one.

## Context

`voice-check` is going to run its own eval suite, and the harness for it already
exists in `agent-evals`. This record covers taking the dependency, and nothing
else: no OTel, no eval cases with expected outputs, no change to `render.yaml`.

Three questions had to be answered to take it at all — which shelf it goes on,
how it is pinned, and what it costs to install. The third turned out to be the
only one with a surprising answer.

## Decision

**`devDependencies`, not `dependencies`.** The deployed service runs `check`,
which calls no model (ADR 013), and `render.yaml` says the absence of
`ANTHROPIC_API_KEY` from that service is a deliberate signal: *"If a key ever
appears here, something has been deployed that should not have been."* An eval
harness in `dependencies` is a runtime dependency of that service. It would
never be reached, and it would still put `@anthropic-ai/sdk` and a judge that
calls it inside the one process whose argument is that it cannot call a model.
The lockfile records `"dev": true`, so the placement is checkable rather than
asserted.

**Pinned, not a bare `github:` shorthand.** A bare shorthand resolves to
whatever the default branch points at when the install runs. The lockfile does
record the resolved SHA, so `npm ci` stays reproducible — but the manifest then
states no intent, and `npm update` moves it without anyone reading a diff.

**The eval suite is `npm run eval:fixture`, and it is not in `npm test`.** The
389 tests answer "is the style checker wrong?". An eval answers "has the model's
output moved?". Those want different responses from whoever sees them go red,
and one command that fires for either destroys the distinction the eval story
depends on. It also keeps `npm test` off a git dependency's build.

**The eval code lives in `evals/`, outside `src/`.** `tsconfig.build.json` has
`rootDir: src`, so nothing under `evals/` compiles into `dist/` and nothing
reaches the deployed image. That is the `devDependencies` argument applied to
our own code rather than to somebody else's.

## The question I did not settle: tag or SHA

The proposal on the table is a tag, `#v0.1.0`, because it is readable in a diff
and the lockfile carries the immutable SHA underneath. **I think a commit SHA is
the better call, and the readability argument is weaker than it looks.**

A tag is a mutable pointer that reads as an immutable one. `git tag -f` plus a
force push moves it, GitHub does not protect tags by default, and nothing in the
manifest or in a review diff would show that it moved. The lockfile's SHA holds
only until somebody regenerates the lockfile, which `npm update`, a merge
conflict, or a dependency bump all do routinely — and at that moment the
manifest string is the only surviving statement of intent, and it now means
something different than it did.

That is precisely the failure mode `agent-evals` exists to argue about. Its
whole case is that a baseline must be immutable to mean anything, and its ADR
015 is specifically about a claim that could not be checked from the file it
appeared in. `#v0.1.0` is such a claim. `#<sha>` is self-verifying.

The readability argument also assumes the tag carries information, and here it
does not. MEASURED: `git tag -l` in `agent-evals` returns nothing — there are no
tags — and `git log -S'"version"' -- package.json` returns exactly one commit,
"Add project foundation", so `version` has been `0.1.0` since the first commit
and has never been incremented. `#v0.1.0` in a diff would name a version with no
release history, no changelog, and no relationship to what changed. It looks
like information and is not.

**Against my own position, honestly:** a SHA in the manifest is unreadable, and
unreadable pins rot. Nobody notices that a 40-character hex string is eight
months old, whereas `#v0.1.0` sitting next to a repository that has reached
`v0.4.0` is visibly stale. Pinning to a SHA trades a silent-movement risk for a
silent-staleness risk. I still prefer it — staleness is inert and movement is
not, and a stale pin still installs exactly the code it installed last time —
but it is a trade rather than a free win.

This is Filip's call and the tag is the thing that would have to be undone, so
the manifest currently carries his proposal and this section carries the
argument against it.

## Ordering: the committed manifest does not install

`agent-evals` has not been pushed with its packaging fix and the tag does not
exist, so `github:f-stojanovic/agent-evals#v0.1.0` cannot resolve. MEASURED:
`npm ci --include=dev` on this branch fails with

```
npm error The git reference could not be found
npm error command git --no-replace-objects checkout v0.1.0
npm error error: pathspec 'v0.1.0' did not match any file(s) known to git
```

`package-lock.json` is therefore left as it was on `main`, without an
`agent-evals` entry. The alternative was to commit the lockfile as generated
locally, which would have written
`git+file:///Users/filipstojanovic/Downloads/Archive/protfolios/...` into a
public repository — a path that exists on one machine and resolves nowhere else,
including on Render.

So this branch is red until three things happen in order: push `agent-evals`'
packaging branch, create the tag, then run `npm install` here to write the
lockfile entry. Everything measured above was measured against the `git+file://`
install, which is the same code at the same commit reached by a different URL.

## Consequences

**The Render build gets 400MB and roughly two and a half minutes longer, and
neither has been measured on Render.** `buildCommand` is
`npm ci --include=dev && npm run build`, so devDependencies are installed there
by design — `--include=dev` is there because Render sets `NODE_ENV=production`
and the build needs `tsc`. On a free-tier builder the cold-cache figure is the
relevant one, and it went from 9s to 151s here.

**340MB of that is for a scorer this repository will not use.**
`@huggingface/transformers` exists in `agent-evals` for `semanticSimilarity`,
whose calibration failed there — margin −0.392, eight of ten pairs overlapping,
no threshold adopted. The analyst cases will not use it. `render.yaml` is
deliberately unchanged, nothing has been moved to `optionalDependencies`, and no
`--omit=optional` has been added: those are fixes to a problem that has not been
confirmed on the machine that has it, and applying them now would be a guess
dressed as a remedy.

**Two copies of `@anthropic-ai/sdk` are installed.** This repository requires
`^0.120.0` and `agent-evals` requires `^0.117.1`, so npm nests
`node_modules/agent-evals/node_modules/@anthropic-ai/sdk` at 0.117.1 rather than
deduplicating. Nothing breaks — neither is loaded by the deployed service — but
the eval process would run the analyst against one SDK and the judge against
another.

**`evals/smoke.ts` is not covered by `npm run typecheck`.** `tsconfig.json` has
`include: ["src/**/*.ts"]`, so the one file that imports the new dependency is
the one file `tsc` never looks at, and `tsx` does not typecheck. It was checked
by hand for this commit — a throwaway config over `evals/**/*.ts` with the same
strict settings compiles it clean — but nothing repeats that check. Closing it
means a second tsconfig and a CI step, and no CI workflow is added in this pass.

**The smoke case will not catch a regression, only a breakage.** It records no
baseline, because a baseline is a claim that these numbers are the ones to
defend and one wiring case is not that. Its whole job is to go red when the
import breaks, and the two negative tests above are the evidence that it does.

## Alternatives rejected

**Vendor the harness — copy the scorers in.** No install cost, no git
dependency, no ordering problem. Rejected because it forks the thing whose value
is being one implementation with one recorded history, and the copy would drift
from `agent-evals` silently and immediately.

**`dependencies`, and rely on it never being imported.** The service would work.
It would also ship a model-calling SDK into the process whose stated guarantee is
that it cannot call a model, and that guarantee is currently readable from
`package.json`. Being right by accident is not the same as being right.

**Fold the eval into `npm test`.** One command, one green tick. It merges two
signals that call for different responses, and it makes the whole test suite
depend on a git dependency compiling on install.

**Wait for the numbers before taking the dependency at all.** Considered
seriously, since 400MB is not nothing. Rejected because the numbers are the
deliverable: they cannot be measured without installing it, and installing it on
a branch is the cheapest way to find out. Reverting is one commit.
