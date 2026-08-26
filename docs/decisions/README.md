# Decisions

Architecture decision records, in the format used by
[agent-evals](https://github.com/f-stojanovic/agent-evals). Each carries a
`Status:` and an `Evidence:` line, and the Evidence line is the point: it says
what has actually been observed about the decision, including when the answer
is "nothing yet".

- [001. Two kinds of rule: hard and density](001-two-kinds-of-rule.md)
- [002. Scores are continuous, because the objection is accumulation](002-scores-are-continuous.md)
- [003. Lexicons are versioned data, and a score is only comparable within a version](003-lexicons-are-versioned-data.md)
- [004. Findings carry positions from the start](004-findings-carry-positions.md)
- [005. A density rule may abstain, and an abstention is not a pass](005-density-rules-abstain.md)
- [006. Every lexicon entry carries the example that proves it works](006-lexicon-entries-carry-their-examples.md)
- [007. The analyst returns structure, not prose](007-the-analyst-returns-structure.md)
- [008. There is no writing agent](008-there-is-no-writing-agent.md)
- [009. Agents take an injected client, so tests never touch the network](009-agents-are-injected.md)
- [010. The analyst’s only mechanical check is whether its evidence exists](010-the-analyst-has-one-mechanical-check.md)
- [011. Calibration recommends; a human moves the constant](011-calibration-recommends.md)
