# Mock Data Contract

## Purpose

Define safe synthetic data for future demos, tests, seeds, screenshots, and admin fixtures without using real customer prompts or hard-coded production model assumptions.

## Source Summary

The wireframes use synthetic accounts and task examples such as support classification, invoice extraction, RAG answerer, lead scoring, Acme AI, FlowPilot, VectorDesk, and Northstar Ops. The playbooks require redaction, secret warnings, and registry-driven model data.

## Decisions

- Mock data must be clearly synthetic and marked with `is_mock: true`.
- Mock prompts must never contain real customer text, secrets, credentials, or proprietary policy content.
- Mock admin views should default to redacted prompt/report previews.
- Mock model registry rows can exist for demos but must be labeled mock/unverified unless loaded from verified registry fixtures.
- Mock eval runs must include passing and failing combinations so risk-before-savings behavior is visible.

## Non-Negotiables

- Do not use real prompt text in fixtures.
- Do not seed actual provider API keys.
- Do not treat mock model pricing, context windows, or capabilities as production metadata.
- Do not drive production recommendations from mock registry rows.
- Do not create demo workflows where support can browse raw prompts without sudo.

## Implementation Notes

Suggested synthetic workspaces/accounts:

- `Acme AI`: support classifier, overpowered fit, eval-ready.
- `FlowPilot`: lead scoring, overpowered fit, trial.
- `VectorDesk`: extraction workflow, appropriate fit, qualified.
- `Northstar Ops`: RAG answerer, underpowered fit, needs review.
- `HelpMate`: support workflow, overpowered fit, new audit.

Suggested synthetic prompt tasks:

- Support classification returning JSON with category, urgency, summary, and suggested reply.
- Invoice extraction with schema checks.
- RAG answerer with citation risk.
- Lead scoring with exact labels.

Suggested eval fixture requirements:

- 5 to 50 test cases per CSV-style eval set.
- At least one JSON/schema check.
- At least one exact label or required phrase check.
- At least one LLM-judge-labeled check.
- At least one must-pass failure in a failing candidate.
- At least one passing balanced candidate.
- Baseline original + current model row.
- Winner, cheaper alternative, and stronger fallback rows.

Suggested admin audit fixtures:

- Registry price marked stale.
- Failed report export retry queued.
- Eval matrix passed at 98 percent.
- Free audit lead created from a high-volume support classifier.
- Report deletion request pending.

## MVP Exclusions

- Realistic customer names from actual accounts.
- Real provider pricing in mock fixtures unless pulled from verified registry data.
- Seeded production credentials.
- Raw prompt browsing fixtures as a normal support state.
