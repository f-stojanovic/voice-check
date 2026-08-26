/**
 * The page. One file, server-rendered, no client JavaScript at all.
 *
 * WHY NO JAVASCRIPT (C4). The form posts. There is no fetch, no hydration, no
 * bundle, and nothing to fail on a slow connection or a locked-down browser.
 * The cost is a full page reload per check, which for a form somebody uses
 * every few minutes is not a cost. The benefit is that the page works
 * everywhere, including in a text browser and with scripts disabled, and that
 * it can never break in a way the server cannot see.
 *
 * The CSS is inline for the same reason: one request, no build step, nothing
 * to cache-bust.
 */

import { formatUncalibratedReport } from '../uncalibrated.js';
import { escapeHtml, highlight, spansFor } from './highlight.js';
import type { CheckOutcome } from '../report.js';
import type { Language, RuleResult } from '../types.js';

export interface PageOptions {
  readonly maxChars: number;
  readonly rateLimitPerMinute: number;
}

const STYLE = `
:root { color-scheme: light dark; --fg: #16181d; --bg: #fbfbf9; --muted: #5c6370;
  --line: #d9d9d4; --mark: #ffe8a3; --mark-observed: #dfe7f5; --bad: #b3261e; }
@media (prefers-color-scheme: dark) {
  :root { --fg: #e6e6e3; --bg: #16181d; --muted: #9aa1ad; --line: #2c303a;
    --mark: #5a4a12; --mark-observed: #22304a; --bad: #ff8a80; }
}
* { box-sizing: border-box; }
body { margin: 0 auto; max-width: 46rem; padding: 2rem 1.25rem 5rem;
  font: 16px/1.6 ui-serif, Georgia, serif; color: var(--fg); background: var(--bg); }
h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
h2 { font-size: 1.15rem; margin: 2rem 0 .5rem; }
h3 { font-size: 1rem; margin: 1.25rem 0 .35rem; }
p, li { margin: .5rem 0; }
.sub { color: var(--muted); margin: 0 0 1.5rem; }
textarea { width: 100%; min-height: 14rem; padding: .75rem; font: 14px/1.55 ui-monospace, monospace;
  color: var(--fg); background: var(--bg); border: 1px solid var(--line); border-radius: 3px; }
.controls { display: flex; gap: .75rem; align-items: center; margin: .75rem 0; flex-wrap: wrap; }
button { font: inherit; padding: .45rem 1.1rem; cursor: pointer; border: 1px solid var(--fg);
  background: var(--fg); color: var(--bg); border-radius: 3px; }
select { font: inherit; padding: .4rem; color: var(--fg); background: var(--bg);
  border: 1px solid var(--line); border-radius: 3px; }
table { border-collapse: collapse; width: 100%; font-size: .9rem; margin: .5rem 0 1rem; }
th, td { text-align: left; padding: .35rem .5rem; border-bottom: 1px solid var(--line); }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
mark.finding { background: var(--mark); color: inherit; padding: 0 .1em; border-radius: 2px; }
mark.observed { background: var(--mark-observed); color: inherit; padding: 0 .1em; border-radius: 2px; }
pre.text { white-space: pre-wrap; word-wrap: break-word; font: 14px/1.7 ui-monospace, monospace;
  border: 1px solid var(--line); border-radius: 3px; padding: .9rem; overflow-x: auto; }
.score { font-size: 2rem; font-variant-numeric: tabular-nums; }
.hard { border-left: 3px solid var(--bad); padding-left: .9rem; }
.hard h3 { color: var(--bad); }
footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--line);
  color: var(--muted); font-size: .85rem; }
code { font: .9em ui-monospace, monospace; }
details { margin: 1rem 0; }
summary { cursor: pointer; color: var(--muted); }
.err { border-left: 3px solid var(--bad); padding-left: .9rem; color: var(--bad); }
`;

function layout(body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>voice-check</title>
<style>${STYLE}</style>
</head><body>${body}</body></html>`;
}

function form(options: PageOptions, text = '', language: Language | 'auto' = 'auto'): string {
  return `<form method="post" action="/">
  <textarea name="text" maxlength="${options.maxChars}" placeholder="Paste your text here."
    aria-label="Text to check">${escapeHtml(text)}</textarea>
  <div class="controls">
    <label>Language
      <select name="lang">
        <option value="auto"${language === 'auto' ? ' selected' : ''}>auto-detect</option>
        <option value="sr"${language === 'sr' ? ' selected' : ''}>Serbian</option>
        <option value="en"${language === 'en' ? ' selected' : ''}>English</option>
      </select>
    </label>
    <button type="submit">Check</button>
  </div>
</form>`;
}

/**
 * The limits, stated on the page rather than discovered by hitting them (C3).
 * A limit a user finds out about by being refused is a limit that reads as a
 * bug.
 */
function limits(options: PageOptions): string {
  return `<footer>
<p><strong>Nothing here is stored.</strong> Your text is checked in memory and
discarded when the response is sent. There is no database, no log of what you
pasted, and no analytics. A style checker that keeps your writing is a style
checker nobody pastes into.</p>
<p><strong>Limits:</strong> ${options.maxChars.toLocaleString('en-GB')} characters per
submission, ${options.rateLimitPerMinute} submissions per minute per address.
Both are stated here rather than discovered by hitting them.</p>
<p><strong>If this page took half a minute to load, that is the free tier.</strong>
The service sleeps after fifteen minutes with no traffic and takes 30–50 seconds
to wake. There is no queue and nothing is wrong; the first visitor after a quiet
spell pays for the restart and everyone after them does not.</p>
<p>The rules are deterministic and run in this process — no model is called, so
this page costs nothing to serve and needs no API key. The <code>brief</code>
command, which does call a model, stays on the command line.</p>
<p><strong>This checks a voice against its own rules. It does not identify
authorship.</strong> A measurement against 15 machine-written documents
retired that claim: the phrase rules did not fire on generated prose at all.
What the score tells you is how far a text sits from one writer's documented
style guide.</p>
</footer>`;
}

export function renderHome(options: PageOptions): string {
  return layout(
    `<h1>voice-check</h1>
<p class="sub">A style guide, compiled into checks. It grades prose against one
writer's documented rules, in Serbian and English — it does not identify
authorship. Paste something.</p>
${form(options)}
${limits(options)}`,
  );
}

export function renderError(options: PageOptions, message: string, text = ''): string {
  return layout(
    `<h1>voice-check</h1>
<p class="sub">A style guide, compiled into checks.</p>
<div class="err"><p>${escapeHtml(message)}</p></div>
${form(options, text)}
${limits(options)}`,
  );
}

/**
 * The report.
 *
 * Rendered from the same {@link CheckOutcome} the CLI prints, produced by the
 * same `check()` — the rules, the scores, the abstentions and the uncalibrated
 * count are one implementation with two renderers. Only the presentation
 * differs, which is the point: a web report that could disagree with the CLI
 * would be a second tool wearing the first one's name.
 */
export function renderReport(
  options: PageOptions,
  outcome: CheckOutcome,
  text: string,
  detectedBasis?: string,
): string {
  const { report } = outcome;
  const scored = report.rules.filter((r) => r.kind === 'density' && r.outcome === 'scored');
  const hardFailed = report.rules.filter(
    (r) => r.kind === 'hard' && r.outcome === 'scored' && !r.passed,
  );
  const observed = report.rules.filter((r) => r.outcome === 'abstained' && r.findings.length > 0);

  const parts: string[] = [];
  parts.push(`<h1>voice-check</h1>`);
  parts.push(
    `<p class="sub"><span class="score">${
      report.score === null ? 'not scored' : report.score.toFixed(3)
    }</span><br>over ${scored.length} density rule${scored.length === 1 ? '' : 's'} ·
    ${report.wordCount} words · <code>${report.language}</code> ·
    lexicon <code>${escapeHtml(report.lexiconVersion)}</code></p>`,
  );
  if (detectedBasis !== undefined) {
    parts.push(`<p class="sub">Language was detected, not declared: ${escapeHtml(detectedBasis)}</p>`);
  }

  if (hardFailed.length > 0) {
    parts.push('<h2>Hard failures</h2>');
    parts.push('<p>These are not scored. One is enough for the text to fail.</p>');
    for (const rule of hardFailed) {
      parts.push(
        `<div class="hard"><h3>${escapeHtml(rule.rule)}</h3><p>${escapeHtml(rule.reason)}</p></div>`,
      );
    }
  }

  if (report.abstentions.length > 0) {
    parts.push(`<h2>Not measured (${report.abstentions.length})</h2>`);
    parts.push(
      report.score === null
        ? '<p>No density rule could measure this text. The score above is absent, not zero.</p>'
        : '<p>These rules declined to put a rate on it. An abstention is not a pass.</p>',
    );
    parts.push('<ul>');
    for (const a of report.abstentions) {
      parts.push(`<li><code>${escapeHtml(a.rule)}</code> — ${escapeHtml(a.reason)}</li>`);
    }
    parts.push('</ul>');
    if (observed.length > 0) {
      parts.push('<h3>Observed, not scored</h3>');
      parts.push('<p>Found, but with no rate to attach. Notes, not a grade.</p>');
      parts.push('<ul>');
      for (const rule of observed) {
        parts.push(
          `<li><code>${escapeHtml(rule.rule)}</code> — ${rule.findings.length}: ` +
            rule.findings
              .slice(0, 3)
              .map((f) => `<em>${escapeHtml(f.text)}</em> <small>(${f.line}:${f.column})</small>`)
              .join('; ') +
            '</li>',
        );
      }
      parts.push('</ul>');
    }
  }

  if (scored.length > 0) {
    parts.push('<h2>Density rules</h2>');
    parts.push('<table><thead><tr><th>rule</th><th>score</th><th>measured</th><th>found</th></tr></thead><tbody>');
    for (const rule of scored) {
      if (rule.outcome !== 'scored') continue;
      parts.push(
        `<tr><td><code>${escapeHtml(rule.rule)}</code></td>` +
          `<td class="num">${rule.score.toFixed(2)}</td>` +
          `<td class="num">${rule.perThousand === undefined ? '—' : rule.perThousand.toFixed(2)}</td>` +
          `<td class="num">${rule.findings.length}</td></tr>`,
      );
    }
    parts.push('</tbody></table>');

    for (const rule of scored) {
      if (rule.outcome !== 'scored' || rule.findings.length === 0) continue;
      parts.push(`<h3>${escapeHtml(rule.rule)} — ${rule.score.toFixed(2)}</h3>`);
      parts.push(`<p>${escapeHtml(rule.reason)}</p>`);
      parts.push(findingList(rule));
    }
  }

  parts.push('<h2>Your text</h2>');
  parts.push(
    '<p class="sub">Findings underlined where they were found. Hover for the rule. ' +
      'Blue marks were observed by a rule that declined to score.</p>',
  );
  parts.push(`<pre class="text">${highlight(text, spansFor(report))}</pre>`);

  parts.push(
    `<details><summary>This run used ${outcome.uncalibrated.length} uncalibrated ` +
      `constants — numbers nobody has measured</summary><pre class="text">` +
      `${escapeHtml(formatUncalibratedReport(outcome.uncalibrated))}</pre></details>`,
  );

  parts.push('<h2>Check another</h2>');
  parts.push(form(options, text, report.language));
  parts.push(limits(options));

  return layout(parts.join('\n'));
}

function findingList(rule: RuleResult): string {
  const shown = rule.findings.slice(0, 5);
  const more = rule.findings.length - shown.length;
  return (
    '<ul>' +
    shown
      .map(
        (f) =>
          `<li><code>${f.line}:${f.column}</code> — ${escapeHtml(
            f.text.replace(/\s+/gu, ' ').trim(),
          )}</li>`,
      )
      .join('') +
    (more > 0 ? `<li>…and ${more} more</li>` : '') +
    '</ul>'
  );
}
