# Security And Trust

## Purpose

Define the trust requirements for user prompts, provider keys, reports, and internal admin operations.

## Source Summary

All three PDFs state that users will paste production prompts, customer examples, policies, and sometimes secrets. The admin playbook is explicit that hidden routes are not security and that admin access needs MFA, RBAC, action scopes, sudo, redaction, and append-only audit logs.

## Decisions

- Prompts are private by default.
- Users can bring their own provider keys.
- Provider keys and sensitive workspace data are encrypted at rest.
- Data-use policy is explicit: do not train on customer prompts unless the customer opts in.
- Secret, PII, credential, and proprietary policy warnings appear before provider calls.
- Prompt deletion and report deletion are available from day one.
- Admin CRM is internal only and redacted by default.
- Admin roles include owner, ops, support, finance, and read-only.
- Admin API authorization uses persisted admin users, roles, sessions, and MFA state. Mock admin headers are not accepted as authorization.
- Dangerous admin actions require time-boxed sudo with MFA recheck, action scope binding, and reason code.
- Provider keys are stored through provider-connection lifecycle routes as encrypted blobs plus fingerprints only; plaintext is not returned after save.
- Report artifacts are written through a storage abstraction. Deletion removes object content, retains checksum/size/status tombstones, records a durable deletion request, and audits each lifecycle step.
- API requests have request IDs, structured body-free logs, and abuse limits before prompt ingestion, eval/provider calls, report export, admin login/MFA, provider-key lifecycle, and dangerous admin actions.
- Workspace data-use defaults are private prompts, no training, and confirmation before provider calls when PII/proprietary policy warnings are detected.

## Non-Negotiables

- Hidden route is not security.
- `/__admin/*` requires valid session, admin role, and MFA in the UI.
- `/admin-api/*` requires session, MFA, admin role, action scope, and audit middleware.
- Raw prompt reveal, raw report reveal, report deletion, billing credit, impersonation, provider-key action, and registry publish require elevated authorization.
- Support cannot browse raw prompts as a normal workflow.
- Provider keys are never displayed after storage.
- Every admin mutation and sensitive read writes an append-only audit event.
- Break-glass access is owner-only, reason-coded, time-boxed, and audited.
- Request logs never store raw prompts, provider keys, raw reports, raw eval test-case inputs, or raw provider payloads.
- Live provider calls must be blocked or explicitly acknowledged when secret/PII scanning finds sensitive content.

## Implementation Notes

Admin middleware stack:

1. `requireSession`
2. `requireMfa`
3. `requireAdminRole`
4. `requireActionScope`
5. `requireSudo` for dangerous actions
6. `writeAdminAuditEvent`

Admin session implementation:

- `/admin-api/auth/login` creates a short pre-MFA persisted session from admin credentials.
- `/admin-api/auth/mfa/verify` verifies TOTP and rotates the session token into an MFA-verified session.
- Admin requests use a bearer session token or the admin session cookie; `x-admin-*` mock headers do not bypass middleware.
- `/admin-api/auth/logout` revokes the current stored admin session.
- Local development seeds one owner admin only; production must provision admins deliberately.

Sudo lifecycle implementation:

- `/admin-api/sudo/start` requires an existing MFA-verified admin session, a second valid MFA code, an allowed action scope, and a non-empty reason code.
- `/admin-api/sudo/status` returns active grants and marks expired grants as expired.
- `/admin-api/sudo/end` revokes active grants and writes a reason-coded audit event.
- `requireSudo(action)` rejects missing, expired, or wrong-action grants; allowed and denied dangerous actions are audited.
- Sudo is extra authorization only. It does not bypass RBAC, action scopes, or redacted-by-default admin views.

Provider-key implementation:

- `/provider-connections` accepts BYOK submissions for OpenAI, Anthropic, and Gemini and persists only ciphertext, key fingerprint, provider, workspace, status, and timestamps.
- `/provider-connections/:id/rotate` replaces ciphertext and fingerprint without returning plaintext.
- `/provider-connections/:id/revoke` marks the connection revoked.
- `/admin-api/provider-connections` is metadata-only and audited as a sensitive read.
- No reveal route exists for provider keys.
- Local development uses `PROMPTOPTS_SECRET_ENCRYPTION_KEY`; production should replace local key material with KMS-backed encryption without changing repository callers.
- Provider adapters request decrypted keys only through the controlled decrypt-for-use helper inside provider execution paths; decrypted keys are not persisted or returned.

Report artifact and retention implementation:

- Report generation persists Markdown, JSON, PDF-stub, and redacted share-package artifacts through `ReportArtifactStorage`.
- Local development uses a filesystem storage adapter rooted at `PROMPTOPTS_REPORT_STORAGE_DIR`; memory storage remains available for tests/demo mode.
- `/admin-api/reports/:id/delete` requires sudo, creates a deletion request, marks report/artifact records, deletes object content, records retryable failures, and writes explicit audit events for request/start/deleted/failed/completed.
- Report artifact metadata retains checksum, size, format, redaction state, deletion state, attempts, and last error. Raw artifact content is not returned from admin metadata views.
- Default retention rules live in `packages/shared/src/retention/policy.ts`: admin audit logs and billing metadata are retained, while raw prompt/report artifact content can be tombstoned/deleted with reason-coded audit evidence.

Rate-limit, logging, and data-use implementation:

- The API assigns `x-request-id` and writes structured request logs with method, route, status, duration, IP, user agent, workspace/account/admin IDs when available, and rate-limit policy.
- Request logs are body-free by default and pass through a sensitive-field redactor for any metadata snippets.
- Rate limits cover `/audits`, `/prompts`, `/eval-runs`, `/reports`, `/reports/:id/export`, `/admin-api/auth/login`, `/admin-api/auth/mfa/verify`, `/provider-connections`, provider-key rotate/revoke, sudo start, report delete/reveal, billing credit, impersonation, and break-glass.
- `REDIS_URL` enables the Redis-backed limiter. Non-production local development and tests use the explicit in-memory fallback; production without Redis fails closed.
- Workspace rows store `prompts_private_by_default`, `data_use_policy`, and `provider_call_sensitive_data_policy`.
- `POST /eval-runs` scans baseline prompts, selected candidates, and selected test-case inputs/expected outputs before provider execution. Hard secrets are blocked; PII/proprietary findings require `provider_call_acknowledged`.

Trust UX states to build:

- Secret detected: block or redact before provider call.
- PII detected: warn before eval/provider call.
- No tests added: allow audit, disable production recommendation.
- Stale registry: verify docs before exact savings claim.
- Eval failure: show failed checks and preserve baseline.
- Provider rate limit: show queued/retrying state and partial rows.
- Underpowered model: recommend stronger candidates before cost compression.
- Overpowered model: benchmark cheaper candidates.

## MVP Exclusions

- SOC 2 workstream.
- Enterprise SSO and custom retention controls.
- Production KMS/key hierarchy.
- Production S3/KMS lifecycle policies and customer-specific retention controls.
- Public prompt sharing by default.
- Public admin docs.
- Raw prompt support browsing.
