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
- [012. The negative corpus is generated, and the provenance is the label](012-the-negative-corpus-is-generated.md)
- [013. The public surface is `check` only, and the split is marginal cost](013-the-public-surface-splits-on-marginal-cost.md)
- [014. The catalogue was adopted on authority, and the first measurement retired half of it](014-the-catalogue-was-adopted-on-authority.md)
- [015. An observation window shorter than the phenomenon produces a confident negative](015-an-observation-window-shorter-than-the-phenomenon.md)
- [016. `agent-evals` is a pinned dev dependency, and it costs 400MB](016-agent-evals-is-a-pinned-dev-dependency.md) — superseded by 017
- [017. The pinned eval harness costs build time, not disk — and the ONNX runtime is still downloaded](017-the-pinned-dependency-costs-build-time-not-disk.md)
- [018. The analyst is scored against sentences a human marked, deterministically](018-the-analyst-is-scored-against-marked-sentences.md)
- [019. The analyst pilot measured the labels at least as much as the analyst](019-the-analyst-pilot-measured-the-labels.md)

## A note on the dates

Every ADR here is dated 2026-08-26, because that is when all of them were
written — four days of project work inside one calendar day.

Earlier versions of 005 through 011 were dated 2026-08-27 and 2026-08-28. Those
dates were incremented by hand to match the narrative rather than read from a
clock, and nothing in the repository checked them. That is the defect
[ADR 017 in agent-evals](https://github.com/f-stojanovic/agent-evals/blob/main/docs/decisions/017-checkable-documentation-claims-are-checked.md)
exists for, occurring in a file whose whole purpose is to record what was
actually observed. Corrected on 2026-08-26; the Evidence lines that quoted
those dates are corrected with them.
