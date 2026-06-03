# Eval Decision Rules

## Purpose

Define how PromptOpts decides whether a prompt/model setup is safe to recommend.

## Source Summary

The public playbook defines the quality contract, eval matrix, must-pass checks, pass threshold, and final recommendation. The wireframes emphasize that risk appears before savings and that the matrix shows failed combos, cheapest passing point, and operational risk.

## Decisions

- Eval proof is the value proof.
- Quality contract is required before production recommendation.
- Manual cases and CSV upload are enough for MVP.
- CSV upload supports 5 to 50 cases for MVP.
- Deterministic checks come first: exact fields, JSON schema, regex, required phrases, exact labels.
- LLM-as-judge is allowed for nuanced tone/relevance but must be labeled distinctly.
- Human thumbs-up/down can seed trust data without building a full review platform.
- The eval matrix compares original and optimized prompts across current and same-provider candidate models.
- The original prompt + current model remains the regression baseline.

## Non-Negotiables

- No production recommendation without configured eval pass threshold.
- No production recommendation with any must-pass failure.
- Default threshold is 95 percent pass rate plus zero must-pass failures unless user config says stricter.
- Reject any candidate with a must-pass failure.
- Rank only passing candidates.
- Risk appears before savings in audit, matrix, and report.
- Final report returns one winner, one cheaper alternative, and one stronger fallback.
- If no tests are added, allow audit but disable production recommendation.
- If registry metadata is stale, block exact savings claims or label them unverified.

## Implementation Notes

Recommendation ranking after hard gates:

1. Exclude must-pass failures.
2. Exclude candidates below threshold.
3. Preserve baseline as regression control.
4. Rank passing candidates by cost, latency, consistency, and risk.
5. Select the cheapest safe default that satisfies quality.
6. Select a cheaper alternative only for low-risk use if it passes threshold.
7. Select a stronger fallback for escalations, ambiguity, high-risk inputs, or low confidence.

Eval matrix columns:

- Prompt candidate.
- Model candidate.
- Quality score.
- Pass rate.
- Must-pass failures.
- Input tokens.
- Output tokens.
- Estimated cost.
- Latency.
- Risk.
- Verdict.

Required candidate strategies:

- Conservative: remove repetition and preserve structure.
- Balanced: compact sections while preserving constraints.
- Aggressive: compress heavily, expect failures, useful lower bound.
- Output-lite: reduce output length and unnecessary explanations.
- Model-specific: provider-tuned only when behavior differs and only trusted after eval.

## MVP Exclusions

- Fully autonomous eval generation as the only source of truth.
- Full human review platform.
- Production traffic monitoring.
- Dynamic runtime routing.
- Cross-provider comparison as default.
