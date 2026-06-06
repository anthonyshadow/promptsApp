import { describe, expect, test } from "bun:test";
import { DEMO_IDS, healthResponseSchema } from "@promptopts/shared";
import { createTotpCode } from "@promptopts/admin-core";
import { createApp } from "./app";
import {
  adminEvalRunDetailResponseSchema,
  adminEvalRunsResponseSchema,
  adminModelRegistryResponseSchema,
  adminOverviewResponseSchema,
  adminProviderConnectionsResponseSchema,
  adminReportsResponseSchema,
  billingCreditResponseSchema,
  billingResponseSchema,
  modelApproveResponseSchema,
  modelPatchResponseSchema,
  reportDeleteResponseSchema,
  reportExportActionResponseSchema
} from "./contracts";
import {
  adminGetRequest,
  adminJsonRequest,
  adminPatchJsonRequest,
  createAdminTestRepository,
  createDeleteFailingStorage,
  createTestApp,
  expectOkJson,
  jsonRequest,
  patchJsonRequest
} from "./appTestHelpers";

describe("admin API routes", () => {
  test("issues stored admin sessions and rotates them after MFA", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });

    const login = await expectOkJson(
      await app.request(
        "/admin-api/auth/login",
        jsonRequest({
          email: "ops@acme-ai.example",
          password: "promptopts-admin-dev"
        })
      )
    );
    expect(login.session.mfa_required).toBe(true);
    expect(login.session.mfa_verified).toBe(false);
    expect(login.token).toMatch(/^pa_/);

    const preMfaOverview = await app.request("/admin-api/overview", {
      headers: {
        authorization: `Bearer ${login.token}`
      }
    });
    expect(preMfaOverview.status).toBe(403);

    const mfa = await expectOkJson(
      await app.request("/admin-api/auth/mfa/verify", {
        method: "POST",
        headers: {
          authorization: `Bearer ${login.token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          code: createTotpCode("JBSWY3DPEHPK3PXP")
        })
      })
    );
    expect(mfa.session.mfa_required).toBe(false);
    expect(mfa.session.mfa_verified).toBe(true);
    expect(mfa.token).not.toBe(login.token);

    const overview = await app.request("/admin-api/overview", {
      headers: {
        authorization: `Bearer ${mfa.token}`
      }
    });
    expect(overview.status).toBe(200);

    const revokedOldSession = await app.request("/admin-api/auth/me", {
      headers: {
        authorization: `Bearer ${login.token}`
      }
    });
    expect(revokedOldSession.status).toBe(401);
  });

  test("mock admin headers do not bypass stored session auth", async () => {
    const app = createTestApp();
    const response = await app.request("/admin-api/overview", {
      headers: {
        "x-admin-session-id": "admin_session_mock",
        "x-admin-user-id": "admin_user_mock",
        "x-admin-role": "owner",
        "x-admin-mfa": "true",
        "x-admin-action-scopes": "read_metadata,manage_workspace"
      }
    });

    expect(response.status).toBe(401);
  });

  test("starts, reports, and ends sudo with MFA recheck and audit events", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const before = await repository.admin_audit_logs.list();

    const missingReason = await app.request(
      "/admin-api/sudo/start",
      adminJsonRequest({
        action_scope: "issue_billing_credit",
        reason_code: "",
        mfa_code: createTotpCode("JBSWY3DPEHPK3PXP")
      })
    );
    expect(missingReason.status).toBe(400);

    const started = await expectOkJson(
      await app.request(
        "/admin-api/sudo/start",
        adminJsonRequest({
          action_scope: "issue_billing_credit",
          reason_code: "billing_credit_test",
          mfa_code: createTotpCode("JBSWY3DPEHPK3PXP"),
          target_type: "billing",
          target_id: DEMO_IDS.workspace
        })
      )
    );
    expect(started.sudo_request.status).toBe("active");
    expect(started.sudo_request.reason_code).toBe("billing_credit_test");
    expect(started.status.active).toHaveLength(1);

    const credit = await expectOkJson(
      await app.request(
        `/admin-api/billing/${DEMO_IDS.workspace}/credit`,
        adminJsonRequest({
          feature: "report_exports",
          quantity: 1,
          reason_code: "billing_credit_test"
        })
      )
    );
    expect(credit.credit.sudo_request_id).toBe(started.sudo_request.id);

    const status = await expectOkJson(
      await app.request("/admin-api/sudo/status", adminGetRequest())
    );
    expect(status.active[0].id).toBe(started.sudo_request.id);

    const ended = await expectOkJson(
      await app.request(
        "/admin-api/sudo/end",
        adminJsonRequest({
          action_scope: "issue_billing_credit",
          reason_code: "operator_done"
        })
      )
    );
    expect(ended.revoked[0].status).toBe("revoked");
    expect(ended.status.active).toHaveLength(0);

    const afterEndCredit = await app.request(
      `/admin-api/billing/${DEMO_IDS.workspace}/credit`,
      adminJsonRequest({
        feature: "report_exports",
        quantity: 1,
        reason_code: "billing_credit_after_end"
      })
    );
    expect(afterEndCredit.status).toBe(403);

    const after = await repository.admin_audit_logs.list();
    const actions = after.slice(before.length).map((log) => log.action);
    expect(actions).toContain("sudo_start");
    expect(actions).toContain("sudo_required_action_allowed");
    expect(actions).toContain("sudo_end");
    expect(actions).toContain("sudo_required_action_denied");
  });

  test("rejects expired and wrong-action sudo grants with audit events", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const timestamp = "2026-06-06T12:00:00.000Z";
    await repository.sudo_requests.create({
      id: "sudo_request_test_expired_delete",
      admin_user_id: "admin_user_test_owner",
      role: "owner",
      requested_action: "delete_report",
      target_type: "reports",
      target_id: DEMO_IDS.report,
      action_scope: "delete_report",
      reason_code: "expired_delete_test",
      status: "active",
      approved_by_admin_user_id: "admin_user_test_owner",
      approved_at: timestamp,
      activated_at: timestamp,
      revoked_at: null,
      expires_at: "2026-06-06T12:01:00.000Z",
      ip_address: "127.0.0.1",
      user_agent: "PromptOpts admin route test",
      created_at: timestamp
    });
    const beforeExpired = await repository.admin_audit_logs.list();

    const expiredDelete = await app.request(
      `/admin-api/reports/${DEMO_IDS.report}/delete`,
      adminJsonRequest({
        reason_code: "expired_delete_test",
        sudo_request_id: "sudo_request_test_expired_delete"
      })
    );
    expect(expiredDelete.status).toBe(403);
    expect((await repository.sudo_requests.get("sudo_request_test_expired_delete"))?.status).toBe("expired");
    expect((await repository.admin_audit_logs.list()).slice(beforeExpired.length).map((log) => log.action)).toContain(
      "sudo_expired_rejection"
    );

    const started = await expectOkJson(
      await app.request(
        "/admin-api/sudo/start",
        adminJsonRequest({
          action_scope: "reveal_report",
          reason_code: "raw_report_review",
          mfa_code: createTotpCode("JBSWY3DPEHPK3PXP"),
          target_type: "reports",
          target_id: DEMO_IDS.report
        })
      )
    );
    expect(started.sudo_request.requested_action).toBe("reveal_report");

    const wrongActionDelete = await app.request(
      `/admin-api/reports/${DEMO_IDS.report}/delete`,
      adminJsonRequest({
        reason_code: "wrong_action_delete",
        sudo_request_id: started.sudo_request.id
      })
    );
    expect(wrongActionDelete.status).toBe(403);
    expect((await repository.admin_audit_logs.list()).map((log) => log.action)).toContain(
      "sudo_required_action_denied"
    );
  });

  test("GET /admin-api/overview returns redacted command-center metadata and writes audit", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const before = await repository.admin_audit_logs.list();
    const overview = adminOverviewResponseSchema.parse(
      await expectOkJson(await app.request("/admin-api/overview", adminGetRequest()))
    );
    const after = await repository.admin_audit_logs.list();
    const serialized = JSON.stringify(overview);

    expect(overview.kpis.free_audits).toBe(1);
    expect(overview.kpis.eval_jobs.queued).toBe(1);
    expect(overview.kpis.unverified_models).toBeGreaterThan(0);
    expect(overview.health.api).toBe("ok");
    expect(overview.health.queue).toBe("mocked");
    expect(overview.risk_queue.map((risk) => risk.label)).toEqual([
      "Stale model prices",
      "Failed report exports",
      "Secret-scan warnings",
      "Deletion requests"
    ]);
    expect(overview.live_activity.length).toBeGreaterThan(0);
    expect(serialized).not.toContain("Classify the inbound support message");
    expect(serialized).not.toContain("{{customer_message}}");
    expect(serialized).not.toContain("prompt_text");
    expect(after.length).toBe(before.length + 1);
    expect(after.at(-1)?.target_type).toBe("overview");
  });

  test("implements the admin route map behind placeholder admin middleware", async () => {
    const app = createTestApp();

    await expectOkJson(await app.request("/admin-api/overview", adminGetRequest()));
    const accounts = await expectOkJson(await app.request("/admin-api/accounts", adminGetRequest()));
    expect(accounts.stages).toEqual([
      "new_audit",
      "qualified",
      "eval_ready",
      "trial",
      "paid",
      "needs_review"
    ]);
    expect(accounts.accounts[0]).toMatchObject({
      account: "Acme AI",
      provider: "openai",
      fit_signal: "overpowered",
      stage: "new_audit"
    });

    const account = await expectOkJson(
      await app.request(
        "/admin-api/accounts",
        adminJsonRequest({
          name: "Beta AI",
          workspace_id: null,
          stage: "qualified",
          owner_admin_user_id: null,
          domain: "beta-ai.example",
          redacted_prompt_preview: "No raw prompt in admin CRM."
        })
      )
    );
    expect(account.redacted_prompt_preview).toBe("No raw prompt in admin CRM.");

    await expectOkJson(
      await app.request(`/admin-api/accounts/${DEMO_IDS.account}`, adminGetRequest())
    );
    const accountDetail = await expectOkJson(
      await app.request(`/admin-api/accounts/${DEMO_IDS.account}`, adminGetRequest())
    );
    expect(accountDetail.header.provider).toBe("openai");
    expect(accountDetail.workspace_health.projects).toBe(1);
    expect(accountDetail.projects[0].redacted_prompt_preview).toContain("Classifies");
    expect(accountDetail.reports[0].redacted_summary).toContain("Report metadata");
    expect(accountDetail.billing.placeholder).toContain("Billing tab is placeholder-only");
    expect(accountDetail.support_timeline.map((event: { type: string }) => event.type)).toContain("task");
    expect(accountDetail.redacted_previews[0].redacted_preview).not.toContain("{{customer_message}}");

    const noteResponse = await expectOkJson(
      await app.request(
        `/admin-api/accounts/${DEMO_IDS.account}/notes`,
        adminJsonRequest({
          body: "Manual note without raw prompt content.",
          opportunity_id: DEMO_IDS.opportunity
        })
      )
    );
    expect(noteResponse.note.body_redacted).toContain("Admin note redacted");

    const taskResponse = await expectOkJson(
      await app.request(
        `/admin-api/accounts/${DEMO_IDS.account}/tasks`,
        adminJsonRequest({
          title: "Schedule eval-readiness follow-up",
          opportunity_id: DEMO_IDS.opportunity,
          assignee_admin_user_id: "admin_user_mock"
        })
      )
    );
    expect(taskResponse.task.status).toBe("open");

    const patchedAccount = await expectOkJson(
      await app.request(
        `/admin-api/accounts/${DEMO_IDS.account}`,
        adminPatchJsonRequest({
          stage: "trial"
        })
      )
    );
    expect(patchedAccount.stage).toBe("trial");

    await expectOkJson(await app.request("/admin-api/users", adminGetRequest()));
    const revoke = await expectOkJson(
      await app.request(
        `/admin-api/users/${DEMO_IDS.user}/revoke-sessions`,
        adminJsonRequest({ reason_code: "support_request" })
      )
    );
    expect(revoke.revoked_sessions).toBe(0);

    const impersonation = await expectOkJson(
      await app.request(
        `/admin-api/users/${DEMO_IDS.user}/impersonate`,
        adminJsonRequest(
          { reason_code: "support_escalation" },
          { sudo_grant: { reason_code: "support_escalation" } }
        )
      )
    );
    expect(impersonation.impersonation_started).toBe(false);

    const workspace = await expectOkJson(
      await app.request(
        `/admin-api/workspaces/${DEMO_IDS.workspace}`,
        adminPatchJsonRequest({ name: "Acme AI Ops" })
      )
    );
    expect(workspace.name).toBe("Acme AI Ops");

    const evalJobs = adminEvalRunsResponseSchema.parse(
      await expectOkJson(await app.request("/admin-api/eval-runs", adminGetRequest()))
    );
    expect(evalJobs.queue_summary.queued).toBe(1);
    expect(evalJobs.queue_summary.rate_limited).toBe(0);
    expect(evalJobs.worker_health.map((item) => item.component)).toEqual([
      "eval-runner",
      "provider-adapter",
      "scoring",
      "report-generator"
    ]);
    expect(evalJobs.jobs[0]).toMatchObject({
      id: DEMO_IDS.evalRun,
      workspace: "Acme AI Ops",
      provider: "openai",
      action: "cancel",
      redaction_state: "redacted"
    });

    const evalJobDetail = adminEvalRunDetailResponseSchema.parse(
      await expectOkJson(
        await app.request(`/admin-api/eval-runs/${DEMO_IDS.evalRun}`, adminGetRequest())
      )
    );
    expect(evalJobDetail.sanitized_payload.candidate_ids).toHaveLength(2);
    expect(evalJobDetail.model_ids).toEqual(["openai-demo-balanced"]);
    expect(evalJobDetail.test_count).toBe(5);
    expect(JSON.stringify(evalJobDetail)).not.toContain("{{customer_message}}");

    const retried = await expectOkJson(
      await app.request(
        `/admin-api/eval-runs/${DEMO_IDS.evalRun}/retry`,
        adminJsonRequest({ reason_code: "operator_retry" })
      )
    );
    expect(retried.eval_run.status).toBe("retrying");

    const cancelled = await expectOkJson(
      await app.request(
        `/admin-api/eval-runs/${DEMO_IDS.evalRun}/cancel`,
        adminJsonRequest({ reason_code: "operator_cancel" })
      )
    );
    expect(cancelled.eval_run.status).toBe("failed");

    const regenerated = await expectOkJson(
      await app.request(
        `/admin-api/eval-runs/${DEMO_IDS.evalRun}/regenerate-report`,
        adminJsonRequest({ reason_code: "operator_regenerate" })
      )
    );
    expect(regenerated.report.production_recommendation_allowed).toBe(false);

    const reveal = await expectOkJson(
      await app.request(
        `/admin-api/prompts/${DEMO_IDS.prompt}/reveal`,
        adminGetRequest({ sudo_grant: { reason_code: "prompt_reveal_test" } })
      )
    );
    expect(reveal.raw_prompt).toBeNull();

    const registry = adminModelRegistryResponseSchema.parse(
      await expectOkJson(await app.request("/admin-api/models", adminGetRequest()))
    );
    expect(registry.freshness_summary.unverified).toBeGreaterThan(0);
    const firstProposal = registry.proposed_changes.at(0);
    expect(firstProposal).toBeDefined();
    expect(firstProposal?.approval_actions.approve_enabled).toBe(true);
    expect(firstProposal?.diff.length).toBeGreaterThan(0);

    const patchedModel = modelPatchResponseSchema.parse(
      await expectOkJson(
        await app.request(
          "/admin-api/models/model_registry_openai_demo_balanced",
          adminPatchJsonRequest(
            {
              display_name: "OpenAI Demo Balanced Internal",
              source_url: "https://example.com/verified"
            },
            { sudo_grant: { reason_code: "registry_edit" } }
          )
        )
      )
    );
    expect(patchedModel.model.display_name).toBe("OpenAI Demo Balanced");
    expect(patchedModel.proposal.approval_state).toBe("pending_review");
    expect(patchedModel.diff.map((entry) => entry.field)).toContain("display_name");

    const approvedModel = modelApproveResponseSchema.parse(
      await expectOkJson(
        await app.request(
          "/admin-api/models/model_registry_openai_demo_balanced/approve",
          adminJsonRequest(
            {
              verified_by: "admin_user_mock",
              source_url: "https://example.com/verified",
              last_verified_at: "2026-01-16T12:00:00.000Z",
              reason_code: "registry_review"
            },
            { sudo_grant: { reason_code: "registry_review" } }
          )
        )
      )
    );
    expect(approvedModel.model.display_name).toBe("OpenAI Demo Balanced Internal");
    expect(approvedModel.model.freshness_status).toBe("fresh");
    expect(approvedModel.approved_version.approval_state).toBe("approved");

    const reportsVault = adminReportsResponseSchema.parse(
      await expectOkJson(await app.request("/admin-api/reports", adminGetRequest()))
    );
    expect(reportsVault.summary.failed_export).toBeGreaterThan(0);
    expect(reportsVault.summary.raw_locked).toBeGreaterThan(0);
    expect(reportsVault.reports.map((report: { action: string }) => report.action)).toContain("request_sudo_for_raw");

    const reportReveal = await expectOkJson(
      await app.request(
        `/admin-api/reports/${DEMO_IDS.report}/reveal`,
        adminGetRequest({ sudo_grant: { reason_code: "raw_report_reveal_test" } })
      )
    );
    expect(reportReveal.raw_report).toBeNull();

    const retriedExport = reportExportActionResponseSchema.parse(
      await expectOkJson(
        await app.request(
          `/admin-api/reports/${DEMO_IDS.report}/retry-export`,
          adminJsonRequest({ reason_code: "retry_failed_export" })
        )
      )
    );
    expect(retriedExport.redaction_state).toBe("redacted");

    const regeneratedExport = reportExportActionResponseSchema.parse(
      await expectOkJson(
        await app.request(
          `/admin-api/reports/${DEMO_IDS.report}/regenerate`,
          adminJsonRequest({ reason_code: "regenerate_redacted_exports" })
        )
      )
    );
    expect(regeneratedExport.todo).toContain("evals were not rerun");

    const deleteResponse = reportDeleteResponseSchema.parse(
      await expectOkJson(
        await app.request(
          `/admin-api/reports/${DEMO_IDS.report}/delete`,
          adminJsonRequest(
            {
              reason_code: "customer_request"
            },
            { sudo_grant: { reason_code: "customer_request" } }
          )
        )
      )
    );
    expect(deleteResponse.deletion_queued).toBe(false);
    expect(deleteResponse.deletion_status).toBe("deleted");
    expect(deleteResponse.artifact_failures).toBe(0);
    expect(deleteResponse.artifacts_deleted).toBeGreaterThan(0);
    expect(deleteResponse.scoped_records_marked).toContain("object_storage.artifacts");

    const billing = billingResponseSchema.parse(
      await expectOkJson(await app.request("/admin-api/billing", adminGetRequest()))
    );
    expect(billing.plan?.name).toBe("Demo Growth");
    expect(billing.entitlement_checks.map((check) => check.feature)).toContain("hosted_eval_runs");
    expect(billing.entitlement_checks.map((check) => check.feature)).toContain("pdf_export");
    expect(billing.invoices).toHaveLength(1);
    expect(billing.credits).toHaveLength(1);
    expect(billing.feature_flags.map((flag) => flag.key)).toContain("cli_beta");

    const credit = billingCreditResponseSchema.parse(
      await expectOkJson(
        await app.request(
          `/admin-api/billing/${DEMO_IDS.workspace}/credit`,
          adminJsonRequest(
            {
              feature: "free_audits",
              quantity: 1,
              reason_code: "manual_adjustment"
            },
            { sudo_grant: { reason_code: "manual_adjustment" } }
          )
        )
      )
    );
    expect(credit.ledger_entry.direction).toBe("credit");
    expect(credit.credit.reason_code).toBe("manual_adjustment");
    expect(credit.billing_event.event_type).toBe("credit_issued");

    const breakGlass = await expectOkJson(
      await app.request(
        "/admin-api/break-glass",
        adminJsonRequest(
          { reason_code: "owner_emergency_test" },
          { sudo_grant: { reason_code: "owner_emergency_test" } }
        )
      )
    );
    expect(breakGlass.break_glass_started).toBe(false);

    const auditLogs = await expectOkJson(await app.request("/admin-api/audit-logs", adminGetRequest()));
    expect(auditLogs.audit_logs.length).toBeGreaterThan(1);
  });

  test("does not expose raw prompt content in admin account responses", async () => {
    const accountDetail = await expectOkJson(
      await createTestApp().request(`/admin-api/accounts/${DEMO_IDS.account}`, adminGetRequest())
    );

    expect(JSON.stringify(accountDetail)).not.toContain("Classify the inbound support message");
    expect(accountDetail.account.redacted_prompt_preview).toContain("Support classifier");
  });

  test("redacts Account 360 contact and prompt metadata for support role", async () => {
    const accountDetail = await expectOkJson(
      await createTestApp().request(
        `/admin-api/accounts/${DEMO_IDS.account}`,
        adminGetRequest({ role: "support" })
      )
    );
    const serialized = JSON.stringify(accountDetail);

    expect(serialized).not.toContain("ops@acme-ai.example");
    expect(serialized).not.toContain("Support classifier prompt with variables only.");
    expect(accountDetail.contacts[0].email).toContain("@promptopts.invalid");
    expect(accountDetail.account.redacted_prompt_preview).toContain("Prompt redacted");
  });

  test("enforces session, MFA, action scope, and sudo on admin routes", async () => {
    const app = createTestApp();

    const noSession = await app.request("/admin-api/overview");
    expect(noSession.status).toBe(401);

    const noMfa = await app.request(
      "/admin-api/overview",
      adminGetRequest({ mfa_verified: false })
    );
    expect(noMfa.status).toBe(403);

    const readOnlyGet = await app.request(
      "/admin-api/accounts",
      adminGetRequest({ role: "read_only" })
    );
    expect(readOnlyGet.status).toBe(200);

    const missingScope = await app.request(
      "/admin-api/overview",
      adminGetRequest({ missingScope: true })
    );
    expect(missingScope.status).toBe(403);

    const readOnlyMutation = await app.request(
      "/admin-api/accounts",
      adminJsonRequest(
        {
          name: "Blocked AI",
          workspace_id: null,
          stage: "qualified",
          owner_admin_user_id: null,
          domain: "blocked.example",
          redacted_prompt_preview: null
        },
        { role: "read_only" }
      )
    );
    expect(readOnlyMutation.status).toBe(403);

    const noSudo = await app.request(
      `/admin-api/reports/${DEMO_IDS.report}/delete`,
      adminJsonRequest(
        {
          reason_code: "customer_request",
          sudo_request_id: null
        },
        { sudo_grant: null }
      )
    );
    expect(noSudo.status).toBe(403);

    const noSudoRawReport = await app.request(
      `/admin-api/reports/${DEMO_IDS.report}/reveal`,
      adminGetRequest({ sudo_grant: null })
    );
    expect(noSudoRawReport.status).toBe(403);

    const sudoReveal = await app.request(
      `/admin-api/prompts/${DEMO_IDS.prompt}/reveal`,
      adminGetRequest({ sudo_grant: { reason_code: "prompt_reveal_test" } })
    );
    expect(sudoReveal.status).toBe(200);

    const supportCredit = await app.request(
      `/admin-api/billing/${DEMO_IDS.workspace}/credit`,
      adminJsonRequest(
        {
          feature: "report_exports",
          quantity: 1,
          reason_code: "support_credit_denied"
        },
        {
          role: "support",
          sudo_grant: { reason_code: "support_credit_denied" }
        }
      )
    );
    expect(supportCredit.status).toBe(403);
  });

  test("writes audit logs for mutations and sensitive reads", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const before = await repository.admin_audit_logs.list();

    await app.request(
      `/admin-api/accounts/${DEMO_IDS.account}`,
      adminPatchJsonRequest({ stage: "trial" })
    );
    await app.request("/admin-api/audit-logs", adminGetRequest());

    const after = await repository.admin_audit_logs.list();
    expect(after.length).toBe(before.length + 2);
    expect(after.at(-1)?.target_type).toBe("audit_logs");
  });

  test("audits Account 360 sensitive reads and CRM mutations", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const before = await repository.admin_audit_logs.list();

    await app.request(`/admin-api/accounts/${DEMO_IDS.account}`, adminGetRequest());
    await app.request(
      `/admin-api/accounts/${DEMO_IDS.account}/notes`,
      adminJsonRequest({ body: "Follow up on eval readiness.", opportunity_id: DEMO_IDS.opportunity })
    );
    await app.request(
      `/admin-api/accounts/${DEMO_IDS.account}/tasks`,
      adminJsonRequest({ title: "Invite eval run", opportunity_id: DEMO_IDS.opportunity })
    );

    const after = await repository.admin_audit_logs.list();
    expect(after.length).toBe(before.length + 3);
    expect(after.slice(-3).map((log) => log.target_type)).toEqual([
      "accounts",
      "accounts",
      "accounts"
    ]);
  });

  test("returns sanitized eval job detail and audits retry/cancel actions", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const timestamp = "2026-01-16T12:00:00.000Z";
    await repository.eval_runs.update(DEMO_IDS.evalRun, {
      status: "failed",
      started_at: timestamp,
      completed_at: timestamp
    });
    await repository.eval_results.create({
      id: "eval_result_provider_error_demo",
      eval_run_id: DEMO_IDS.evalRun,
      candidate_id: "candidate_support_classifier_balanced",
      prompt_version_id: DEMO_IDS.promptVersion,
      model_registry_record_id: "model_registry_openai_demo_balanced",
      provider: "openai",
      model_id: "openai-demo-balanced",
      quality_score: 0,
      pass_rate: 0,
      must_pass_failures: 1,
      input_tokens: 22,
      output_tokens: 0,
      estimated_cost_usd: null,
      cost_estimate_status: "blocked",
      latency_ms: null,
      risk_level: "high",
      verdict: "blocked",
      failed_check_ids: ["provider_error_rate_limited_demo"],
      is_mock: true,
      created_at: timestamp
    });

    const before = await repository.admin_audit_logs.list();
    const detail = adminEvalRunDetailResponseSchema.parse(
      await expectOkJson(
        await app.request(`/admin-api/eval-runs/${DEMO_IDS.evalRun}`, adminGetRequest())
      )
    );
    expect(detail.failed_checks).toHaveLength(1);
    expect(detail.sanitized_provider_error).toContain("[redacted]");
    expect(JSON.stringify(detail)).not.toContain("sk-demo-secret");
    expect(JSON.stringify(detail)).not.toContain("Classify the inbound support message");

    await app.request(
      `/admin-api/eval-runs/${DEMO_IDS.evalRun}/retry`,
      adminJsonRequest({ reason_code: "retry_failed_provider_error" })
    );
    await app.request(
      `/admin-api/eval-runs/${DEMO_IDS.evalRun}/cancel`,
      adminJsonRequest({ reason_code: "cancel_stuck_job" })
    );

    const after = await repository.admin_audit_logs.list();
    expect(after.length).toBe(before.length + 3);
    expect(after.slice(-2).map((log) => log.target_type)).toEqual(["eval_runs", "eval_runs"]);
    expect(after.slice(-2).map((log) => log.action_scope)).toEqual(["retry_eval", "retry_eval"]);
  });

  test("audits reports vault and billing mutations plus raw report sensitive reads", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({ repository });
    const before = await repository.admin_audit_logs.list();

    await app.request(
      `/admin-api/reports/${DEMO_IDS.report}/reveal`,
      adminGetRequest({ sudo_grant: { reason_code: "raw_report_reveal_test" } })
    );
    await app.request(
      `/admin-api/reports/${DEMO_IDS.report}/retry-export`,
      adminJsonRequest({ reason_code: "retry_failed_export" })
    );
    await app.request(
      `/admin-api/reports/${DEMO_IDS.report}/regenerate`,
      adminJsonRequest({ reason_code: "regenerate_export" })
    );
    await app.request(
      `/admin-api/reports/${DEMO_IDS.report}/delete`,
      adminJsonRequest(
        { reason_code: "customer_delete" },
        { sudo_grant: { reason_code: "customer_delete" } }
      )
    );
    await app.request(
      `/admin-api/billing/${DEMO_IDS.workspace}/credit`,
      adminJsonRequest(
        { feature: "report_exports", quantity: 1, reason_code: "billing_credit_test" },
        { sudo_grant: { reason_code: "billing_credit_test" } }
      )
    );

    const after = await repository.admin_audit_logs.list();
    const added = after.slice(before.length);
    expect(added).toHaveLength(16);
    expect(added.filter((log) => log.action === "sudo_required_action_allowed")).toHaveLength(3);
    expect(added.map((log) => log.action)).toContain("report_deletion_requested");
    expect(added.map((log) => log.action)).toContain("report_artifact_delete_started");
    expect(added.map((log) => log.action)).toContain("report_artifact_deleted");
    expect(added.map((log) => log.action)).toContain("report_deletion_completed");
    expect(added.filter((log) => log.action_scope === "delete_report")).toHaveLength(10);
    expect(added.filter((log) => log.target_type === "billing")).toHaveLength(2);
  });

  test("keeps report deletion retryable when object deletion fails", async () => {
    const repository = createAdminTestRepository();
    const app = createApp({
      repository,
      reportArtifactStorage: createDeleteFailingStorage()
    });

    await expectOkJson(
      await app.request(
        `/admin-api/reports/${DEMO_IDS.report}/retry-export`,
        adminJsonRequest({ reason_code: "prepare_storage_failure" })
      )
    );

    const deleteResponse = reportDeleteResponseSchema.parse(
      await expectOkJson(
        await app.request(
          `/admin-api/reports/${DEMO_IDS.report}/delete`,
          adminJsonRequest(
            { reason_code: "customer_delete_failure" },
            { sudo_grant: { reason_code: "customer_delete_failure" } }
          )
        )
      )
    );

    expect(deleteResponse.deletion_queued).toBe(true);
    expect(deleteResponse.deletion_status).toBe("failed");
    expect(deleteResponse.artifact_failures).toBeGreaterThan(0);

    const artifacts = await repository.report_artifacts.list();
    expect(artifacts.filter((artifact) => artifact.report_id === DEMO_IDS.report)).toContainEqual(
      expect.objectContaining({
        deletion_status: "failed",
        last_deletion_error: "Object was missing or could not be deleted."
      })
    );
    const auditLogs = await repository.admin_audit_logs.list();
    expect(auditLogs.map((log) => log.action)).toContain("report_artifact_delete_failed");
    expect(auditLogs.map((log) => log.action)).toContain("report_deletion_failed");
  });

  test("keeps public and admin namespaces separated", async () => {
    const app = createTestApp();

    expect((await app.request("/admin-api/health", adminGetRequest())).status).toBe(404);
    expect((await app.request("/accounts")).status).toBe(404);
    expect((await app.request("/models")).status).toBe(200);
    expect((await app.request("/admin-api/models", adminGetRequest())).status).toBe(200);
  });
});
