/**
 * Underlining findings in the submitted text.
 *
 * THIS IS WHY POSITIONS WERE RECORDED ON DAY ONE. ADR 004 justified carrying
 * `line`, `column` and `offset` on every finding with an argument about a
 * future editor that would underline the exact span, and noted that a position
 * cannot be reconstructed from a count. This file is that argument being
 * cashed: it slices the original text at offsets that were computed against
 * that same string, with no re-matching and no re-running of any rule.
 *
 * OVERLAPS ARE REAL and have to be handled. `inflated-vocabulary` and
 * `rule-of-three` can both fire on the same span, and `negative-parallelism`
 * matches a whole clause that may contain a shorter finding. Nested marks
 * would produce invalid nesting and double-count characters, so overlapping
 * spans are merged into one mark carrying every rule that claimed it.
 */

import type { Report } from '../types.js';

export interface Span {
  readonly start: number;
  readonly end: number;
  readonly rules: readonly string[];
  /** True when every rule that claimed this span abstained rather than scored. */
  readonly observedOnly: boolean;
}

/** Merges every finding in a report into non-overlapping, annotated spans. */
export function spansFor(report: Report): readonly Span[] {
  const raw = report.rules.flatMap((rule) =>
    rule.findings.map((f) => ({
      start: f.offset,
      end: f.offset + f.text.length,
      rule: rule.rule,
      scored: rule.outcome === 'scored',
    })),
  );
  if (raw.length === 0) return [];

  raw.sort((a, b) => a.start - b.start || b.end - a.end);

  const merged: Span[] = [];
  let start = raw[0]?.start ?? 0;
  let end = raw[0]?.end ?? 0;
  let rules = new Set<string>();
  let scored = false;

  const flush = (): void => {
    merged.push({ start, end, rules: [...rules].sort(), observedOnly: !scored });
  };

  for (const hit of raw) {
    if (hit.start >= end) {
      flush();
      start = hit.start;
      end = hit.end;
      rules = new Set();
      scored = false;
    }
    end = Math.max(end, hit.end);
    rules.add(hit.rule);
    scored = scored || hit.scored;
  }
  flush();
  return merged;
}

/** HTML-escapes text. Called on every fragment; nothing reaches the page raw. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

/**
 * The submitted text with findings wrapped in `<mark>`.
 *
 * Escaping happens per fragment rather than on the whole string first, because
 * escaping changes lengths — `&` becomes `&amp;` — and every offset in the
 * report was computed against the unescaped original. Escape first and every
 * span after the first ampersand lands in the wrong place.
 */
export function highlight(text: string, spans: readonly Span[]): string {
  const parts: string[] = [];
  let cursor = 0;

  for (const span of spans) {
    if (span.start < cursor) continue; // defensive: merged spans should not overlap
    parts.push(escapeHtml(text.slice(cursor, span.start)));
    const title = escapeHtml(
      `${span.rules.join(', ')}${span.observedOnly ? ' (observed, not scored)' : ''}`,
    );
    parts.push(
      `<mark class="${span.observedOnly ? 'observed' : 'finding'}" title="${title}">` +
        `${escapeHtml(text.slice(span.start, span.end))}</mark>`,
    );
    cursor = span.end;
  }
  parts.push(escapeHtml(text.slice(cursor)));
  return parts.join('');
}
