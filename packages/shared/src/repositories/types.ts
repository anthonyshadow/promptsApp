import type {
  Account,
  AdminAuditLog,
  Contact,
  CrmNote,
  CrmTask,
  Entitlement,
  EvalResult,
  EvalRun,
  FreeAudit,
  ModelRegistryRecord,
  OptimizationCandidate,
  Opportunity,
  Prompt,
  PromptAnalysis,
  PromptProject,
  PromptVersion,
  QualityContract,
  RecommendationReport,
  ReportArtifact,
  TestCase,
  UsageLedgerEntry,
  User,
  Workspace
} from "../schemas";

export type IdentifiedRecord = {
  id: string;
};

export interface CrudRepository<TRecord extends IdentifiedRecord> {
  list(): Promise<TRecord[]>;
  get(id: string): Promise<TRecord | undefined>;
  create(record: TRecord): Promise<TRecord>;
  update(id: string, patch: Partial<Omit<TRecord, "id">>): Promise<TRecord | undefined>;
  delete(id: string): Promise<boolean>;
}

export interface AppendOnlyRepository<TRecord extends IdentifiedRecord> {
  list(): Promise<TRecord[]>;
  get(id: string): Promise<TRecord | undefined>;
  append(record: TRecord): Promise<TRecord>;
}

export type RepositoryCollections = {
  users: User;
  workspaces: Workspace;
  projects: PromptProject;
  prompts: Prompt;
  prompt_versions: PromptVersion;
  prompt_analyses: PromptAnalysis;
  quality_contracts: QualityContract;
  test_cases: TestCase;
  eval_runs: EvalRun;
  eval_results: EvalResult;
  optimization_candidates: OptimizationCandidate;
  reports: RecommendationReport;
  report_artifacts: ReportArtifact;
  model_registry: ModelRegistryRecord;
  free_audits: FreeAudit;
  accounts: Account;
  contacts: Contact;
  opportunities: Opportunity;
  crm_notes: CrmNote;
  tasks: CrmTask;
  entitlements: Entitlement;
  usage_ledger: UsageLedgerEntry;
};

export type RepositorySeed = {
  [TCollection in keyof RepositoryCollections]?: RepositoryCollections[TCollection][];
} & {
  admin_audit_logs?: AdminAuditLog[];
};

export interface PromptOptsRepository {
  users: CrudRepository<User>;
  workspaces: CrudRepository<Workspace>;
  projects: CrudRepository<PromptProject>;
  prompts: CrudRepository<Prompt>;
  prompt_versions: CrudRepository<PromptVersion>;
  prompt_analyses: CrudRepository<PromptAnalysis>;
  quality_contracts: CrudRepository<QualityContract>;
  test_cases: CrudRepository<TestCase>;
  eval_runs: CrudRepository<EvalRun>;
  eval_results: CrudRepository<EvalResult>;
  optimization_candidates: CrudRepository<OptimizationCandidate>;
  reports: CrudRepository<RecommendationReport>;
  report_artifacts: CrudRepository<ReportArtifact>;
  model_registry: CrudRepository<ModelRegistryRecord>;
  free_audits: CrudRepository<FreeAudit>;
  accounts: CrudRepository<Account>;
  contacts: CrudRepository<Contact>;
  opportunities: CrudRepository<Opportunity>;
  crm_notes: CrudRepository<CrmNote>;
  tasks: CrudRepository<CrmTask>;
  admin_audit_logs: AppendOnlyRepository<AdminAuditLog>;
  entitlements: CrudRepository<Entitlement>;
  usage_ledger: CrudRepository<UsageLedgerEntry>;
}
