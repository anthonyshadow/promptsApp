import { type Context } from "hono";
import { autoDraftQualityContract, costQualityFrontier, decideRecommendation } from "@promptopts/eval-core";
import {
  generateAggressiveCandidate,
  generateBalancedCandidate,
  generateConservativeCandidate,
  generateModelSpecificCandidate,
  generateOutputLiteCandidate,
  type GeneratedPromptCandidate,
  type PromptCandidateGenerationInput
} from "@promptopts/prompt-core";
import {
  type CandidateStrategy,
  type Account,
  type Contact,
  type CrmNote,
  type CrmTask,
  type Entitlement,
  type EvalResult,
  type EvalRun,
  type FreeAudit,
  type FreeAuditCapture,
  type OptimizationCandidate,
  type Opportunity,
  type PromptAnalysis,
  type PromptOptsRepository,
  type PromptProject,
  type PromptVersion,
  type ProviderConnection,
  type QualityContract,
  type RecommendationReport,
  type TestCase,
  type UsageLedgerEntry
} from "@promptopts/shared";
import { encryptSecret, fingerprintSecret } from "@promptopts/shared/security";
import { errorResponseSchema, type WorkspaceDashboardResponse, type WorkspaceDashboardStatus } from "../contracts";
import type { ApiEnv } from "../context";
import { createId, nowIso, unitForFeature } from "../http";

async function createFreeAuditCapture(
  repository: PromptOptsRepository,
  input: {
    auditId: string;
    provider: FreeAudit["provider"];
    modelId: string;
    taskType: FreeAudit["task_type"];
    monthlyCalls: number;
    modelFit: FreeAudit["model_fit"];
    savingsOpportunityUsd: number | null;
    contactEmail: string | null;
    company: string | null;
    ctaClicked: FreeAudit["cta_clicked"];
    prompt: string;
    timestamp: string;
  }
): Promise<FreeAuditCapture> {
  const redactedPromptPreview = redactShareablePromptPreview(input.prompt);
  const shareableSummary = createShareableFreeAuditSummary({
    provider: input.provider,
    modelId: input.modelId,
    modelFit: input.modelFit,
    ctaClicked: input.ctaClicked
  });
  const leadDomain = inferLeadDomain(input.contactEmail, input.company);
  const account =
    leadDomain || input.contactEmail || input.company
      ? await upsertFreeAuditAccount(repository, {
          provider: input.provider,
          company: input.company,
          domain: leadDomain,
          redactedPromptPreview,
          timestamp: input.timestamp
        })
      : null;
  const contact =
    account && input.contactEmail
      ? await upsertFreeAuditContact(repository, {
          accountId: account.id,
          email: input.contactEmail,
          company: input.company,
          timestamp: input.timestamp
        })
      : null;
  const opportunity = account
    ? await upsertFreeAuditOpportunity(repository, {
        accountId: account.id,
        provider: input.provider,
        modelId: input.modelId,
        taskType: input.taskType,
        monthlyCalls: input.monthlyCalls,
        modelFit: input.modelFit,
        savingsOpportunityUsd: input.savingsOpportunityUsd,
        ctaClicked: input.ctaClicked,
        timestamp: input.timestamp
      })
    : null;
  const freeAudit: FreeAudit = {
    id: input.auditId,
    account_id: account?.id ?? null,
    project_id: null,
    provider: input.provider,
    current_model_id: input.modelId,
    task_type: input.taskType,
    monthly_calls: Math.round(input.monthlyCalls),
    model_fit: input.modelFit,
    savings_opportunity_usd: input.savingsOpportunityUsd,
    eval_readiness: input.ctaClicked === "run_evals" ? "eval_ready" : "needs_tests",
    contact_email: input.contactEmail,
    company: input.company,
    cta_clicked: input.ctaClicked,
    redacted_prompt_preview: redactedPromptPreview,
    shareable_summary: shareableSummary,
    is_mock: true,
    created_at: input.timestamp
  };

  await repository.free_audits.create(freeAudit);
  if (account && opportunity) {
    await createFreeAuditCrmActivity(repository, {
      accountId: account.id,
      opportunityId: opportunity.id,
      provider: input.provider,
      modelId: input.modelId,
      modelFit: input.modelFit,
      ctaClicked: input.ctaClicked,
      redactedPromptPreview,
      timestamp: input.timestamp
    });
  }

  return {
    id: freeAudit.id,
    accountId: account?.id ?? null,
    contactId: contact?.id ?? null,
    opportunityId: opportunity?.id ?? null,
    ctaClicked: input.ctaClicked,
    redactedPromptPreview,
    shareableSummary
  };
}

async function createFreeAuditCrmActivity(
  repository: PromptOptsRepository,
  input: {
    accountId: string;
    opportunityId: string;
    provider: FreeAudit["provider"];
    modelId: string;
    modelFit: FreeAudit["model_fit"];
    ctaClicked: FreeAudit["cta_clicked"];
    redactedPromptPreview: string;
    timestamp: string;
  }
): Promise<void> {
  const note: CrmNote = {
    id: createId("crm_note"),
    account_id: input.accountId,
    opportunity_id: input.opportunityId,
    author_admin_user_id: null,
    body_redacted: `Free audit captured ${input.modelFit} fit for ${input.provider}/${input.modelId}; prompt remains ${input.redactedPromptPreview}.`,
    redaction_state: "redacted",
    metadata: {
      source: "free_audit",
      cta_clicked: input.ctaClicked
    },
    is_mock: true,
    created_at: input.timestamp
  };
  const task: CrmTask = {
    id: createId("task"),
    account_id: input.accountId,
    opportunity_id: input.opportunityId,
    assignee_admin_user_id: null,
    title: getFreeAuditTaskTitle(input.ctaClicked),
    status: "open",
    due_at: null,
    metadata: {
      source: "free_audit",
      cta_clicked: input.ctaClicked
    },
    is_mock: true,
    created_at: input.timestamp,
    updated_at: input.timestamp
  };

  await Promise.all([repository.crm_notes.create(note), repository.tasks.create(task)]);
}

function getFreeAuditTaskTitle(ctaClicked: FreeAudit["cta_clicked"]): string {
  switch (ctaClicked) {
    case "run_evals":
      return "Help lead run evals before switching";
    case "create_project":
      return "Help lead create a project from free audit";
    case "get_audit_report":
      return "Follow up on redacted audit report";
    case "preview":
      return "Review free audit preview signal";
  }
}

async function upsertFreeAuditAccount(
  repository: PromptOptsRepository,
  input: {
    provider: Account["provider_preference"];
    company: string | null;
    domain: string | null;
    redactedPromptPreview: string;
    timestamp: string;
  }
): Promise<Account> {
  const accounts = await repository.accounts.list();
  const existing = accounts.find((account) => {
    if (input.domain && account.domain === input.domain) {
      return true;
    }

    return input.company ? account.name.toLowerCase() === input.company.toLowerCase() : false;
  });

  if (existing) {
    return (
      (await repository.accounts.update(existing.id, {
        provider_preference: input.provider,
        redacted_prompt_preview: input.redactedPromptPreview,
        updated_at: input.timestamp
      })) ?? existing
    );
  }

  const account: Account = {
    id: createId("account"),
    name: input.company ?? input.domain ?? "Free audit lead",
    workspace_id: null,
    stage: "new_audit",
    provider_preference: input.provider,
    owner_admin_user_id: null,
    domain: input.domain,
    redacted_prompt_preview: input.redactedPromptPreview,
    is_mock: true,
    created_at: input.timestamp,
    updated_at: input.timestamp
  };

  await repository.accounts.create(account);

  return account;
}

async function upsertFreeAuditContact(
  repository: PromptOptsRepository,
  input: {
    accountId: string;
    email: string;
    company: string | null;
    timestamp: string;
  }
): Promise<Contact> {
  const existing = (await repository.contacts.list()).find((contact) => contact.email === input.email);
  const name = input.email.split("@")[0]?.replace(/[._-]+/g, " ") || input.company || "Free audit contact";

  if (existing) {
    return (
      (await repository.contacts.update(existing.id, {
        account_id: input.accountId,
        updated_at: input.timestamp
      })) ?? existing
    );
  }

  const contact: Contact = {
    id: createId("contact"),
    account_id: input.accountId,
    name,
    email: input.email,
    role: null,
    is_mock: true,
    created_at: input.timestamp,
    updated_at: input.timestamp
  };

  await repository.contacts.create(contact);

  return contact;
}

async function upsertFreeAuditOpportunity(
  repository: PromptOptsRepository,
  input: {
    accountId: string;
    provider: Opportunity["provider"];
    modelId: string;
    taskType: NonNullable<Opportunity["use_case"]>;
    monthlyCalls: number;
    modelFit: NonNullable<Opportunity["fit_signal"]>;
    savingsOpportunityUsd: number | null;
    ctaClicked: NonNullable<Opportunity["cta_clicked"]>;
    timestamp: string;
  }
): Promise<Opportunity> {
  const opportunities = await repository.opportunities.list();
  const existing = opportunities.find(
    (opportunity) =>
      opportunity.account_id === input.accountId &&
      opportunity.provider === input.provider &&
      opportunity.current_model_id === input.modelId &&
      opportunity.use_case === input.taskType
  );
  const patch = {
    stage: stageForFreeAuditCta(input.ctaClicked),
    current_model: input.modelId,
    fit_signal: input.modelFit,
    estimated_monthly_calls: Math.round(input.monthlyCalls),
    estimated_volume: Math.round(input.monthlyCalls),
    savings_opportunity_usd: input.savingsOpportunityUsd,
    estimated_savings: input.savingsOpportunityUsd,
    use_case: input.taskType,
    cta_clicked: input.ctaClicked,
    eval_readiness: input.ctaClicked === "run_evals" ? "eval_ready" : "needs_tests",
    updated_at: input.timestamp
  } satisfies Partial<Omit<Opportunity, "id">>;

  if (existing) {
    return (await repository.opportunities.update(existing.id, patch)) ?? existing;
  }

  const opportunity: Opportunity = {
    id: createId("opportunity"),
    account_id: input.accountId,
    project_id: null,
    provider: input.provider,
    current_model_id: input.modelId,
    ...patch,
    is_mock: true,
    created_at: input.timestamp
  };

  await repository.opportunities.create(opportunity);

  return opportunity;
}

function stageForFreeAuditCta(ctaClicked: FreeAudit["cta_clicked"]): Opportunity["stage"] {
  switch (ctaClicked) {
    case "run_evals":
      return "eval_ready";
    case "create_project":
      return "evaluating";
    case "get_audit_report":
    case "preview":
      return "new";
  }
}

function inferLeadDomain(email: string | null, company: string | null): string | null {
  const emailDomain = email?.split("@")[1]?.toLowerCase();

  if (emailDomain) {
    return emailDomain;
  }

  const normalizedCompany = company?.trim().toLowerCase();

  if (normalizedCompany && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(normalizedCompany)) {
    return normalizedCompany;
  }

  return null;
}

function redactShareablePromptPreview(prompt: string): string {
  return `Prompt redacted (${prompt.replace(/\s+/g, " ").trim().length} chars)`;
}

function createShareableFreeAuditSummary(input: {
  provider: FreeAudit["provider"];
  modelId: string;
  modelFit: FreeAudit["model_fit"];
  ctaClicked: FreeAudit["cta_clicked"];
}): string {
  return [
    `Redacted free audit for ${input.provider}/${input.modelId}.`,
    `Model fit: ${input.modelFit}.`,
    "Savings opportunity is unverified until registry metadata and eval results pass.",
    "Run evals before switching."
  ].join(" ");
}


export { createFreeAuditCapture };
