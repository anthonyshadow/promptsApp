# Build Sequence

## Purpose

Record the intended order of implementation so future tasks preserve the public value loop while adding only the internal controls needed to operate safely.

## Source Summary

The PDFs define a six-week roadmap. The updated wireframes add admin controls without letting admin CRM delay the first public value loop.

## Decisions

- Build the public optimizer and minimum internal admin CRM/ops together.
- Public value loop comes first.
- Admin controls are added only where needed for safe operation: auth gate, accounts, eval jobs, model registry, reports, billing/entitlements, and audit logs.
- React + Hono + Bun monorepo is the implementation base.

## Non-Negotiables

- Do not let admin CRM delay the first public value loop.
- Do not implement product code before the repo-native source of truth exists.
- Do not add dependencies until an implementation task explicitly starts the app.
- Do not build cross-provider comparison as the default MVP path.
- Do not build public CRM, sales automation, production deployment, or raw prompt browsing.

## Implementation Notes

### Six-Week Shape

Week 1:

- React + Hono + Bun monorepo.
- Provider/model selector.
- Prompt input.
- Admin auth foundations: admin users, roles, sessions, audit log table.
- Exit: prompt paste works; admin route blocked without role.

Week 2:

- Token/cost audit.
- Model-fit label.
- Prompt parser.
- Secret warning.
- Admin overview skeleton with free audit leads and health placeholders.
- Exit: free audit creates account signal; audit events work.

Week 3:

- Prompt candidates.
- Diff viewer.
- Quality contract.
- Manual test cases.
- CRM pipeline, notes, tasks, Account 360 redacted view.
- Exit: operator sees context without raw prompts.

Week 4:

- Model shortlist.
- Registry freshness warnings.
- Eval matrix runner.
- Eval job control center.
- Registry diff/verify flow.
- Exit: ops can retry jobs and mark metadata fresh/stale.

Week 5:

- Recommendation report.
- Markdown/JSON/PDF export.
- Report artifacts.
- Reports privacy vault.
- Deletion workflow.
- Failed export retry.
- Exit: reports have privacy states and deletion audit trail.

Week 6:

- Free audit growth loop.
- Onboarding.
- Launch polish.
- Billing/entitlements.
- Usage ledger.
- Feature flags.
- Audit-log search.
- Acceptance testing.
- Exit: team can operate trials, limits, support actions, and audit review.

## MVP Exclusions

- Enterprise approval workflows.
- SOC 2 workstream.
- Full observability platform.
- Production model router.
- Automatic deployment.
- Every provider integration.
