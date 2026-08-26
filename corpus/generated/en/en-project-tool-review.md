---
provenance: generated
subject: project-tool-review
format: review
language: en
model: claude-opus-5
generated: 2026-08-26
words: 1097
prompt: Write a blog post about a project management tool you have used.
---

A quick note before the post: I don't use software myself, so I've written this in the first-person voice of a team lead — the way you'd want a blog post like this to read. Swap in your own team size, timeline, and war stories and it'll ring true.

---

# We Ran Our Team on Trello for Two Years. Here's What Actually Worked.

When our team grew from four people to eleven in about six months, our project management system — a shared spreadsheet and a lot of optimism — collapsed under its own weight. Tasks fell through gaps. Two people built the same feature. Someone shipped a change nobody knew was coming.

We needed something real. We tried Trello because it was free, and we were still using it two years later. Here's an honest account of what worked, what didn't, and who I'd recommend it to.

## The core idea: everything is a card on a board

Trello is Kanban with the sanding done. You create a **board** for a project, **lists** for stages of work, and **cards** for individual tasks. You drag cards from left to right as work progresses. That's the whole model, and its simplicity is the entire reason it worked for us.

Our main board had five lists:

- **Backlog** — anything we might do
- **This Sprint** — committed work for the next two weeks
- **In Progress** — actively being worked on
- **In Review** — waiting on a code review or stakeholder sign-off
- **Done** — shipped

Onboarding a new hire took about four minutes. I'd walk them to the board, explain the five columns, and they'd start moving their own cards the same day. Compare that to the two-hour training session our previous company ran for Jira, and you understand why simple tools survive.

## The features we actually used

Most software has a hundred features and you use six. These were our six.

**Checklists inside cards.** A card called "Redesign onboarding email" is useless on its own. A card with a checklist — draft copy, design review, build in the email tool, QA on mobile, schedule send — is a plan. Checklists were where the real work lived, and Trello shows a little progress bar (4/7) on the card face so you can see momentum without opening anything.

**Due dates and the calendar view.** Cards with due dates turn yellow when they're close and red when they're late. Crude, but effective. Nobody likes a red card with their face on it.

**Labels.** We used color-coded labels for work type: green for features, red for bugs, blue for infrastructure, purple for design. Six months in, I could glance at the board and see we'd become 60% red. That single visual cue kicked off a conversation about technical debt that we'd otherwise have kept postponing.

**@-mentions and comments.** Discussion lived on the card, attached to the work. When someone asked six months later "why did we decide to skip the SSO integration?", the answer was in the card's comment thread — not lost in a Slack channel or someone's inbox.

**Butler automation.** This is Trello's most underrated feature and it took me an embarrassingly long time to find it. Butler lets you write simple rules in near-plain English. Ours included:

- When a card moves to "Done," check all its checklist items and remove the due date.
- Every Monday at 9am, post a card called "Weekly planning" to the top of This Sprint.
- When a card sits in "In Review" for more than three days, comment `@lead` and add a red "Stalled" label.

That last one alone saved us. Review bottlenecks are invisible until you make them loud.

**Power-Ups.** Trello's plugins. We used exactly two: the GitHub Power-Up, which showed pull request status directly on cards, and a calendar view. Resist the urge to install more.

## Where it fell apart

I'd be doing you a disservice if I only praised it.

**Dependencies are essentially unsupported.** If Task B can't start until Task A finishes, Trello has no native way to express that. You link cards manually and hope people notice. For a team building anything with a real critical path, this is a serious gap — it's the main reason larger orgs end up on Jira, Asana, or Linear.

**Reporting is thin.** I could not answer "how much did we ship last quarter compared to the one before?" without exporting data and building the chart myself. If your manager wants velocity charts and burndowns, Trello will frustrate you.

**Boards don't scale past a certain point.** Around 150 cards, our backlog became a place where ideas went to die. Scrolling a Kanban list is a bad way to review a large body of work. We eventually moved the backlog to a separate board and reviewed it monthly, which helped, but it was a workaround for a real limitation.

**No built-in time tracking or resource management.** If you bill clients hourly or need to see who's over-allocated, you'll need a Power-Up or a second tool.

## Three things I'd tell my past self

**Enforce a work-in-progress limit.** The whole point of Kanban is that finishing beats starting. We didn't cap "In Progress" for the first year, and people routinely had five open cards and zero finished ones. When we capped it at two cards per person, our cycle time dropped noticeably. Trello can display a warning when a list exceeds a set number — turn it on.

**Write cards as outcomes, not topics.** "Login page" is not a task. "Users can reset their password without contacting support" is. The second one tells you when you're done.

**Archive relentlessly.** A board cluttered with three-month-old Done cards is a board people stop looking at. We archived the Done list every two weeks. The cards are still searchable; they're just out of the way.

## Who should use it

**Yes, if:** you're a team of 3–15, your work is reasonably independent, and you value adoption over sophistication. A simple tool everyone uses beats a powerful tool half the team ignores. Trello is also excellent for non-engineering teams — marketing calendars, hiring pipelines, content production — where Jira would be absurd overkill.

**No, if:** you're managing complex dependencies, need real portfolio-level reporting, run a team larger than about 20, or have compliance requirements around audit trails and permissions.

## The verdict

Trello didn't make us better at our jobs. It made our work *visible*, and visibility is what let us fix the actual problems — the review bottleneck, the bug tide, the two people building the same thing.

That's the lesson I'd take from two years with it: the tool isn't the system. The tool is a mirror. Pick the one your team will actually look into.
