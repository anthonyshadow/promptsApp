# Admin Security Audit

## Purpose

Audit `/__admin/*` and `/admin-api/*` against the internal-only trust model.

## Admin Route Coverage

- `/__admin/overview`: redacted KPIs, health, risk queue, activity feed.
- `/__admin/accounts`: internal CRM pipeline only, no sales automation.
- `/__admin/accounts/:id`: Account 360 with redacted workspace/project/report previews.
- `/__admin/eval-jobs`: queue summary, worker health, sanitized detail, retry/cancel/regenerate actions.
- `/__admin/model-registry`: metadata table, freshness summary, diff approval.
- `/__admin/reports`: privacy vault with redacted/default views, raw locked state, failed export retry, deletion workflow.
- `/__admin/billing`: plans, entitlements, usage, invoices, credits, feature flags.
- `/__admin/audit-logs`: append-only redacted metadata review.

## Middleware Coverage

- Admin API is mounted only under `/admin-api`.
- Admin middleware order is implemented as session -> MFA -> role -> action scope -> sudo -> audit.
- Route policies in `admin-core` are the server-side source of truth for sensitive reads and dangerous actions.
- Public navigation does not link to `/__admin/*`.

## Audit-Log Coverage

- Admin mutations and sensitive reads write append-only `admin_audit_logs`.
- Tests cover overview reads, Account 360 reads, CRM mutations, eval retry/cancel, report vault actions, billing credit, raw report reveal, and append-only behavior.

## Redaction Coverage

- Account and Account 360 responses return redacted prompt/report previews by default.
- Eval job detail returns sanitized payload and provider error data.
- Reports vault returns redacted metadata by default.
- Provider keys are modeled as opaque/encrypted records in durable schema metadata and are not viewable in UI.

## Sudo Coverage

- Raw prompt reveal, raw report reveal, report deletion, billing credit, impersonation placeholder, and break-glass placeholder require elevated controls.
- Dangerous actions require reason codes in request schemas.

## Known Gaps

- Auth, MFA, sudo, and action scopes are mock-header based.
- No real admin user/session persistence is wired to the API runtime.
- Report deletion marks memory-backed records and artifacts; object storage cleanup is mocked.
- Billing and provider-key workflows do not yet use production services.
- Audit-log search UI is not a rich operator surface yet.

## Critical Launch Blockers

- Replace mock admin headers with real session/MFA/sudo storage before private beta.
- Add durable Postgres repository implementation for admin audit logs before handling real customer data.
- Add object storage deletion jobs before claiming deletion is complete.

## Fixes Completed In This Pass

- Hardened admin navigation and data table overflow on small screens.
- Added the dedicated `/__admin/audit-logs` React surface.
- Added comments documenting security-critical route and decision boundaries in core packages.
- Documented the mock/production boundary explicitly.
