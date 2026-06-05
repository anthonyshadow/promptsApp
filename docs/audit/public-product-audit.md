# Public Product Audit

## Purpose

Audit the public optimizer against the PromptOpts MVP loop and identify launch-relevant UX/product gaps.

## Screen Status

| Route | Status | UX clarity | Notes | Fixes in this pass |
| --- | --- | ---: | --- | --- |
| `/audit`, `/free-audit` | Green | 5 | Fast model-fit preview, optional lead capture, risk before savings, eval reminder. | Responsive table/layout audit documented. |
| `/app/setup` | Green | 5 | Provider/model leads the flow; exact model comes from registry data; advanced controls are collapsed. | Shared mobile field sizing improved. |
| `/app/prompts/:id` | Green | 4 | Prompt editor, variable detection, token preview, warnings, save through API. | Shared textarea mobile sizing improved. |
| `/app/projects/:id/audit` | Green | 5 | Risk, model fit, sensitive warnings, cost estimate, guardrails, and next action are visible. | No product change needed. |
| `/app/projects/:id/success` | Green | 4 | Auto-drafted contract, manual test cases, CSV parser path, must-pass checks. | No product change needed. |
| `/app/projects/:id/candidates` | Green | 4 | Multiple risk profiles, provisional selection, visual diff, preserved constraints. | Diff layout already stacks through shared split grid. |
| `/app/projects/:id/models` | Green | 4 | Same-provider shortlist, roles, registry health, stale/demo warnings. | Table wrappers inherited improved overflow behavior. |
| `/app/eval-runs/:id` | Green | 4 | Eval setup, polling states, failed combos, matrix, cost-quality frontier. | Table wrappers inherited improved overflow behavior. |
| `/app/reports/:id` | Green | 5 | Winner, cheaper alternative, stronger fallback, blockers, risk notes, savings caveat. | No product change needed. |
| `/app/reports/:id/export` | Green | 4 | Markdown/JSON/PDF-stub exports, redacted package, eval snapshot preservation. | No product change needed. |
| `/app/workspace/:slug` | Green | 4 | Post-value dashboard with savings, prompts, eval pass, flagged models, recent projects. | Table wrappers inherited improved overflow behavior. |

## Product-Risk Notes

- Savings language is appropriately gated when registry metadata is stale/demo.
- No screen presents an audit-only result as a production switch recommendation.
- Failed eval combinations remain visible.
- The free audit uses the same interaction model as the app and does not expose admin concepts.
- The workspace dashboard is intentionally narrow; it is not a full observability platform.

## Missing Or Partial States

- Live provider failures are represented through mock/provider placeholder states, not real provider errors.
- Empty states exist in the main route tests but are not browser-verified at every breakpoint.
- Real user onboarding and auth states are outside this MVP pass.
- CSV upload is represented through parser-backed UI paths, not a polished drag/drop importer.

## Recommended Fixes

- Add browser-level route smoke tests after adding a test renderer or Playwright setup.
- Add guided example prompts and clearer first-run empty state copy before founder demos.
- Add better visual affordances for registry freshness once real verified metadata exists.

## Deferred Items

- Cross-provider recommendation flow.
- Full mobile editing experience.
- Automatic production deployment.
- Public report sharing infrastructure.
