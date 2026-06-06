import type {
  Account,
  AdminAuditLog,
  AdminRoleRecord,
  AdminSessionRecord,
  AdminUserRecord,
  BillingEvent,
  Contact,
  Credit,
  CrmNote,
  CrmTask,
  Entitlement,
  EvalResult,
  EvalRun,
  FeatureFlag,
  FreeAudit,
  Invoice,
  ModelRegistryRecord,
  ModelRegistryVersion,
  OptimizationCandidate,
  Opportunity,
  Plan,
  Prompt,
  PromptAnalysis,
  PromptProject,
  PromptVersion,
  ProviderConnection,
  QualityContract,
  RecommendationReport,
  ReportArtifact,
  TestCase,
  UsageLedgerEntry,
  User,
  Workspace,
  SudoRequest
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
  provider_connections: ProviderConnection;
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
  model_registry_versions: ModelRegistryVersion;
  free_audits: FreeAudit;
  accounts: Account;
  contacts: Contact;
  opportunities: Opportunity;
  crm_notes: CrmNote;
  tasks: CrmTask;
  entitlements: Entitlement;
  usage_ledger: UsageLedgerEntry;
  plans: Plan;
  billing_events: BillingEvent;
  invoices: Invoice;
  credits: Credit;
  feature_flags: FeatureFlag;
  admin_roles: AdminRoleRecord;
  admin_users: AdminUserRecord;
  admin_sessions: AdminSessionRecord;
  sudo_requests: SudoRequest;
};

export type RepositorySeed = {
  [TCollection in keyof RepositoryCollections]?: RepositoryCollections[TCollection][];
} & {
  admin_audit_logs?: AdminAuditLog[];
};

export type RepositoryBackend = "memory" | "postgres";

export interface PromptOptsRepository {
  backend: RepositoryBackend;
  users: CrudRepository<User>;
  workspaces: CrudRepository<Workspace>;
  provider_connections: CrudRepository<ProviderConnection>;
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
  model_registry_versions: CrudRepository<ModelRegistryVersion>;
  free_audits: CrudRepository<FreeAudit>;
  accounts: CrudRepository<Account>;
  contacts: CrudRepository<Contact>;
  opportunities: CrudRepository<Opportunity>;
  crm_notes: CrudRepository<CrmNote>;
  tasks: CrudRepository<CrmTask>;
  admin_audit_logs: AppendOnlyRepository<AdminAuditLog>;
  entitlements: CrudRepository<Entitlement>;
  usage_ledger: CrudRepository<UsageLedgerEntry>;
  plans: CrudRepository<Plan>;
  billing_events: CrudRepository<BillingEvent>;
  invoices: CrudRepository<Invoice>;
  credits: CrudRepository<Credit>;
  feature_flags: CrudRepository<FeatureFlag>;
  admin_roles: CrudRepository<AdminRoleRecord>;
  admin_users: CrudRepository<AdminUserRecord>;
  admin_sessions: CrudRepository<AdminSessionRecord>;
  sudo_requests: CrudRepository<SudoRequest>;
}
