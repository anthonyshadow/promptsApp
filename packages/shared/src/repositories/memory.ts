import type { ZodType } from "zod";
import {
  accountSchema,
  adminAuditLogSchema,
  billingEventSchema,
  contactSchema,
  creditSchema,
  crmNoteSchema,
  entitlementSchema,
  evalResultSchema,
  evalRunSchema,
  featureFlagSchema,
  freeAuditSchema,
  invoiceSchema,
  modelRegistryRecordSchema,
  modelRegistryVersionSchema,
  optimizationCandidateSchema,
  opportunitySchema,
  planSchema,
  promptAnalysisSchema,
  promptProjectSchema,
  promptSchema,
  promptVersionSchema,
  qualityContractSchema,
  recommendationReportSchema,
  reportArtifactSchema,
  taskSchema,
  testCaseSchema,
  usageLedgerEntrySchema,
  userSchema,
  workspaceSchema,
  type Account,
  type AdminAuditLog,
  type BillingEvent,
  type Contact,
  type Credit,
  type CrmNote,
  type CrmTask,
  type Entitlement,
  type EvalResult,
  type EvalRun,
  type FeatureFlag,
  type FreeAudit,
  type Invoice,
  type ModelRegistryRecord,
  type ModelRegistryVersion,
  type OptimizationCandidate,
  type Opportunity,
  type Plan,
  type Prompt,
  type PromptAnalysis,
  type PromptProject,
  type PromptVersion,
  type QualityContract,
  type RecommendationReport,
  type ReportArtifact,
  type TestCase,
  type UsageLedgerEntry,
  type User,
  type Workspace
} from "../schemas";
import type {
  AppendOnlyRepository,
  CrudRepository,
  IdentifiedRecord,
  PromptOptsRepository,
  RepositorySeed
} from "./types";

export { DEMO_IDS, createDemoRepositorySeed } from "./seed";

function cloneRecord<TRecord>(record: TRecord): TRecord {
  return structuredClone(record);
}

class MemoryCrudRepository<TRecord extends IdentifiedRecord> implements CrudRepository<TRecord> {
  private readonly records = new Map<string, TRecord>();

  constructor(
    private readonly schema: ZodType<TRecord>,
    initialRecords: TRecord[] = []
  ) {
    for (const record of initialRecords) {
      const parsed = this.schema.parse(record);
      if (this.records.has(parsed.id)) {
        throw new Error(`Duplicate seed record id: ${parsed.id}`);
      }
      this.records.set(parsed.id, cloneRecord(parsed));
    }
  }

  async list(): Promise<TRecord[]> {
    return Array.from(this.records.values(), cloneRecord);
  }

  async get(id: string): Promise<TRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : undefined;
  }

  async create(record: TRecord): Promise<TRecord> {
    const parsed = this.schema.parse(record);
    if (this.records.has(parsed.id)) {
      throw new Error(`Record already exists: ${parsed.id}`);
    }
    this.records.set(parsed.id, cloneRecord(parsed));
    return cloneRecord(parsed);
  }

  async update(id: string, patch: Partial<Omit<TRecord, "id">>): Promise<TRecord | undefined> {
    const current = this.records.get(id);
    if (!current) {
      return undefined;
    }

    const next = this.schema.parse({ ...current, ...patch, id });
    this.records.set(id, cloneRecord(next));
    return cloneRecord(next);
  }

  async delete(id: string): Promise<boolean> {
    return this.records.delete(id);
  }
}

class MemoryAppendOnlyRepository<TRecord extends IdentifiedRecord>
  implements AppendOnlyRepository<TRecord>
{
  private readonly records = new Map<string, TRecord>();

  constructor(
    private readonly schema: ZodType<TRecord>,
    initialRecords: TRecord[] = []
  ) {
    for (const record of initialRecords) {
      const parsed = this.schema.parse(record);
      if (this.records.has(parsed.id)) {
        throw new Error(`Duplicate seed record id: ${parsed.id}`);
      }
      this.records.set(parsed.id, cloneRecord(parsed));
    }
  }

  async list(): Promise<TRecord[]> {
    return Array.from(this.records.values(), cloneRecord);
  }

  async get(id: string): Promise<TRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : undefined;
  }

  async append(record: TRecord): Promise<TRecord> {
    const parsed = this.schema.parse(record);
    if (this.records.has(parsed.id)) {
      throw new Error(`Audit log already exists: ${parsed.id}`);
    }
    this.records.set(parsed.id, cloneRecord(parsed));
    return cloneRecord(parsed);
  }
}

// Memory remains the swappable local/test adapter; durable code should depend on PromptOptsRepository, not this class.
export function createMemoryRepository(seed: RepositorySeed = {}): PromptOptsRepository {
  return {
    backend: "memory",
    users: new MemoryCrudRepository<User>(userSchema, seed.users),
    workspaces: new MemoryCrudRepository<Workspace>(workspaceSchema, seed.workspaces),
    projects: new MemoryCrudRepository<PromptProject>(promptProjectSchema, seed.projects),
    prompts: new MemoryCrudRepository<Prompt>(promptSchema, seed.prompts),
    prompt_versions: new MemoryCrudRepository<PromptVersion>(
      promptVersionSchema,
      seed.prompt_versions
    ),
    prompt_analyses: new MemoryCrudRepository<PromptAnalysis>(
      promptAnalysisSchema,
      seed.prompt_analyses
    ),
    quality_contracts: new MemoryCrudRepository<QualityContract>(
      qualityContractSchema,
      seed.quality_contracts
    ),
    test_cases: new MemoryCrudRepository<TestCase>(testCaseSchema, seed.test_cases),
    eval_runs: new MemoryCrudRepository<EvalRun>(evalRunSchema, seed.eval_runs),
    eval_results: new MemoryCrudRepository<EvalResult>(evalResultSchema, seed.eval_results),
    optimization_candidates: new MemoryCrudRepository<OptimizationCandidate>(
      optimizationCandidateSchema,
      seed.optimization_candidates
    ),
    reports: new MemoryCrudRepository<RecommendationReport>(
      recommendationReportSchema,
      seed.reports
    ),
    report_artifacts: new MemoryCrudRepository<ReportArtifact>(
      reportArtifactSchema,
      seed.report_artifacts
    ),
    model_registry: new MemoryCrudRepository<ModelRegistryRecord>(
      modelRegistryRecordSchema,
      seed.model_registry
    ),
    model_registry_versions: new MemoryCrudRepository<ModelRegistryVersion>(
      modelRegistryVersionSchema,
      seed.model_registry_versions
    ),
    free_audits: new MemoryCrudRepository<FreeAudit>(freeAuditSchema, seed.free_audits),
    accounts: new MemoryCrudRepository<Account>(accountSchema, seed.accounts),
    contacts: new MemoryCrudRepository<Contact>(contactSchema, seed.contacts),
    opportunities: new MemoryCrudRepository<Opportunity>(opportunitySchema, seed.opportunities),
    crm_notes: new MemoryCrudRepository<CrmNote>(crmNoteSchema, seed.crm_notes),
    tasks: new MemoryCrudRepository<CrmTask>(taskSchema, seed.tasks),
    admin_audit_logs: new MemoryAppendOnlyRepository<AdminAuditLog>(
      adminAuditLogSchema,
      seed.admin_audit_logs
    ),
    entitlements: new MemoryCrudRepository<Entitlement>(entitlementSchema, seed.entitlements),
    usage_ledger: new MemoryCrudRepository<UsageLedgerEntry>(
      usageLedgerEntrySchema,
      seed.usage_ledger
    ),
    plans: new MemoryCrudRepository<Plan>(planSchema, seed.plans),
    billing_events: new MemoryCrudRepository<BillingEvent>(
      billingEventSchema,
      seed.billing_events
    ),
    invoices: new MemoryCrudRepository<Invoice>(invoiceSchema, seed.invoices),
    credits: new MemoryCrudRepository<Credit>(creditSchema, seed.credits),
    feature_flags: new MemoryCrudRepository<FeatureFlag>(
      featureFlagSchema,
      seed.feature_flags
    )
  };
}
