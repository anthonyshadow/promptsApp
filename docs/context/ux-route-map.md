# UX Route Map

## Purpose

Preserve the intended public, admin, and route-level information architecture for future React implementation.

## Source Summary

The wireframes define a desktop-first diagnostic SaaS flow, plus a hidden internal admin CRM/ops portal. The playbooks specify React + TypeScript frontend routes, public API routes, and guarded admin namespaces.

## Decisions

### Public Surfaces

- `/audit`: free LLM Model Fit Audit acquisition tool.
- `/app/setup`: provider, model, task, priority, volume, constraints.
- `/app/projects/:projectId/prompt`: prompt editor, variables, token preview, secret warning.
- `/app/projects/:projectId/audit`: prompt + model audit with risk before savings.
- `/app/projects/:projectId/success`: quality contract, test cases, must-pass checks.
- `/app/projects/:projectId/candidates`: prompt candidates and visual diff.
- `/app/projects/:projectId/models`: same-provider model shortlist and registry freshness state.
- `/app/eval-runs/:evalRunId`: eval setup, job status, matrix results.
- `/app/reports/:reportId`: recommendation report.
- `/app/reports/:reportId/export`: deploy package export.
- `/app/workspace/:workspaceSlug`: post-value dashboard for projects, prompts, evals, reports, and verified savings.

### Admin Surfaces

- Admin UI lives under `/__admin/*`.
- Admin API lives under `/admin-api/*`.
- Admin route secrecy is convenience only, not security.
- Do not link `/__admin/*` from public navigation or public docs.

Canonical admin routes:

- `/__admin/overview`: conversion, jobs, health, registry risk, revenue alerts.
- `/__admin/accounts`: account pipeline from free audits.
- `/__admin/accounts/:id`: Account 360 with redacted workspace context.
- `/__admin/users`: support actions, access status, session controls.
- `/__admin/eval-jobs`: queue, retries, cancellations, worker health.
- `/__admin/model-registry`: diff, verify, approve model metadata.
- `/__admin/reports`: privacy vault and report lifecycle.
- `/__admin/billing`: plans, usage, entitlements, credits.
- `/__admin/audit-logs`: append-only action trail.
- `/__admin/settings`: admin settings only.

## Non-Negotiables

- Public route flow must preserve the core loop: provider/model setup -> prompt paste -> audit -> success contract -> candidates -> model shortlist -> eval matrix -> recommendation report -> export.
- Public screens cannot show admin navigation, hidden admin docs, or raw provider details.
- Desktop is primary for editing, diffing, tables, and eval matrices.
- Mobile should support audit review, report sharing, and lightweight status checks only.
- Every risk label maps to a concrete user action.

## Implementation Notes

- The free audit and authenticated app should use the same interaction model to avoid relearning.
- The audit screen is a decision preflight, not a rewrite score.
- The success contract prevents the optimizer from removing critical intent.
- The eval matrix must show failed combinations to prove quality regressions were not hidden.
- The report screen must choose a winner, not leave users to interpret the matrix alone.
- Shareable reports default to redacted links.
- Admin views read the same product objects with stricter scopes and redaction.

## MVP Exclusions

- Full mobile editing workflow.
- Public admin documentation.
- Visible `/__admin` navigation in customer screens.
- Normal support workflow for browsing raw prompts.
- Full observability dashboard beyond projects, versions, evals, reports, and savings.
