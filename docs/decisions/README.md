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
