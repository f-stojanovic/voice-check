/**
 * Reading the API key from one file, by path, and from nowhere else.
 *
 * WHY NOT `process.env`. The convenient thing is `new Anthropic()` with no
 * arguments: the SDK resolves `ANTHROPIC_API_KEY`, then `ANTHROPIC_AUTH_TOKEN`,
 * then an `ant auth login` profile on disk. That resolution order is a feature
 * in a terminal and a hazard in a tool that spends money — it means a run can
 * be authenticated by a credential nobody in this repository chose, inherited
 * from a shell, a parent process, or a machine-wide profile, and the run
 * succeeds either way so nothing ever surfaces the difference.
 *
 * This project reads `.env` at a path it computes, parses it, and passes the
 * key explicitly. `process.env` is neither read nor written. A missing key is
 * an error naming the file, not a silent fallback to whatever else is around.
 *
 * The cost is that the ambient credential a developer already has does not
 * work here, and they will have to write a `.env`. That is the intended
 * trade: an explicit file is a thing you can point at when asking "which key
 * paid for this run?".
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse as parseEnv } from 'dotenv';

/** `.env` sits at the project root, beside `package.json`. */
export const DEFAULT_ENV_PATH = fileURLToPath(new URL('../../.env', import.meta.url));

export class MissingApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingApiKeyError';
  }
}

/**
 * The API key, from the given file.
 *
 * `dotenv.parse` rather than `dotenv.config`: `config` mutates `process.env`,
 * which is exactly the ambient state this module exists to avoid touching.
 */
export function readApiKey(path: string = DEFAULT_ENV_PATH): string {
  let source: string;
  try {
    source = readFileSync(path, 'utf8');
  } catch {
    throw new MissingApiKeyError(
      `no .env at ${path}. voice-check reads the API key from that file and ` +
        `never from the environment, so an ANTHROPIC_API_KEY exported in your ` +
        `shell will not be picked up. Create the file with:\n\n` +
        `  ANTHROPIC_API_KEY=sk-ant-...\n`,
    );
  }

  const parsed = parseEnv(source);
  const key = parsed['ANTHROPIC_API_KEY']?.trim();
  if (key === undefined || key.length === 0) {
    throw new MissingApiKeyError(
      `${path} has no ANTHROPIC_API_KEY. Add a line reading ANTHROPIC_API_KEY=sk-ant-...`,
    );
  }
  return key;
}
