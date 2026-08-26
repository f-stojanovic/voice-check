/**
 * The subjects the negative corpus is generated from.
 *
 * ORDINARY ON PURPOSE. A corpus of texts about AI would measure how the model
 * writes about AI, which is its most hype-saturated register and would flatter
 * every rule. These are the subjects a general-interest blog actually covers,
 * across the four formats the guide's catalogue was drawn from: a tool review,
 * an explainer, a personal-experience post, a how-to.
 *
 * THE PROMPTS CARRY NO STYLE INSTRUCTION. Not "write engagingly", not "avoid
 * clichés", not a tone, not a length, not an audience. The whole point is the
 * DEFAULT REGISTER — what the model writes when nobody constrains it — because
 * that default is what the ceiling is supposed to describe. A prompt asking
 * for good writing would produce a corpus measuring how well the model follows
 * style instructions, which is a different question and the wrong one.
 *
 * A consequence worth stating: length is unconstrained too, so a generated
 * text may fall below a rule's abstention gate and contribute nothing. That is
 * the correct behaviour and the calibration report counts it.
 *
 * THE ONE THING THE SERBIAN PROMPTS DO CONSTRAIN is the language variant, and
 * that constraint was added because the first run measured the need for it.
 * Prompted with the subject alone, the model returned Croatian in all fifteen
 * documents — 77 `što` to 29 `šta`, ijekavian throughout. The Serbian rules
 * are ekavica-specific, so that corpus could not calibrate them.
 *
 * A variant is not a style instruction. `ekavicom` says which standard to
 * write, not how to write it, in the same way that asking for Serbian at all
 * does. The first corpus is kept in `corpus/archive/sr-croatian-drift/` as the
 * evidence that made this necessary.
 */

import type { Language } from '../types.js';

export interface Subject {
  readonly id: string;
  readonly format: 'review' | 'explainer' | 'experience' | 'howto';
  readonly prompt: Readonly<Record<Language, string>>;
}

export const SUBJECTS: readonly Subject[] = [
  {
    id: 'project-tool-review',
    format: 'review',
    prompt: {
      sr: 'Napiši blog post o alatu za upravljanje projektima koji si koristio. Piši na srpskom jeziku, ekavicom.',
      en: 'Write a blog post about a project management tool you have used.',
    },
  },
  {
    id: 'coffee-grinder-review',
    format: 'review',
    prompt: {
      sr: 'Napiši blog post o mlinu za kafu koji si kupio. Piši na srpskom jeziku, ekavicom.',
      en: 'Write a blog post about a coffee grinder you bought.',
    },
  },
  {
    id: 'noise-cancelling-review',
    format: 'review',
    prompt: {
      sr: 'Napiši blog post o slušalicama sa aktivnim poništavanjem buke. Piši na srpskom jeziku, ekavicom.',
      en: 'Write a blog post about noise-cancelling headphones.',
    },
  },
  {
    id: 'ebike-review',
    format: 'review',
    prompt: {
      sr: 'Napiši blog post o električnom biciklu koji voziš godinu dana. Piši na srpskom jeziku, ekavicom.',
      en: 'Write a blog post about an electric bike you have ridden for a year.',
    },
  },
  {
    id: 'compound-interest-explainer',
    format: 'explainer',
    prompt: {
      sr: 'Napiši blog post koji objašnjava kako radi složena kamata. Piši na srpskom jeziku, ekavicom.',
      en: 'Write a blog post explaining how compound interest works.',
    },
  },
  {
    id: 'sleep-explainer',
    format: 'explainer',
    prompt: {
      sr: 'Napiši blog post o tome zašto je san važan. Piši na srpskom jeziku, ekavicom.',
      en: 'Write a blog post about why sleep matters.',
    },
  },
  {
    id: 'dns-explainer',
    format: 'explainer',
    prompt: {
      sr: 'Napiši blog post koji objašnjava šta je DNS. Piši na srpskom jeziku, ekavicom.',
      en: 'Write a blog post explaining what DNS is.',
    },
  },
  {
    id: 'renting-explainer',
    format: 'explainer',
    prompt: {
      sr: 'Napiši blog post o tome šta treba proveriti pre potpisivanja ugovora o zakupu. Piši na srpskom jeziku, ekavicom.',
      en: 'Write a blog post about what to check before signing a rental agreement.',
    },
  },
  {
    id: 'marathon-experience',
    format: 'experience',
    prompt: {
      sr: 'Napiši blog post o tome kako si trčao prvi maraton. Piši na srpskom jeziku, ekavicom.',
      en: 'Write a blog post about running your first marathon.',
    },
  },
  {
    id: 'moving-city-experience',
    format: 'experience',
    prompt: {
      sr: 'Napiši blog post o selidbi u drugi grad. Piši na srpskom jeziku, ekavicom.',
      en: 'Write a blog post about moving to another city.',
    },
  },
  {
    id: 'career-change-experience',
    format: 'experience',
    prompt: {
      sr: 'Napiši blog post o promeni karijere u tridesetim godinama. Piši na srpskom jeziku, ekavicom.',
      en: 'Write a blog post about changing careers in your thirties.',
    },
  },
  {
    id: 'learning-instrument-experience',
    format: 'experience',
    prompt: {
      sr: 'Napiši blog post o učenju instrumenta u odraslom dobu. Piši na srpskom jeziku, ekavicom.',
      en: 'Write a blog post about learning an instrument as an adult.',
    },
  },
  {
    id: 'sourdough-howto',
    format: 'howto',
    prompt: {
      sr: 'Napiši blog post o tome kako se pravi hleb od kiselog testa. Piši na srpskom jeziku, ekavicom.',
      en: 'Write a blog post about how to make sourdough bread.',
    },
  },
  {
    id: 'budget-howto',
    format: 'howto',
    prompt: {
      sr: 'Napiši blog post o tome kako da napraviš mesečni budžet. Piši na srpskom jeziku, ekavicom.',
      en: 'Write a blog post about how to set up a monthly budget.',
    },
  },
  {
    id: 'houseplants-howto',
    format: 'howto',
    prompt: {
      sr: 'Napiši blog post o tome kako da održiš sobne biljke u životu. Piši na srpskom jeziku, ekavicom.',
      en: 'Write a blog post about how to keep houseplants alive.',
    },
  },
  {
    id: 'bike-maintenance-howto',
    format: 'howto',
    prompt: {
      sr: 'Napiši blog post o osnovnom održavanju bicikla. Piši na srpskom jeziku, ekavicom.',
      en: 'Write a blog post about basic bicycle maintenance.',
    },
  },
];
