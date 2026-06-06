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

function createAccountPipelineRows(input: {
  accounts: Account[];
  opportunities: Opportunity[];
  freeAudits: FreeAudit[];
  notes: CrmNote[];
  tasks: CrmTask[];
}): AdminAccountsResponse["accounts"] {
  return input.accounts
    .map((account) => {
      const opportunity = latestBy(
        input.opportunities.filter((item) => item.account_id === account.id),
        (item) => item.updated_at
      );
      const lastActivityAt = maxIso([
        account.updated_at,
        opportunity?.updated_at ?? null,
        ...input.freeAudits
          .filter((item) => item.account_id === account.id)
          .map((item) => item.created_at),
        ...input.notes.filter((item) => item.account_id === account.id).map((item) => item.created_at),
        ...input.tasks.filter((item) => item.account_id === account.id).map((item) => item.updated_at)
      ]);

      return {
        account_id: account.id,
        account: account.name,
        provider: account.provider_preference ?? opportunity?.provider ?? null,
        fit_signal: opportunity?.fit_signal ?? null,
        volume: opportunity?.estimated_volume ?? opportunity?.estimated_monthly_calls ?? null,
        savings_opportunity_usd:
          opportunity?.estimated_savings ?? opportunity?.savings_opportunity_usd ?? null,
        stage: account.stage,
        owner_admin_user_id: account.owner_admin_user_id,
        last_activity_at: lastActivityAt,
        redacted_prompt_preview: account.redacted_prompt_preview,
        opportunity_id: opportunity?.id ?? null,
        redaction_state: "redacted" as const
      };
    })
    .sort((a, b) => (b.last_activity_at ?? "").localeCompare(a.last_activity_at ?? ""));
}

async function createAccountDetail(
  repository: ApiEnv["Variables"]["repository"],
  account: Account,
  role: ApiEnv["Variables"]["adminSession"]["role"],
  prefetched: {
    contacts: Contact[];
    opportunities: Opportunity[];
  }
): Promise<AdminAccountDetailResponse> {
  const [
    workspaces,
    projects,
    prompts,
    analyses,
    evalRuns,
    reports,
    entitlements,
    usageLedger,
    freeAudits,
    notes,
    tasks
  ] = await Promise.all([
    repository.workspaces.list(),
    repository.projects.list(),
    repository.prompts.list(),
    repository.prompt_analyses.list(),
    repository.eval_runs.list(),
    repository.reports.list(),
    repository.entitlements.list(),
    repository.usage_ledger.list(),
    repository.free_audits.list(),
    repository.crm_notes.list(),
    repository.tasks.list()
  ]);
  const shouldStrictlyRedact = role === "support";
  const contacts = prefetched.contacts
    .filter((contact) => contact.account_id === account.id)
    .map((contact) => redactContactForRole(contact, shouldStrictlyRedact));
  const opportunities = prefetched.opportunities.filter(
    (opportunity) => opportunity.account_id === account.id
  );
  const workspace = account.workspace_id
    ? workspaces.find((item) => item.id === account.workspace_id) ?? null
    : null;
  const projectIdsFromOpportunities = new Set(
    opportunities
      .map((opportunity) => opportunity.project_id)
      .filter((id): id is string => Boolean(id))
  );
  const accountProjects = projects.filter((project) => {
    if (account.workspace_id && project.workspace_id === account.workspace_id) {
      return true;
    }

    return projectIdsFromOpportunities.has(project.id);
  });
  const accountProjectIds = new Set(accountProjects.map((project) => project.id));
  const accountPrompts = prompts.filter((prompt) => accountProjectIds.has(prompt.project_id));
  const accountAnalyses = analyses.filter((analysis) => {
    const prompt = accountPrompts.find((item) => item.current_version_id === analysis.prompt_version_id);
    return Boolean(prompt);
  });
  const accountEvalRuns = evalRuns.filter((evalRun) => accountProjectIds.has(evalRun.project_id));
  const accountReports = reports.filter((report) => accountProjectIds.has(report.project_id));
  const accountEntitlements = entitlements.filter(
    (entitlement) => account.workspace_id && entitlement.workspace_id === account.workspace_id
  );
  const accountUsageLedger = usageLedger.filter(
    (entry) => account.workspace_id && entry.workspace_id === account.workspace_id
  );
  const accountFreeAudits = freeAudits.filter((freeAudit) => freeAudit.account_id === account.id);
  const accountNotes = notes.filter((note) => note.account_id === account.id);
  const accountTasks = tasks.filter((task) => task.account_id === account.id);
  const latestOpportunity = latestBy(opportunities, (opportunity) => opportunity.updated_at);
  const plan = accountEntitlements[0]?.plan_id ?? "placeholder";
  const seats =
    accountEntitlements.find((entitlement) => entitlement.feature === "admin_seats")?.limit ?? 1;
  const accountForRole = shouldStrictlyRedact
    ? {
        ...account,
        domain: account.domain ? "domain.redacted" : null,
        redacted_prompt_preview: redactPromptPreview(account.redacted_prompt_preview ?? account.name)
      }
    : account;

  return {
    account: accountForRole,
    header: {
      plan,
      seats,
      provider: account.provider_preference ?? latestOpportunity?.provider ?? null,
      byok_status: "unknown",
      usage:
        accountUsageLedger.length > 0
          ? `${accountUsageLedger.length} usage ledger event(s)`
          : "Usage ledger placeholder",
      estimated_savings_usd:
        latestOpportunity?.estimated_savings ?? latestOpportunity?.savings_opportunity_usd ?? null,
      stage: account.stage,
      owner_admin_user_id: account.owner_admin_user_id
    },
    workspace_health: {
      workspace_id: workspace?.id ?? null,
      workspace_name: workspace?.name ?? null,
      status: getWorkspaceHealthStatus(accountProjects, accountEvalRuns, accountReports),
      projects: accountProjects.length,
      eval_runs: accountEvalRuns.length,
      reports: accountReports.length,
      redacted_summary: getWorkspaceHealthSummary(accountProjects, accountEvalRuns, accountReports)
    },
    projects: accountProjects.map((project) => {
      const prompt = accountPrompts.find((item) => item.project_id === project.id) ?? null;

      return {
        project_id: project.id,
        name: project.name,
        provider: project.current_provider,
        current_model_id: project.current_model_id,
        status: project.status,
        prompt_id: prompt?.id ?? null,
        redacted_prompt_preview: prompt
          ? redactPreviewForRole(prompt.redacted_preview, shouldStrictlyRedact)
          : null
      };
    }),
    reports: accountReports.map((report) => ({
      report_id: report.id,
      project_id: report.project_id,
      status: report.status,
      production_recommendation_allowed: report.production_recommendation_allowed,
      generated_at: report.generated_at,
      redacted_summary: report.production_recommendation_allowed
        ? "Report metadata shows an eval-backed recommendation exists."
        : "Report metadata shows production recommendation is blocked or pending."
    })),
    billing: {
      plan,
      seats,
      usage_ledger_events: accountUsageLedger.length,
      placeholder: "Billing tab is placeholder-only until billing events, invoices, and credits are durable."
    },
    support_timeline: createSupportTimeline({
      notes: accountNotes,
      tasks: accountTasks,
      freeAudits: accountFreeAudits,
      opportunities,
      reports: accountReports
    }),
    redacted_previews: createRedactedPreviews({
      projects: accountProjects,
      prompts: accountPrompts,
      analyses: accountAnalyses,
      reports: accountReports,
      freeAudits: accountFreeAudits,
      strict: shouldStrictlyRedact
    }),
    contacts,
    opportunities,
    notes: accountNotes,
    tasks: accountTasks
  };
}

function redactContactForRole(contact: Contact, strict: boolean): Contact {
  if (!strict) {
    return contact;
  }

  return {
    ...contact,
    name: "Contact redacted",
    email: `redacted-${contact.id.replace(/[^a-z0-9]/gi, "").slice(-8) || "contact"}@promptopts.invalid`,
    role: contact.role ? "Role redacted" : null
  };
}

function getWorkspaceHealthStatus(
  projects: PromptProject[],
  evalRuns: EvalRun[],
  reports: RecommendationReport[]
): AdminAccountDetailResponse["workspace_health"]["status"] {
  if (projects.length === 0) {
    return "unknown";
  }

  if (reports.some((report) => report.production_recommendation_allowed)) {
    return "healthy";
  }

  if (evalRuns.length === 0 || evalRuns.some((evalRun) => evalRun.status !== "complete")) {
    return "needs_eval";
  }

  return "needs_review";
}

function getWorkspaceHealthSummary(
  projects: PromptProject[],
  evalRuns: EvalRun[],
  reports: RecommendationReport[]
): string {
  if (projects.length === 0) {
    return "No workspace project metadata is attached to this account.";
  }

  if (reports.some((report) => report.production_recommendation_allowed)) {
    return "At least one report has eval-backed recommendation metadata.";
  }

  if (evalRuns.length === 0) {
    return "Projects exist, but no eval run metadata is attached yet.";
  }

  return "Workspace has eval/report metadata, but operator review is still needed.";
}

function createSupportTimeline(input: {
  notes: CrmNote[];
  tasks: CrmTask[];
  freeAudits: FreeAudit[];
  opportunities: Opportunity[];
  reports: RecommendationReport[];
}): AdminAccountDetailResponse["support_timeline"] {
  const noteEvents = input.notes.map((note) => ({
    id: note.id,
    type: "note" as const,
    label: note.body_redacted,
    timestamp: note.created_at,
    actor: note.author_admin_user_id ? redactIdentifier(note.author_admin_user_id, "admin") : "system",
    redaction_state: note.redaction_state
  }));
  const taskEvents = input.tasks.map((task) => ({
    id: task.id,
    type: "task" as const,
    label: `${task.status}: ${task.title}`,
    timestamp: task.updated_at,
    actor: task.assignee_admin_user_id ? redactIdentifier(task.assignee_admin_user_id, "admin") : "unassigned",
    redaction_state: "redacted" as const
  }));
  const freeAuditEvents = input.freeAudits.map((freeAudit) => ({
    id: freeAudit.id,
    type: "free_audit" as const,
    label: `Free audit captured ${freeAudit.model_fit} fit; run evals before switching.`,
    timestamp: freeAudit.created_at,
    actor: "system",
    redaction_state: "redacted" as const
  }));
  const opportunityEvents = input.opportunities.map((opportunity) => ({
    id: opportunity.id,
    type: "opportunity" as const,
    label: `${opportunity.stage} opportunity for ${opportunity.provider}/${opportunity.current_model_id}`,
    timestamp: opportunity.updated_at,
    actor: "system",
    redaction_state: "redacted" as const
  }));
  const reportEvents = input.reports.map((report) => ({
    id: report.id,
    type: "report" as const,
    label: `Report ${report.status}; raw report content remains hidden.`,
    timestamp: report.updated_at,
    actor: "system",
    redaction_state: "redacted" as const
  }));

  return [...noteEvents, ...taskEvents, ...freeAuditEvents, ...opportunityEvents, ...reportEvents]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 12);
}

function createRedactedPreviews(input: {
  projects: PromptProject[];
  prompts: Prompt[];
  analyses: PromptAnalysis[];
  reports: RecommendationReport[];
  freeAudits: FreeAudit[];
  strict: boolean;
}): AdminAccountDetailResponse["redacted_previews"] {
  const promptPreviews = input.prompts.map((prompt) => {
    const analysis = input.analyses.find((item) => item.prompt_version_id === prompt.current_version_id);

    return {
      id: prompt.id,
      type: "prompt" as const,
      label: prompt.name,
      redacted_preview: redactPreviewForRole(prompt.redacted_preview, input.strict),
      risk_level: analysis?.risk_level ?? null
    };
  });
  const projectPreviews = input.projects.map((project) => ({
    id: project.id,
    type: "project" as const,
    label: project.name,
    redacted_preview: `Project metadata only: ${project.current_provider}/${project.current_model_id}.`,
    risk_level: null
  }));
  const reportPreviews = input.reports.map((report) => ({
    id: report.id,
    type: "report" as const,
    label: `Report ${report.status}`,
    redacted_preview: report.production_recommendation_allowed
      ? "Eval-backed recommendation metadata is available; raw report is hidden."
      : "Report is blocked or pending; raw report is hidden.",
    risk_level: null
  }));
  const freeAuditPreviews = input.freeAudits.map((freeAudit) => ({
    id: freeAudit.id,
    type: "free_audit" as const,
    label: "Free audit",
    redacted_preview: redactPreviewForRole(freeAudit.redacted_prompt_preview, input.strict),
    risk_level: null
  }));

  return [...promptPreviews, ...projectPreviews, ...reportPreviews, ...freeAuditPreviews];
}

function redactPreviewForRole(preview: string, strict: boolean): string {
  return strict ? redactPromptPreview(preview) : preview;
}

function redactCrmNoteBody(body: string): string {
  return `Admin note redacted (${body.replace(/\s+/g, " ").trim().length} chars)`;
}

function latestBy<TItem>(items: TItem[], getTimestamp: (item: TItem) => string): TItem | null {
  return (
    items
      .slice()
      .sort((a, b) => getTimestamp(b).localeCompare(getTimestamp(a)))
      .at(0) ?? null
  );
}

function maxIso(values: Array<string | null>): string | null {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))
    .at(0) ?? null;
}


function redactIdentifier(id: string, prefix: string): string {
  const suffix = id.replace(/[^a-zA-Z0-9]/g, "").slice(-6);

  return `${prefix}_${suffix || "redacted"}`;
}

export { createAccountDetail, createAccountPipelineRows, redactCrmNoteBody };
