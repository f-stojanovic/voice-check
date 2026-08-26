# 009. Agents take an injected client, so tests never touch the network

Date: 2026-08-26
Status: Accepted
Evidence: Direct. 250 tests run in under a second, make no network call, and
          need no API key — including the ones for the failure modes that
          matter: a malformed tool call, an API error, an unpriced model, and
          an empty source.
          Two of those four cannot be produced on demand against the live API.
          `strict: true` plus a forced `tool_choice` makes a malformed tool
          call very unlikely, and a 429 arrives when the rate limiter says so
          and not when a test wants one. Both are one line against a fake.
          The seam also caught a real defect on 2026-08-26: a test asserting
          the audience profile reaches the model showed the brief was passing
          a profile that described Serbian readers while instructing the model
          to answer in English, on any English source. Fixed in `brief.ts`; the
          audience is a property of the writer, not of the source.
          Unobserved: whether the fake and the real client have drifted. The
          interface is small enough that a full implementation is short, which
          is the mitigation, not a proof.

## Context

Two agents call a paid, remote, non-deterministic API. A test suite that calls
it is slow, costs money on every run, needs a credential in CI, fails when the
network does, and — the part that actually matters — cannot reliably produce
the failures worth testing.

The failures worth testing are the rare ones. A malformed tool call is what the
error path exists for and is nearly impossible to provoke on demand. A rate
limit arrives on the provider's schedule. An unpriced model requires a model
that does not exist yet. Each is a single line against a fake and an
open-ended wait against the real thing.

## Decision

Every agent takes a `ModelClient` as its first argument and never constructs
one. `anthropicClient()` builds the real one; `scriptedClient()` and
`failingClient()` in `agents.test-kit.ts` build fakes.

The interface is deliberately narrow: one method, `callTool`, taking a system
prompt, a user message and one tool spec, returning a raw tool input plus
usage. It is not a general Messages wrapper. **A narrow seam is a seam a fake
can implement completely**, and a fake that implements the whole interface
cannot drift by quietly not supporting something.

Usage and cost are recorded at that seam, once, rather than at each call site.
`AgentRun<T>` carries the value, the model, the usage and `costUsd`.

The API key is read explicitly from `.env` by path — `dotenv.parse`, never
`dotenv.config`, so `process.env` is neither read nor written. That is a
separate concern from injection and lands in the same place: a run should be
authenticated by a credential this repository chose, not by whatever a shell,
a parent process, or a machine-wide `ant auth login` profile happened to
leave lying around. `env.test.ts` asserts an ambient `ANTHROPIC_API_KEY` is
ignored, and that reading the file does not leak other variables into the
process environment.

## Consequences

`npm test` is free, offline, and fast, and the whole suite runs on every
change without anybody weighing whether it is worth the money.

The error taxonomy became a design decision rather than an afterthought,
because the fakes had to produce each error by name. `MalformedToolCallError`
and `ModelUnavailableError` are distinct because they need different responses
— one is worth retrying immediately and the other is not — and the `brief`
command exits with a different code for each.

Cost is measured rather than estimated, because the seam is where usage
arrives. `costUsd` returns `null` for an unknown model rather than 0, so a
missing rate cannot be quietly summed into a total that reads as authoritative.

The costs:

**Nothing here tests the real request shape.** Every test asserts against a
fake, so a wrong parameter name, a rejected `tool_choice`, or a beta header
this SDK version does not accept would pass the entire suite and fail on the
first live call. The mitigation is that a live call is part of the acceptance
ritual — this repository's ADRs carry Evidence lines, and ADR 007's is a real
run — but that is a practice, not a check. A recorded-fixture test against a
captured response would close the gap.

The fake returns whatever it is scripted to return, including shapes the real
API's `strict: true` would refuse. That is the point for the malformed-input
test and a hazard everywhere else: a happy-path fixture can drift from what
the API would actually produce, and no test would notice.

## Alternatives rejected

**Call the real API in tests, with a recorded cassette.** Closer to the real
shape and adds a fixture format, a re-record workflow, and a class of failure
where the cassette is stale. Worth revisiting precisely for the gap named
above.

**Mock the SDK module.** Couples every test to the SDK's internal surface, so
an SDK upgrade breaks tests that are about this repository's logic. The
interface here is ours and changes when we change it.

**Construct the client inside each agent and read the key from the
environment.** The default, and it means no test can run without a key, and
any test that does run costs money and can fail for reasons that have nothing
to do with the code.
