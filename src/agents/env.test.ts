import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MissingApiKeyError, readApiKey } from './env.js';

function envFile(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'voice-check-env-'));
  const path = join(dir, '.env');
  writeFileSync(path, contents);
  return path;
}

describe('reading the API key', () => {
  it('reads it from the file it was given', () => {
    expect(readApiKey(envFile('ANTHROPIC_API_KEY=sk-ant-from-the-file\n'))).toBe(
      'sk-ant-from-the-file',
    );
  });

  it('ignores an ambient ANTHROPIC_API_KEY entirely', () => {
    // The point of the module. A run authenticated by a credential nobody in
    // this repository chose succeeds identically to one that was, so nothing
    // ever surfaces the difference.
    const previous = process.env['ANTHROPIC_API_KEY'];
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-from-the-shell';
    try {
      expect(readApiKey(envFile('ANTHROPIC_API_KEY=sk-ant-from-the-file\n'))).toBe(
        'sk-ant-from-the-file',
      );
      expect(() => readApiKey('/nonexistent/.env')).toThrow(MissingApiKeyError);
    } finally {
      if (previous === undefined) delete process.env['ANTHROPIC_API_KEY'];
      else process.env['ANTHROPIC_API_KEY'] = previous;
    }
  });

  it('does not write to process.env', () => {
    // `dotenv.config` would; `dotenv.parse` does not. The distinction is the
    // whole implementation.
    const before = process.env['VOICE_CHECK_CANARY'];
    readApiKey(envFile('ANTHROPIC_API_KEY=k\nVOICE_CHECK_CANARY=leaked\n'));
    expect(process.env['VOICE_CHECK_CANARY']).toBe(before);
  });

  it('names the file when it is missing', () => {
    expect(() => readApiKey('/nonexistent/.env')).toThrow(/no \.env at \/nonexistent\/\.env/);
    expect(() => readApiKey('/nonexistent/.env')).toThrow(/never from the environment/);
  });

  it('names the variable when the file has no key', () => {
    expect(() => readApiKey(envFile('SOMETHING_ELSE=1\n'))).toThrow(/no ANTHROPIC_API_KEY/);
  });

  it('rejects a blank key rather than sending it', () => {
    expect(() => readApiKey(envFile('ANTHROPIC_API_KEY=   \n'))).toThrow(MissingApiKeyError);
  });
});
