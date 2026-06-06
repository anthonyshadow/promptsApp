# Model Registry Policy

## Purpose

Prevent long-lived model assumptions from leaking into code, scoring, UX, or recommendations.

## Source Summary

The PDFs repeatedly require a model registry with official source URLs, `last_verified_at`, stability status, capabilities, context windows, and pricing. They explicitly say not to hard-code prices, context windows, features, or stability assumptions.

## Decisions

- Model metadata lives in a model registry.
- Never hard-code long-lived model prices, context windows, feature flags, or stability assumptions.
- Registry supports OpenAI, Anthropic, and Gemini for MVP.
- Every active model record has source URL, `last_verified_at`, `verified_by`, `approval_state`, `approved_by`, and `approved_at`.
- Prefer stable model IDs for production recommendations when providers distinguish stable, preview, latest, experimental, and deprecated aliases.
- Keep provider-specific capability flags separate from normalized recommender fields.
- Admin registry UI supports diff, verify, approve, stale warnings, and source policy.

## Non-Negotiables

- Stale pricing, context, capability, or stability metadata blocks exact savings claims or marks them unverified.
- Unsupported capabilities are rejected before cost estimates are trusted.
- Production recommendations prefer stable model records.
- Pricing or capability edits require official source URL, verifier identity, and audit event.
- Two-person review is required for pricing or capability edits once implemented in production operations.

## Implementation Notes

Registry filters needed by the public flow:

- Provider.
- Task type.
- Modality.
- Tool support.
- Structured output support.
- Context length.
- Stability status.
- Latency tier.
- Quality tier.
- Freshness status.

Freshness states:

- `fresh`: safe to calculate exact estimates.
- `stale`: do not trust exact savings claims.
- `unverified`: show estimates as unverified or block production recommendation.
- `deprecated`: do not select as winner; preserve only if it is the user's baseline.
- `preview`: keep visible for evaluation, but prefer stable rows for production recommendations.
- `experimental`: keep visible for experiments, but block exact savings claims.
- `demo_unverified`: local/demo placeholder metadata; never supports exact savings claims.

Freshness workflow:

- Active rows age into review after 30 days.
- Admin PATCH creates a pending `model_registry_versions` diff and requires official `source_url`.
- Approval publishes the active row with verifier and approver metadata.
- Rejection records the proposal outcome without changing active public metadata.
- Stale, demo, unapproved, or missing-source rows appear in the admin risk/review queue.

Official source categories:

- OpenAI model and pricing docs.
- Anthropic model and pricing docs.
- Gemini model and pricing docs.
- Framework docs for stack metadata only when implementation templates depend on them.

## MVP Exclusions

- Automated registry sync without human verification.
- Every provider at launch.
- Production model router.
- Provider-specific deep tuning beyond simple capability and fit filters.
