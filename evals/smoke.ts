/**
 * `npm run eval:fixture` — the wiring check.
 *
 * WHAT THIS PROVES, EXACTLY. That `agent-evals` is installed, that its compiled
 * entry point resolves, and that a case can be loaded, replayed against a
 * recorded output, extracted, scored, compared and reported without a network
 * call or an API key. If the git dependency stops building on install, this is
 * the command that says so.
 *
 * WHAT IT DOES NOT PROVE. Anything about the analyst. It never constructs a
 * `ModelClient`, never calls `analyse`, and never reads `ANTHROPIC_API_KEY`.
 * The subject is a fixture replayer; the only scorer registered is
 * `formatCompliance`, which grades the route a payload arrived by and has no
 * opinion about its contents.
 *
 * WHY IT IS NOT PART OF `npm test`. The 389 tests answer "is the style checker
 * wrong?". This answers "is the harness wired up?", and later "has the model's
 * output moved?". Those are different questions with different responses, and a
 * single command that goes red for either destroys the distinction. It also
 * keeps `npm test` from depending on a git dependency's build.
 *
 * WHY IT LIVES OUTSIDE `src/`. `tsconfig.build.json` has `rootDir: src`, so
 * nothing here is compiled into `dist/` and nothing here reaches the deployed
 * service. That is the same argument as putting `agent-evals` in
 * `devDependencies`: the Render service runs `check`, which calls no model, and
 * model-calling code has no business in that image. The cost is that
 * `npm run typecheck` does not cover this file — see docs/decisions/016.
 */

import {
  CACHE_OFF,
  compareToBaseline,
  exitCode,
  fixtureSubject,
  formatCompliance,
  formatReport,
  loadCases,
  loadFixtures,
  runSuite,
  summariseProvenance,
  validateExpectations,
} from 'agent-evals';
import type { Scorer } from 'agent-evals';

const CASES_DIR = 'evals/cases';
const FIXTURES_DIR = 'evals/fixtures';

export async function main(): Promise<number> {
  const cases = await loadCases(CASES_DIR);
  const fixtures = await loadFixtures(FIXTURES_DIR);

  /* One scorer, deliberately. Every other scorer in the harness needs an
     expectation somebody had to decide on, and this suite has no labels in it
     (agent-evals ADR 021). */
  const scorers: Scorer[] = [formatCompliance()];

  /* Refuses a case no scorer measures, which is the failure this file would
     otherwise be most likely to have: a green run that checked nothing. */
  validateExpectations(cases, scorers);

  const run = await runSuite({
    cases,
    subject: fixtureSubject(fixtures),
    subjectId: 'fixture',
    scorers,
    samples: 1,
    concurrency: 1,
    cache: CACHE_OFF,
    suiteId: 'voice-check-fixture',
  });

  /* No baseline file, and none is recorded. A baseline is a claim that these
     numbers are the ones to defend, and one wiring case is not that. When the
     analyst suite has real cases it gets a real baseline; until then
     `compareToBaseline` against `undefined` is a first run, which is honest. */
  const comparison = compareToBaseline(run, undefined, {}, scorers.map((s) => s.name));

  console.log(
    formatReport({
      run,
      comparison,
      models: {},
      provenance: summariseProvenance('fixtures', [...fixtures.values()]),
    }),
  );

  /* `exitCode` is the whole verdict, including the errored case. I nearly added
     a separate check for `run.totals.errored` on the assumption that a first run
     with no baseline clears everything; `compareToBaseline` sets
     `ok: erroredCases.length === 0` on exactly that path, so the check would
     have been dead code duplicating a guarantee the library already makes.
     Verified: a fixture whose caseId no longer matches its case reports
     "GATE: FAIL — 1 errored" and exits 1 with nothing added here. */
  return exitCode(comparison);
}

process.exitCode = await main();
