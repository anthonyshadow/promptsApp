# Refactor Log

## Purpose

Record cleanup performed during the final review pass.

## Changes

| Area | What changed | Why | Risk | Validation |
| --- | --- | --- | --- | --- |
| Shared public styles | Added overflow clipping, `minWidth: 0`, mobile field/textarea sizing, table scroll/touch behavior, wrapped table cells. | Prevent narrow-screen breakage without changing screen logic. | Low | Final typecheck/test/build. |
| Admin route shell | Added contained horizontal nav scroll, nowrap nav links, smaller mobile padding, root overflow clipping. | Keep hidden admin route usable on smaller screens. | Low | Final web tests/build. |
| Admin reports vault | Added single-column mobile summary, wrapped cells, touch table scroll, button height. | Reports IDs/summaries are long and privacy states must stay readable. | Low | Final web tests/build. |
| Admin billing | Added single-column mobile summary, wrapped cells, touch table scroll, button height. | Entitlement/usage/flag metadata can overflow on small screens. | Low | Final web tests/build. |
| Admin eval jobs | Added single-column mobile summary, wrapped cells, touch table and payload scroll, button height. | Job IDs and sanitized JSON payloads are common overflow sources. | Low | Final web tests/build. |
| Admin audit logs | Added `/__admin/audit-logs` redacted metadata viewer and smoke test. | Close canonical admin route gap without creating a raw prompt browsing tool. | Low | Final web tests/build. |
| Prompt-core | Added guardrail comments for deterministic parsing, secret scanning, registry-only cost estimation, model fit, audit scope, and candidate preservation. | Protect product semantics during future optimization work. | Low | Final typecheck/test/build. |
| Eval-core | Added comments for contract drafts, deterministic checks, must-pass verdicts, aggregate blockers, decision rules, and frontier roles. | Make eval proof gates explicit. | Low | Final typecheck/test/build. |
| Model-registry | Added comments for same-provider shortlist, freshness gating, and role explanations. | Prevent hard-coded or overclaimed registry behavior. | Low | Final typecheck/test/build. |
| Provider-adapters | Added comments for normalization and inert live adapters. | Preserve provider boundary and trust posture. | Low | Final typecheck/test/build. |
| Shared repository | Added memory repository boundary comment. | Keep memory local/test adapter from becoming a production assumption. | Low | Final typecheck/test/build. |
| Report generator | Added eval snapshot/export mutation boundary comment. | Ensure export regeneration does not mutate eval proof. | Low | Final typecheck/test/build. |
| Prompt-core module split | Split parser, sensitive scanner, cost estimator, model-fit classifier, audit composer, candidate generator, and shared types behind the stable package barrel. | Make deterministic prompt value logic easier to review without changing the public API. | Medium | `bun test packages/prompt-core/src/index.test.ts`, final typecheck/test/build. |
| Eval-core module split | Split quality-contract drafting, deterministic checks, scoring, recommendation, frontier, CSV parsing, and shared types behind the stable package barrel. | Keep eval proof gates and report decision rules inspectable by responsibility. | Medium | `bun test packages/eval-core/src/index.test.ts`, final typecheck/test/build. |
| API contract split | Split route contracts by public/admin/auth/billing/report/model/account route family behind the existing `contracts.ts` export path. | Reduce the single broad contract file while preserving Hono/client type exports. | Medium | API route tests, final typecheck/test/build. |
| Shared schema split | Split domain schemas into common, identity, model registry, audit, prompt, eval/report, admin/CRM, billing, and free-audit modules behind the existing `schemas.ts` export path. | Make the data model easier to navigate while preserving all schema/type names. | Medium | Shared schema tests, final typecheck/test/build. |
| Admin auth route split | Moved admin login, MFA, logout, sudo status/start/end route registration into `apps/api/src/admin/authRoutes.ts`. | Keep the security entry routes separate while leaving protected admin middleware order visible in `adminRoutes.ts`. | Medium | Admin API tests, final typecheck/test/build. |
| Public model route split | Moved public model registry filtering into `apps/api/src/public/modelRoutes.ts`. | Isolate same-provider registry filtering and freshness-sensitive route behavior. | Low | Public API tests, final typecheck/test/build. |
| Admin web session helpers | Moved admin session and sudo status refresh helpers into `apps/web/src/admin/adminSessionView.ts`. | Keep `AdminRouteTree` focused on rendering and event orchestration. | Low | Web admin/public smoke tests, final typecheck/test/build. |

## Intentionally Left Alone

- API route modules still contain broad handler bodies; only the clearest route families were extracted in this pass to avoid security or behavior drift.
- Screen-specific Emotion styles still mostly live in the shared style bucket; deeper style colocation should wait for browser screenshot coverage.
- Mock provider, auth, queue, billing, and storage boundaries remain mocked and documented.
- No new dependencies were added.
