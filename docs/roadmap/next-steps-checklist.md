# Next Steps Checklist

## A. Launch Blockers

- [x] P0 security M: Replace mock auth/MFA/sudo headers with real session storage. Status: complete - `/admin-api/*` now resolves persisted admin sessions from bearer/cookie tokens, rotates sessions after MFA, derives RBAC/action scopes from stored roles, and rejects mock `x-admin-*` headers. Why it matters: hidden routes are not security. Acceptance: `/admin-api/*` rejects unauthenticated, non-MFA, missing-scope, and missing-sudo requests without mock headers.
- [x] P0 backend L: Implement Postgres repository adapter and migration runner. Status: complete - adapter, migration runner, seed/reset commands, durable schema coverage, and repository contract tests now pass against local Postgres. Why it matters: audit logs and customer prompts must be durable. Acceptance: repository contract tests pass against local Postgres.
- [x] P0 security M: Encrypt provider keys and keep them non-viewable. Status: complete - provider connections persist encrypted blobs plus fingerprints only, lifecycle routes return metadata only, no reveal route exists, adapter decrypt-for-use is controlled, and provider-key actions are audited. Why it matters: BYOK requires trust. Acceptance: stored keys are opaque, reveal routes do not exist, audit events cover key actions.
- [x] P0 infra M: Wire object storage artifact lifecycle and deletion jobs. Status: complete - report generation writes artifacts through storage, local filesystem storage records checksum/size metadata, admin deletion creates deletion requests, removes object content, marks DB records, keeps retryable failure state, and audits lifecycle steps. Why it matters: report deletion cannot be memory-only. Acceptance: deletion marks DB records, removes object artifacts, and audits every step.
- [ ] P0 backend M: Verify initial model registry rows from official source URLs. Why it matters: exact savings claims require fresh metadata. Acceptance: active rows include source URL, last verified date, verifier, approval state, and stale warnings.

## B. Private Beta Readiness

- [ ] P1 backend L: Implement live OpenAI, Anthropic, and Gemini adapters. Why it matters: eval proof must run against real provider outputs. Acceptance: adapters use configured keys, sanitize errors, and record normalized usage/latency.
- [ ] P1 infra L: Add durable eval queue with retry/rate-limit state. Why it matters: queue/cache state is a product surface. Acceptance: eval jobs survive API restarts and expose partial rows.
- [ ] P1 frontend M: Add browser smoke tests for all public/admin routes. Why it matters: current UI tests are render-level. Acceptance: breakpoints 320, 375, 430, 768, 1024, 1280, 1440 are covered for key routes.
- [ ] P1 product M: Polish first-run examples and empty states. Why it matters: demos need understandable value in under two minutes. Acceptance: a new user can run a free audit and project audit without tribal knowledge.

## C. Production Readiness

- [ ] P1 infra L: Add billing provider integration and webhook handling. Why it matters: credits, invoices, plans, and entitlements must reflect real events. Acceptance: plan changes and credits reconcile with external billing state.
- [x] P1 backend M: Add retention/deletion policy implementation. Status: complete for MVP - default retention rules are repo-native, report deletion tombstones scoped metadata while deleting object content, admin audit logs remain append-only, and partial failures are observable/retryable. Why it matters: prompt/report deletion is a trust promise. Acceptance: scoped data deletion is durable, audited, and observable.
- [ ] P1 security L: Add rate limits, request logging policy, and data-use controls. Why it matters: provider calls and prompt ingestion need abuse and privacy controls. Acceptance: limits and logs redact sensitive payloads.

## D. Product Polish

- [ ] P1 design M: Improve eval matrix readability with sticky identifiers. Why it matters: engineers need to understand failures quickly. Acceptance: failed checks and baseline rows remain readable on laptop/tablet widths.
- [ ] P2 frontend S: Improve CSV upload affordance. Why it matters: test-case setup is a key quality gate. Acceptance: visible file picker, validation errors, and parser preview.
- [ ] P2 product S: Add report copy review. Why it matters: savings language must stay precise. Acceptance: no exact savings claim appears with stale/demo registry metadata.

## E. Trust And Security

- [x] P0 security M: Add real sudo request lifecycle. Status: complete - sudo start/status/end routes persist action-scoped, reason-coded, time-boxed grants; start requires MFA recheck, expired/wrong-action grants reject dangerous actions, the admin UI shows sudo modal/banner states, and lifecycle events are audited. Why it matters: dangerous actions require time-boxed elevation. Acceptance: sudo requests expire, require reason, and are audited.
- [ ] P1 security M: Add audit-log review/search UI. Why it matters: operators need fast trust review. Acceptance: filters by actor, action scope, target, reason, and time.
- [ ] P1 backend M: Implement raw reveal encrypted payload access only where policy allows. Why it matters: support cannot casually browse raw prompts. Acceptance: raw reveal requires sudo and reason; support role remains redacted by default.

## F. Eval And Model Quality

- [ ] P1 backend L: Calibrate token estimates with provider usage. Why it matters: audit estimates should converge on real eval data. Acceptance: eval rows store provider-reported usage when available.
- [ ] P1 product M: Add optional LLM judge adapter with labels. Why it matters: nuanced quality needs review beyond deterministic checks. Acceptance: LLM judge results are distinct from deterministic must-pass checks.
- [ ] P1 backend M: Add registry freshness review workflow. Why it matters: metadata ages quickly. Acceptance: stale rows appear in admin risk queue and block exact savings.

## G. Admin Operations

- [ ] P1 ops M: Expand job retry diagnostics. Why it matters: failed jobs should be actionable without logs. Acceptance: detail page explains provider error class, retry hints, and affected combinations.
- [x] P1 ops M: Wire report vault to object storage status. Status: complete - `/__admin/reports` and `/admin-api/reports` show artifact existence, shortened storage key, checksum, size, deletion state, attempts, last error, and retry status without raw report content. Why it matters: export/deletion lifecycle needs evidence. Acceptance: vault shows artifact existence, deletion state, checksum, and retry status.
- [ ] P2 ops S: Add Account 360 filtering. Why it matters: operators need focused metadata without CRM bloat. Acceptance: filter projects/reports by status and risk.

## H. Growth And Monetization

- [ ] P1 growth M: Instrument free audit conversion. Why it matters: free audit is the acquisition loop. Acceptance: valid free audits map to account/contact/opportunity with stage and CTA signal.
- [ ] P2 growth M: Add shareable redacted report links. Why it matters: reports can drive internal sharing. Acceptance: share package never exposes raw prompt/report content by default.
- [ ] P2 product M: Test pricing/packaging assumptions. Why it matters: billing controls should match real plan value. Acceptance: plan limits match trial/private beta terms.
