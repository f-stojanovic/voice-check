/**
 * The angles agent: given an analysis and an audience, what could be written?
 *
 * IT PREPARES MATERIAL. IT DOES NOT WRITE THE POST, and that boundary is a
 * product decision rather than a limitation — see ADR 008 and `no-writer.ts`.
 *
 * THE FIELD THAT MATTERS MOST IS `questionForWriter`. The other two —
 * `hook` and `whyThisAudience` — are the parts a model is good at and the
 * parts that are worth least, because a hook nobody has lived is a hook. The
 * question is the part that does work: it asks the writer which of his own
 * experiences the angle touches, and the answer to that question is the only
 * thing in the eventual post that a model could not have produced.
 *
 * The style guide this project compiles reaches the same conclusion from the
 * other end: the tells it catalogues are all symptoms of writing with nothing
 * behind it. A tool that drafted in the author's voice would be manufacturing
 * exactly the thing the guide rejects, and then grading it with the checker
 * next door. The angles agent stops one step short on purpose.
 */

import { z } from 'zod';
import type { Language } from '../types.js';
import { runOf, type AgentRun, type ModelClient, MalformedToolCallError } from './client.js';
import type { Analysis } from './analyst.js';

const AngleSchema = z.object({
  hook: z.string().min(1),
  whyThisAudience: z.string().min(1),
  questionForWriter: z.string().min(1),
});

export const AnglesSchema = z.object({
  /**
   * Two or three. Bounded in Zod rather than in the JSON Schema because array
   * length constraints are among the ones the API drops from a strict schema,
   * so enforcing them there would look like a guarantee and be a suggestion.
   */
  angles: z.array(AngleSchema).min(2).max(3),
  /**
   * What the analysis did NOT give enough to work with. Present so the agent
   * has somewhere to put "there is not much here" other than inventing a third
   * angle to fill the array.
   */
  thin: z.string(),
});

export type Angles = z.infer<typeof AnglesSchema>;

export interface AudienceProfile {
  readonly language: Language;
  readonly description: string;
}

/** The audience this tool was built for. Passed explicitly, not assumed. */
export const DEFAULT_AUDIENCE: AudienceProfile = {
  language: 'sr',
  description:
    'Serbian-speaking beginners, mostly non-technical. They are not building ' +
    'AI systems and are not going to. What they want to know is: what does ' +
    'this change for me, concretely, this month? They are suspicious of hype ' +
    'and they switch off at jargon.',
};

export const ANGLES_TOOL_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['angles', 'thin'],
  properties: {
    angles: {
      type: 'array',
      description: 'Two or three angles. Two good ones beat three.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['hook', 'whyThisAudience', 'questionForWriter'],
        properties: {
          hook: {
            type: 'string',
            description:
              'The opening move — the concrete situation this angle starts from, ' +
              'in ONE OR TWO SENTENCES. Not a headline, not a summary of the ' +
              'source, and not a paragraph: the writer needs a starting point he ' +
              'can hold in his head, not a draft of the opening.',
          },
          whyThisAudience: {
            type: 'string',
            description:
              'Why THIS audience specifically would care, in terms of what ' +
              'changes for them. If the honest answer is "they would not", say that.',
          },
          questionForWriter: {
            type: 'string',
            description:
              'A question back to the writer asking which of HIS OWN experiences ' +
              'this angle touches. Specific to the angle — not "have you seen this ' +
              'before?" but a question only this angle would prompt. This is the ' +
              'most important field: the writer answers it, and his answer is the ' +
              'part of the eventual post that you could not have written.',
          },
        },
      },
    },
    thin: {
      type: 'string',
      description:
        'What the analysis did not give you enough of. Empty string if it gave ' +
        'you plenty. Do not invent an angle to fill the array.',
    },
  },
};

const SYSTEM = `You are preparing material for a writer. You are not writing anything he will publish, and nothing you produce should read as a draft.

You will be given a structured analysis of a source and a description of the audience. Produce two or three angles that writer could take.

Each angle needs three things, and the third is the one that matters:

1. A hook — the concrete situation the piece would open from, in one or two sentences. Not a paragraph.
2. Why this specific audience would care. If the honest answer is that they would not, say that instead of manufacturing a reason.
3. A question back to the writer, asking which of his own experiences this angle touches. Make it specific to the angle. This is the field that earns the tool its place: everything else here is material, and his answer is the only part of the eventual piece that has a person behind it.

Two strong angles beat three. If the analysis is thin, say so in the "thin" field rather than padding the array.

Write in the audience's language.`;

export const ANGLES_TOOL = {
  name: 'record_angles',
  description:
    'Record the angles prepared for the writer. This is the only way to return ' +
    'your answer; there is no prose channel.',
  inputSchema: ANGLES_TOOL_SCHEMA,
};

export async function findAngles(
  client: ModelClient,
  analysis: Analysis,
  audience: AudienceProfile = DEFAULT_AUDIENCE,
): Promise<AgentRun<Angles>> {
  const response = await client.callTool({
    system: SYSTEM,
    tool: ANGLES_TOOL,
    userContent:
      `AUDIENCE (write in ${audience.language === 'sr' ? 'Serbian' : 'English'}):\n` +
      `${audience.description}\n\n` +
      `ANALYSIS OF THE SOURCE:\n${JSON.stringify(analysis, null, 2)}`,
  });

  const parsed = AnglesSchema.safeParse(response.input);
  if (!parsed.success) {
    throw new MalformedToolCallError(
      `record_angles returned a shape that does not validate:\n` +
        parsed.error.issues
          .map((i) => `  at ${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('\n'),
    );
  }

  return runOf(parsed.data, response);
}
