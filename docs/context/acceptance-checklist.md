# Acceptance Checklist

## Purpose

Provide a measurable launch-readiness checklist for public product, admin CRM/ops, and engineering foundations.

## Source Summary

The wireframes and playbooks define readiness targets: under two minutes to public audit value, 95 percent or better eval pass target with zero must-pass failures, 95 percent or better free audit to CRM record capture, 100 percent failed-job visibility, and 100 percent admin audit coverage for mutations and sensitive reads.

## Decisions

- Public product readiness, admin ops readiness, and engineering readiness are all MVP criteria.
- The product is not ready if it can estimate savings but cannot prove quality.
- The admin layer is not ready if it relies on hidden routes instead of backend authorization and audit logs.

## Non-Negotiables

- Time to first public audit value target: under 2 minutes.
- Recommended setup eval pass target: 95 percent or better and zero must-pass failures.
- Valid free audit to CRM account/opportunity signal target: 95 percent or better.
- Failed jobs visible in admin queue target: 100 percent.
- Admin audit coverage for mutations and sensitive reads target: 100 percent.

## Implementation Notes

### Public Product

- [ ] User can select OpenAI, Anthropic, or Gemini.
- [ ] User can select or enter exact current model.
- [ ] User can enter task, priority, monthly volume, and advanced constraints.
- [ ] User can paste/import prompt.
- [ ] Parser detects variables, output requirements, repeated rules, examples, and constraints.
- [ ] App shows token count, output estimate, cost estimate, waste findings, and model-fit label.
- [ ] App identifies overpowered, appropriate, or underpowered fit.
- [ ] App shows risk before savings.
- [ ] App generates at least three prompt candidates.
- [ ] App includes conservative, balanced, aggressive, and output-lite candidates.
- [ ] App shortlists same-provider model candidates.
- [ ] User can add manual test cases.
- [ ] User can upload CSV test cases.
- [ ] User can define must-pass checks and pass threshold.
- [ ] Eval matrix compares original and optimized prompts across selected models.
- [ ] Failed combinations remain visible.
- [ ] Final report recommends one winner, one cheaper alternative, and one stronger fallback.
- [ ] User can export prompt, settings, report, savings, and implementation notes.

### Admin CRM / Ops

- [ ] Hidden admin UI exists under `/__admin/*`.
- [ ] Admin API lives under `/admin-api/*`.
- [ ] Admin route is not linked from public navigation.
- [ ] Admin UI requires session, admin role, and MFA.
- [ ] Admin API requires session, MFA, RBAC, action scope, and audit middleware.
- [ ] Overview shows conversion, jobs, health, registry risk, report failures, and revenue alerts.
- [ ] Free audits map to accounts, contacts, opportunities, notes, and tasks.
- [ ] Account 360 shows workspace health and project/report metadata with raw prompts redacted by default.
- [ ] User support actions require role checks and write admin audit logs.
- [ ] Eval job control supports inspect sanitized payload, retry, cancel, and regenerate report.
- [ ] Model registry admin supports source URL, `last_verified_at`, diff, approval, and stale warnings.
- [x] Reports privacy vault supports redacted/default views, raw locked state, failed export retry, and deletion workflow.
- [ ] Billing admin supports plans, entitlements, usage ledger, invoices, credits, and feature flags.
- [ ] `admin_audit_logs` are append-only and cover all mutations and sensitive reads.

### Engineering

- [ ] React TypeScript frontend has public route tree and admin route tree.
- [ ] Hono TypeScript API separates public and admin namespaces.
- [ ] Bun runs web, API, workers, tests, and scripts.
- [ ] Shared schemas reduce frontend/API drift.
- [ ] Provider adapters are isolated from UI logic.
- [ ] Model registry is isolated from recommendation logic.
- [ ] Eval runner and report generator run through worker boundaries.
- [ ] Middleware checks route and action scopes, not just session.
- [ ] Raw reveal, delete, credit, and impersonation actions require sudo.
- [x] Provider keys remain encrypted and non-viewable.
- [ ] Report and prompt deletion remove object storage artifacts and write audit events. Status: report artifact deletion is storage-backed, durable, and audited; public prompt deletion route remains future work.

## MVP Exclusions

- Public CRM workflows.
- Raw prompt browsing as normal support.
- Production model routing.
- Automatic deployment.
- Full observability platform.
- Enterprise compliance workflows.
