# Launch Blockers

## Purpose

Track the blockers that prevent PromptOpts from moving from founder-demoable local MVP to private beta with real customer prompts.

## Current Verdict

PromptOpts is demo-ready with mocked infrastructure. It is not private-beta ready until the remaining P0 trust, key, storage, and registry blockers below are closed.

## Blockers

| Blocker | Source | Current status | Evidence | Required next action | Exit criteria |
| --- | --- | --- | --- | --- | --- |
| Durable Postgres repository | Launch Blockers A | complete | Schema/migration metadata, local infra docs, migration runner, seed/reset commands, Postgres adapter, and live local Postgres contract tests pass. Runtime uses Postgres when `DATABASE_URL` is configured and memory when forced for demo mode. | Enforce `DATABASE_URL` in deployed environments during deployment work. | Repository contract tests pass against local Postgres; admin audit logs persist across restarts. |
| Real admin auth/session/MFA | Launch Blockers A; Security And Trust | complete | Admin login/MFA/logout routes persist sessions, rotate after MFA, derive RBAC/action scopes from stored roles, reject mock headers, and tests cover unauthenticated/non-MFA/missing-scope paths. | Provision production admins and secrets deliberately during deployment. | `/admin-api/*` rejects invalid session, missing MFA, missing role, and missing action scope. |
| Real sudo lifecycle | Trust And Security E | complete | Sudo start/status/end routes persist action-scoped, reason-coded, time-boxed grants; start requires MFA recheck, expired/wrong-action grants reject dangerous actions, UI shows sudo modal/banner state, and lifecycle events are audited. | Keep break-glass and raw reveal payload flows placeholder-only until encrypted payload access lands. | Dangerous actions only pass with valid unexpired sudo and reason code. |
| Provider-key encryption and non-viewability | Launch Blockers A; Data Model | complete | Provider connections store encrypted blobs plus fingerprints only, lifecycle routes return metadata only, no reveal route exists, admin metadata reads are audited, and adapters can use controlled decrypt-for-use. | Replace local encryption key material with production KMS before external customer data. | Keys are opaque after storage; all key actions are audited; adapters can use scoped keys safely. |
| Object storage artifact lifecycle and deletion jobs | Launch Blockers A | in_progress | Storage abstraction and MinIO local service exist; report deletion is memory-only. | Wire object storage adapter and deletion/retention jobs. | Report deletion removes artifacts or records failure/retry evidence and writes audit events. |
| Verified model registry rows | Launch Blockers A | in_progress | Registry admin/version flow and stale warnings exist; seed rows are demo/unverified. | Verify OpenAI, Anthropic, and Gemini MVP rows from official source URLs. | Active rows include source URL, verification date, verifier, approval state, and freshness status. |

## Beta-Blocking Dependencies

These are not all P0 checklist items, but they block safe private-beta evals:

| Dependency | Status | Why it blocks beta |
| --- | --- | --- |
| Rate limits, request logging, and data-use controls | not_started | Live provider calls and prompt ingestion need abuse control and redacted logs. |
| Durable eval queue | not_started | Eval jobs must survive restarts and expose product-visible queue states. |
| Live provider adapters | in_progress | Provider adapter boundaries exist, but live OpenAI/Anthropic/Gemini calls are intentionally inert. |
| Browser smoke tests | not_started | Static responsive audit exists, but beta needs route-level browser confidence. |

## Not Blockers For MVP Scope

- Enterprise SSO.
- SOC 2 workstreams.
- Production routing.
- Full CRM automation.
- Public CRM surfaces.
- Full observability platform.
