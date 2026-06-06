import { decideRecommendation } from "@promptopts/eval-core";
import { generateReportArtifacts, persistGeneratedReportArtifacts } from "@promptopts/report-generator";
import { redactProviderError, redactPromptPreview, writeAdminSecurityAuditEvent } from "@promptopts/admin-core";
import type {
  Account,
  AdminAuditLog,
  BillingEvent,
  Contact,
  Credit,
  CrmNote,
  CrmTask,
  DeletionRequest,
  Entitlement,
  EvalResult,
  EvalRun,
  FeatureFlag,
  FreeAudit,
  Invoice,
  ModelRegistryRecord,
  ModelRegistryVersion,
  Opportunity,
  Plan,
  Prompt,
  PromptAnalysis,
  PromptProject,
  ProviderConnection,
  RecommendationReport,
  ReportArtifact,
  ReportArtifactStorage,
  UsageLedgerEntry,
  Workspace
} from "@promptopts/shared";
import type {
  AdminAccountDetailResponse,
  AdminAccountsResponse,
  AdminOverviewResponse
} from "../contracts";
import type { ApiEnv } from "../context";
import { createId, getEvalRunDetail, nowIso, stripUndefined } from "../http";

function createBillingAdminResponse(input: {
  workspace: Workspace | null;
  entitlements: Entitlement[];
  usageLedger: UsageLedgerEntry[];
  plans: Plan[];
  invoices: Invoice[];
  credits: Credit[];
  billingEvents: BillingEvent[];
  featureFlags: FeatureFlag[];
}) {
  const workspaceId = input.workspace?.id ?? null;
  const workspaceEntitlements = workspaceId
    ? input.entitlements.filter((entitlement) => entitlement.workspace_id === workspaceId)
    : input.entitlements;
  const plan = input.plans.find((item) => item.id === workspaceEntitlements[0]?.plan_id) ?? input.plans[0] ?? null;
  const seatEntitlement = workspaceEntitlements.find((entitlement) =>
    entitlement.feature === "seats" || entitlement.feature === "admin_seats"
  );

  return {
    plans: input.plans,
    plan,
    trial_state: "trialing" as const,
    seats: {
      limit: seatEntitlement?.limit ?? 0,
      used: seatEntitlement?.used ?? 0
    },
    entitlement_checks: createEntitlementChecks(workspaceEntitlements),
    entitlements: workspaceEntitlements,
    usage_ledger: workspaceId
      ? input.usageLedger.filter((entry) => entry.workspace_id === workspaceId)
      : input.usageLedger,
    invoices: workspaceId
      ? input.invoices.filter((invoice) => invoice.workspace_id === workspaceId)
      : input.invoices,
    credits: workspaceId
      ? input.credits.filter((credit) => credit.workspace_id === workspaceId)
      : input.credits,
    billing_events: workspaceId
      ? input.billingEvents.filter((event) => event.workspace_id === workspaceId)
      : input.billingEvents,
    feature_flags: input.featureFlags,
    notes: [
      "Credits require finance or owner action scope, sudo, reason code, and an audit event.",
      "Public eval and export routes enforce hosted eval, report export, and PDF export entitlements.",
      "Invoices, credits, billing events, and flags are memory-backed placeholders until billing infrastructure is wired."
    ]
  };
}

function createEntitlementChecks(entitlements: Entitlement[]) {
  const features: Array<{ feature: Entitlement["feature"]; label: string; enforced: boolean }> = [
    { feature: "hosted_eval_runs", label: "Hosted eval run limit", enforced: true },
    { feature: "prompt_history", label: "Prompt history entitlement", enforced: false },
    { feature: "report_exports", label: "Report export entitlement", enforced: true },
    { feature: "csv_upload", label: "CSV upload", enforced: false },
    { feature: "byok", label: "BYOK", enforced: false },
    { feature: "pdf_export", label: "PDF export", enforced: true },
    { feature: "cli_beta", label: "CLI beta", enforced: false },
    { feature: "seats", label: "Seats", enforced: false }
  ];

  return features.map(({ feature, label, enforced }) => {
    const entitlement = entitlements.find((item) => item.feature === feature);
    const limit = entitlement?.limit ?? 0;
    const used = entitlement?.used ?? 0;

    return {
      feature,
      label,
      enabled: limit > 0,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      enforced_on_public_routes: enforced
    };
  });
}

async function upsertWorkspaceEntitlements(
  repository: ApiEnv["Variables"]["repository"],
  input: {
    workspaceId: string;
    planId: string;
    entitlements: Array<{ feature: Entitlement["feature"]; limit: number; used?: number | undefined }>;
    timestamp: string;
  }
): Promise<void> {
  const current = await repository.entitlements.list();

  for (const entitlement of input.entitlements) {
    const existing = current.find(
      (item) => item.workspace_id === input.workspaceId && item.feature === entitlement.feature
    );

    if (existing) {
      await repository.entitlements.update(existing.id, {
        plan_id: input.planId,
        limit: entitlement.limit,
        used: entitlement.used ?? existing.used
      });
    } else {
      await repository.entitlements.create({
        id: createId("entitlement"),
        workspace_id: input.workspaceId,
        plan_id: input.planId,
        feature: entitlement.feature,
        limit: entitlement.limit,
        used: entitlement.used ?? 0,
        is_mock: true,
        starts_at: input.timestamp,
        ends_at: null,
        created_at: input.timestamp
      });
    }
  }
}

async function upsertFeatureFlags(
  repository: ApiEnv["Variables"]["repository"],
  input: {
    flags: Record<string, boolean>;
    adminUserId: string;
    timestamp: string;
  }
): Promise<void> {
  const current = await repository.feature_flags.list();

  for (const [key, enabled] of Object.entries(input.flags)) {
    const existing = current.find((flag) => flag.key === key);

    if (existing) {
      await repository.feature_flags.update(existing.id, {
        enabled,
        updated_by_admin_user_id: input.adminUserId,
        updated_at: input.timestamp
      });
    } else {
      await repository.feature_flags.create({
        id: createId("feature_flag"),
        key,
        enabled,
        rollout: {},
        created_by_admin_user_id: input.adminUserId,
        updated_by_admin_user_id: input.adminUserId,
        is_mock: true,
        created_at: input.timestamp,
        updated_at: input.timestamp
      });
    }
  }
}


export { createBillingAdminResponse, upsertFeatureFlags, upsertWorkspaceEntitlements };
