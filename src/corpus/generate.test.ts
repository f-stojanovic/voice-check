import { readdirSync, readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { scriptedClient } from '../agents/agents.test-kit.js';
import { stripFrontmatter } from '../calibrate-report.js';
import { frontmatter, generate, writeCorpus } from './generate.js';
import { SUBJECTS } from './subjects.js';

const TEXTS = Array.from({ length: 4 }, (_, i) => `Generated body ${i}.\n\nSecond paragraph.`);

describe('the corpus generator', () => {
  it('sends the bare subject with no style instruction and no system prompt', async () => {
    // The whole design. A prompt asking for good writing would produce a
    // corpus measuring how well the model follows style instructions, and a
    // system prompt is a style instruction even when it is trying not to be.
    const client = scriptedClient([], { texts: TEXTS });
    await generate(client, { language: 'en', count: 2, date: '2026-08-26' });
    expect(client.completions).toHaveLength(2);
    for (const request of client.completions) {
      expect(request.system).toBeUndefined();
      expect(request.userContent).toBe(
        SUBJECTS[client.completions.indexOf(request)]?.prompt.en,
      );
    }
  });

  it('uses the prose path, not a forced tool call', async () => {
    // A forced tool call is a different mode of generation. Text produced to
    // fill a schema field is not the text a model writes when asked for a post.
    const client = scriptedClient([], { texts: TEXTS });
    await generate(client, { language: 'en', count: 1, date: '2026-08-26' });
    expect(client.requests).toHaveLength(0);
    expect(client.completions).toHaveLength(1);
  });

  it('labels every document by construction, in its own frontmatter', async () => {
    const client = scriptedClient([], { texts: TEXTS });
    const result = await generate(client, { language: 'sr', count: 1, date: '2026-08-26' });
    const meta = parseYaml(
      /^---\n([\s\S]*?)\n---/u.exec(result.docs[0]?.contents ?? '')?.[1] ?? '',
    ) as Record<string, unknown>;
    expect(meta['provenance']).toBe('generated');
    expect(meta['model']).toBe('claude-opus-5');
    expect(meta['generated']).toBe('2026-08-26');
    expect(meta['prompt']).toBe(SUBJECTS[0]?.prompt.sr);
  });

  it('carries the label with the sample rather than in a sidecar index', () => {
    // A text copied out of the directory without its provenance becomes a text
    // somebody might mistake for a human's.
    const block = frontmatter({
      subject: 's',
      format: 'howto',
      language: 'en',
      model: 'claude-opus-5',
      date: '2026-08-26',
      prompt: 'Write a blog post.',
      words: 100,
    });
    expect(block.startsWith('---\n')).toBe(true);
    expect(block).toContain('provenance: generated');
  });

  it('emits each document as it arrives, so a late failure loses nothing', async () => {
    // The first version returned everything at the end and wrote nothing until
    // the whole run succeeded, so a failure on the fifteenth call threw away
    // fourteen paid-for generations.
    const seen: string[] = [];
    const client = scriptedClient([], { texts: TEXTS });
    await generate(client, {
      language: 'en',
      count: 3,
      date: '2026-08-26',
      onDoc: (doc) => seen.push(doc.filename),
    });
    expect(seen).toHaveLength(3);
  });

  it('records what the run cost', async () => {
    const client = scriptedClient([], { texts: TEXTS });
    const result = await generate(client, { language: 'en', count: 2, date: '2026-08-26' });
    expect(result.usage.outputTokens).toBe(800);
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it('writes files whose frontmatter round-trips through the corpus reader', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'voice-check-gen-'));
    const client = scriptedClient([], { texts: TEXTS });
    const result = await generate(client, { language: 'en', count: 2, date: '2026-08-26' });
    writeCorpus(dir, result.docs);

    expect(readdirSync(dir)).toHaveLength(2);
    const raw = readFileSync(join(dir, result.docs[0]?.filename ?? ''), 'utf8');
    const { text, provenance } = stripFrontmatter(raw);
    expect(provenance).toBe('generated');
    // The frontmatter must not survive into the prose: it contains a prompt
    // sentence, a model id and a date, and all three would enter the density
    // denominators and the sentence-length distribution.
    expect(text).not.toContain('provenance');
    expect(text.trim().startsWith('Generated body')).toBe(true);
  });

  it('gives every subject a prompt in both languages', () => {
    for (const subject of SUBJECTS) {
      expect(subject.prompt.sr.length, subject.id).toBeGreaterThan(10);
      expect(subject.prompt.en.length, subject.id).toBeGreaterThan(10);
    }
  });

  it('spans all four formats', () => {
    expect(new Set(SUBJECTS.map((s) => s.format))).toEqual(
      new Set(['review', 'explainer', 'experience', 'howto']),
    );
  });
});
