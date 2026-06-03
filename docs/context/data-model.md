# Data Model

## Purpose

Capture the durable entity model for public optimization, internal admin CRM/ops, billing, and security.

## Source Summary

The public playbook defines users, workspaces, projects, prompts, evals, candidates, model registry, usage estimates, and reports. The admin playbook and wireframes add accounts, contacts, opportunities, notes, tasks, support tickets, job events, provider incidents, report artifacts, billing entities, admin users/roles/sessions, sudo requests, and admin audit logs.

## Decisions

### Public Product Entities

- `users`
- `workspaces`
- `projects`
- `prompts`
- `prompt_versions`
- `test_cases`
- `optimization_candidates`
- `eval_runs`
- `eval_results`
- `usage_estimates`
- `recommendation_reports`
- `report_artifacts`
- `provider_keys`

### Model Registry Entities

- `models`
- `model_registry_versions`
- `model_registry_sources`
- `model_registry_approvals`

### Admin CRM Entities

- `accounts`
- `contacts`
- `opportunities`
- `crm_notes`
- `tasks`
- `support_tickets`

### Admin Ops Entities

- `job_events`
- `provider_incidents`
- `report_artifacts`
- `deletion_requests`

### Security Entities

- `admin_users`
- `admin_roles`
- `admin_sessions`
- `admin_audit_logs`
- `sudo_requests`

### Billing Entities

- `plans`
- `entitlements`
- `usage_ledger`
- `billing_events`
- `credits`

## Non-Negotiables

- `admin_audit_logs` are append-only.
- Admin Account 360 shows metadata and redacted previews by default.
- Raw prompts, provider keys, and raw reports require explicit reveal scopes and sudo where dangerous.
- Provider keys are encrypted and never viewable after storage.
- Report and prompt deletion must remove object storage artifacts and write audit events.
- Model registry data is versioned; pricing or capability edits require source URL and verification metadata.

## Implementation Notes

Minimum `admin_audit_logs` fields:

- `id`
- `admin_user_id`
- `workspace_id`
- `account_id`
- `target_type`
- `target_id`
- `action`
- `action_scope`
- `reason_code`
- `sudo_request_id`
- `ip_address`
- `user_agent`
- `redaction_state`
- `metadata`
- `created_at`

Minimum model registry fields:

- `id`
- `provider`
- `model_id`
- `display_name`
- `input_price_per_million_tokens`
- `output_price_per_million_tokens`
- `cached_input_price_per_million_tokens`
- `context_window`
- `max_output_tokens`
- `supports_text`
- `supports_image`
- `supports_audio`
- `supports_video`
- `supports_tools`
- `supports_structured_output`
- `latency_tier`
- `quality_tier`
- `recommended_task_types`
- `stability_status`
- `source_url`
- `last_verified_at`
- `verified_by`

Free audit to CRM mapping:

- Valid free audits create or update account/opportunity signals.
- Capture provider, current model, task type, volume, model fit, savings opportunity, eval readiness, and contact metadata.
- Do not store raw prompt in CRM notes. Link to project metadata with redacted preview.

## MVP Exclusions

- Enterprise approval workflow tables.
- Full sales automation schema.
- Campaigns, sequences, forecasting, or marketing automation.
- Full observability event schema beyond MVP job/provider/report states.
- Runtime traffic routing data model.
