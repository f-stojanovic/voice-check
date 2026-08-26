import { describe, expect, it } from 'vitest';
import { AnalysisSchema } from './analyst.js';
import { ANGLES_TOOL_SCHEMA, AnglesSchema, DEFAULT_AUDIENCE, findAngles } from './angles.js';
import { MalformedToolCallError, ModelUnavailableError } from './client.js';
import { failingClient, GOOD_ANALYSIS, GOOD_ANGLES, scriptedClient } from './agents.test-kit.js';

const analysis = AnalysisSchema.parse(GOOD_ANALYSIS);

describe('the angles agent', () => {
  it('returns validated angles from a well-formed tool call', async () => {
    const run = await findAngles(scriptedClient([GOOD_ANGLES]), analysis);
    expect(run.value.angles).toHaveLength(2);
    expect(run.value.angles[0]?.hook).toContain('kvari polako');
  });

  it('requires a question back to the writer on every angle', async () => {
    // The field the tool exists for. An angle without it is material with no
    // handover, which is the part a model could have produced alone.
    const run = await findAngles(scriptedClient([GOOD_ANGLES]), analysis);
    for (const angle of run.value.angles) {
      expect(angle.questionForWriter.length).toBeGreaterThan(10);
    }
  });

  it('rejects a single angle, because two is the declared minimum', async () => {
    const one = { angles: [GOOD_ANGLES.angles[0]], thin: '' };
    await expect(findAngles(scriptedClient([one]), analysis)).rejects.toThrow(
      MalformedToolCallError,
    );
  });

  it('rejects four angles, because padding is the failure mode being guarded', async () => {
    const four = {
      angles: [0, 1, 2, 3].map((i) => ({
        hook: `h${i}`,
        whyThisAudience: `w${i}`,
        questionForWriter: `q${i}`,
      })),
      thin: '',
    };
    await expect(findAngles(scriptedClient([four]), analysis)).rejects.toThrow(
      /angles/,
    );
  });

  it('rejects a malformed tool call with the offending path named', async () => {
    const malformed = { angles: [{ hook: 'h' }], thin: '' };
    await expect(findAngles(scriptedClient([malformed]), analysis)).rejects.toThrow(
      /at angles\.0\.whyThisAudience/,
    );
  });

  it('propagates an API error as itself', async () => {
    const client = failingClient(new ModelUnavailableError('API error 429 — rate limited', 429));
    await expect(findAngles(client, analysis)).rejects.toThrow(ModelUnavailableError);
  });

  it('passes the audience profile to the model, rather than assuming one', async () => {
    const client = scriptedClient([GOOD_ANGLES]);
    await findAngles(client, analysis, {
      language: 'en',
      description: 'Bricklayers who have never heard of Postgres.',
    });
    expect(client.requests[0]?.userContent).toContain('Bricklayers');
    expect(client.requests[0]?.userContent).toContain('write in English');
  });

  it('receives the analysis as structure, not as prose', async () => {
    // The two agents are chained on a validated object. If the first one's
    // output were prose, this seam would need a parser.
    const client = scriptedClient([GOOD_ANGLES]);
    await findAngles(client, analysis);
    expect(JSON.parse(client.requests[0]?.userContent.split('ANALYSIS OF THE SOURCE:\n')[1] ?? '{}'))
      .toEqual(analysis);
  });

  it('gives the model somewhere to say the analysis was thin', async () => {
    const run = await findAngles(
      scriptedClient([{ ...GOOD_ANGLES, thin: 'Nema podataka, samo tvrdnje.' }]),
      analysis,
    );
    expect(run.value.thin).toContain('Nema podataka');
  });

  it('defaults to the audience this tool was built for', () => {
    expect(DEFAULT_AUDIENCE.language).toBe('sr');
    expect(DEFAULT_AUDIENCE.description).toContain('what does');
  });
});

describe('the angles tool schema', () => {
  it('names the same fields as the Zod schema', () => {
    const json = Object.keys(
      (ANGLES_TOOL_SCHEMA as { properties: Record<string, unknown> }).properties,
    ).sort();
    expect(json).toEqual(Object.keys(AnglesSchema.shape).sort());
  });

  it('does not claim the array bound in JSON Schema, which would not be enforced', () => {
    // Array length is among the constraints a strict schema drops. Declaring
    // minItems here would look like a guarantee and be a suggestion; the bound
    // lives in Zod, where it is checked.
    const angles = (ANGLES_TOOL_SCHEMA as { properties: Record<string, Record<string, unknown>> })
      .properties['angles'];
    expect(angles?.['minItems']).toBeUndefined();
    expect(angles?.['maxItems']).toBeUndefined();
  });
});
