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
- Dangerous admin actions require time-boxed sudo with reason code.

## Non-Negotiables

- Hidden route is not security.
- `/__admin/*` requires valid session, admin role, and MFA in the UI.
- `/admin-api/*` requires session, MFA, admin role, action scope, and audit middleware.
- Raw prompt reveal, raw report reveal, report deletion, billing credit, impersonation, provider-key action, and registry publish require elevated authorization.
- Support cannot browse raw prompts as a normal workflow.
- Provider keys are never displayed after storage.
- Every admin mutation and sensitive read writes an append-only audit event.
- Break-glass access is owner-only, reason-coded, time-boxed, and audited.

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
- Public prompt sharing by default.
- Public admin docs.
- Raw prompt support browsing.
