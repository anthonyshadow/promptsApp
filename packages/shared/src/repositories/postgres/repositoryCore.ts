import type { ZodObject, ZodRawShape } from "zod";
import {
  accountSchema,
  adminAuditLogSchema,
  adminRoleRecordSchema,
  adminSessionRecordSchema,
  adminUserRecordSchema,
  billingEventSchema,
  contactSchema,
  creditSchema,
  crmNoteSchema,
  deletionRequestSchema,
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
  providerConnectionSchema,
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
  type AdminRoleRecord,
  type AdminSessionRecord,
  type AdminUserRecord,
  type BillingEvent,
  type Contact,
  type Credit,
  type CrmNote,
  type CrmTask,
  type DeletionRequest,
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
  type ProviderConnection,
  type QualityContract,
  type RecommendationReport,
  type ReportArtifact,
  type TestCase,
  type UsageLedgerEntry,
  type User,
  type Workspace,
  sudoRequestSchema,
  type SudoRequest
} from "../../schemas";
import type {
  AppendOnlyRepository,
  CrudRepository,
  IdentifiedRecord,
  PromptOptsRepository
} from "../types";
import {
  quoteIdentifier,
  requireDatabaseUrl,
  runPsql,
  sqlJsonLiteral,
  sqlTextLiteral,
  type PsqlExecutorOptions
} from "./psql";

type PlainRecord = Record<string, unknown>;

type CollectionConfig<TRecord extends IdentifiedRecord> = {
  tableName: string;
  schema: ZodObject<ZodRawShape>;
  toDb?: (record: PlainRecord) => PlainRecord;
  fromDb?: (record: PlainRecord) => PlainRecord;
};

type PostgresRepositoryOptions = {
  databaseUrl?: string;
  psqlPath?: string;
};

function normalizeTimestampStrings(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeTimestampStrings);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, normalizeTimestampStrings(nested)])
    );
  }

  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}:\d{2}$/.test(value)
  ) {
    return new Date(value).toISOString();
  }

  return value;
}

function shapeKeys(schema: ZodObject<ZodRawShape>): string[] {
  return Object.keys(schema.shape);
}

function stripToSchema(record: PlainRecord, schema: ZodObject<ZodRawShape>): PlainRecord {
  const allowed = new Set(shapeKeys(schema));

  return Object.fromEntries(
    Object.entries(record).filter(([key]) => allowed.has(key))
  );
}

function toDbRecord(record: PlainRecord, config: CollectionConfig<IdentifiedRecord>): PlainRecord {
  const transformed = config.toDb ? config.toDb(record) : record;
  return transformed;
}

function fromDbRecord<TRecord extends IdentifiedRecord>(
  record: PlainRecord,
  config: CollectionConfig<TRecord>
): TRecord {
  const normalized = normalizeTimestampStrings(record) as PlainRecord;
  const transformed = config.fromDb ? config.fromDb(normalized) : normalized;
  return config.schema.parse(stripToSchema(transformed, config.schema)) as TRecord;
}

function buildJsonSelect(alias: string): string {
  return `to_jsonb(${alias})::text`;
}

function parseSingleJsonResult<TRecord extends IdentifiedRecord>(
  stdout: string,
  config: CollectionConfig<TRecord>
): TRecord | undefined {
  const json = extractJsonLine(stdout);

  if (!json || json === "null") {
    return undefined;
  }

  return fromDbRecord(JSON.parse(json) as PlainRecord, config);
}

function parseListJsonResult<TRecord extends IdentifiedRecord>(
  stdout: string,
  config: CollectionConfig<TRecord>
): TRecord[] {
  const json = extractJsonLine(stdout);

  if (!json) {
    return [];
  }

  const records = JSON.parse(json) as PlainRecord[];
  return records.map((record) => fromDbRecord(record, config));
}

function extractJsonLine(stdout: string): string {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{") || line.startsWith("[") || line === "null")
    .at(-1) ?? "";
}

function columnsFor(record: PlainRecord): string[] {
  return Object.keys(record).filter((key) => record[key] !== undefined);
}

class PostgresCrudRepository<TRecord extends IdentifiedRecord>
  implements CrudRepository<TRecord>
{
  constructor(
    private readonly config: CollectionConfig<TRecord>,
    private readonly executorOptions: PsqlExecutorOptions
  ) {}

  async list(): Promise<TRecord[]> {
    const table = quoteIdentifier(this.config.tableName);
    const sql = `
      SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text
      FROM ${table} AS t;
    `;

    return parseListJsonResult(await runPsql(sql, this.executorOptions), this.config);
  }

  async get(id: string): Promise<TRecord | undefined> {
    const table = quoteIdentifier(this.config.tableName);
    const sql = `
      SELECT ${buildJsonSelect("t")}
      FROM ${table} AS t
      WHERE t.id = ${sqlTextLiteral(id)}
      LIMIT 1;
    `;

    return parseSingleJsonResult(await runPsql(sql, this.executorOptions), this.config);
  }

  async create(record: TRecord): Promise<TRecord> {
    const parsed = this.config.schema.parse(record) as TRecord;
    const dbRecord = toDbRecord(parsed as PlainRecord, this.config);
    const columns = columnsFor(dbRecord);
    const table = quoteIdentifier(this.config.tableName);
    const columnSql = columns.map(quoteIdentifier).join(", ");
    const incomingSql = columns.map((column) => `incoming.${quoteIdentifier(column)}`).join(", ");
    const sql = `
      WITH incoming AS (
        SELECT *
        FROM jsonb_populate_record(NULL::${table}, ${sqlJsonLiteral(dbRecord)})
      )
      INSERT INTO ${table} (${columnSql})
      SELECT ${incomingSql}
      FROM incoming
      RETURNING ${buildJsonSelect(this.config.tableName)};
    `;

    const created = parseSingleJsonResult(await runPsql(sql, this.executorOptions), this.config);

    if (!created) {
      throw new Error(`Postgres create returned no record for ${this.config.tableName}`);
    }

    return created;
  }

  async update(id: string, patch: Partial<Omit<TRecord, "id">>): Promise<TRecord | undefined> {
    const dbPatch = toDbRecord(patch as PlainRecord, this.config);
    const columns = columnsFor(dbPatch).filter((column) => column !== "id");

    if (columns.length === 0) {
      return this.get(id);
    }

    const table = quoteIdentifier(this.config.tableName);
    const setSql = columns
      .map((column) => `${quoteIdentifier(column)} = incoming.${quoteIdentifier(column)}`)
      .join(", ");
    const sql = `
      WITH incoming AS (
        SELECT *
        FROM jsonb_populate_record(NULL::${table}, ${sqlJsonLiteral(dbPatch)})
      )
      UPDATE ${table} AS target
      SET ${setSql}
      FROM incoming
      WHERE target.id = ${sqlTextLiteral(id)}
      RETURNING ${buildJsonSelect("target")};
    `;

    return parseSingleJsonResult(await runPsql(sql, this.executorOptions), this.config);
  }

  async delete(id: string): Promise<boolean> {
    const table = quoteIdentifier(this.config.tableName);
    const sql = `
      DELETE FROM ${table}
      WHERE id = ${sqlTextLiteral(id)}
      RETURNING id;
    `;

    return Boolean(await runPsql(sql, this.executorOptions));
  }
}

class PostgresAppendOnlyRepository<TRecord extends IdentifiedRecord>
  implements AppendOnlyRepository<TRecord>
{
  private readonly delegate: PostgresCrudRepository<TRecord>;

  constructor(
    config: CollectionConfig<TRecord>,
    executorOptions: PsqlExecutorOptions
  ) {
    this.delegate = new PostgresCrudRepository(config, executorOptions);
  }

  async list(): Promise<TRecord[]> {
    return this.delegate.list();
  }

  async get(id: string): Promise<TRecord | undefined> {
    return this.delegate.get(id);
  }

  async append(record: TRecord): Promise<TRecord> {
    return this.delegate.create(record);
  }
}

function entitlementToDb(record: PlainRecord): PlainRecord {
  const { limit, ...rest } = record;
  return {
    ...rest,
    limit_value: limit
  };
}

function entitlementFromDb(record: PlainRecord): PlainRecord {
  const { limit_value, ...rest } = record;
  return {
    ...rest,
    limit: limit_value
  };
}

function opportunityToDb(record: PlainRecord): PlainRecord {
  const {
    current_model,
    estimated_volume,
    estimated_savings,
    ...rest
  } = record;

  return {
    ...rest,
    current_model_id: rest.current_model_id ?? current_model,
    estimated_monthly_calls: rest.estimated_monthly_calls ?? estimated_volume,
    savings_opportunity_usd: rest.savings_opportunity_usd ?? estimated_savings
  };
}

function opportunityFromDb(record: PlainRecord): PlainRecord {
  return {
    ...record,
    current_model: record.current_model_id,
    estimated_volume: record.estimated_monthly_calls,
    estimated_savings: record.savings_opportunity_usd
  };
}

function providerConnectionToDb(record: PlainRecord): PlainRecord {
  const {
    encrypted_key_blob,
    created_by,
    ...rest
  } = record;

  return {
    ...rest,
    encrypted_key_ciphertext: rest.encrypted_key_ciphertext ?? encrypted_key_blob,
    created_by_user_id: rest.created_by_user_id ?? created_by
  };
}

function providerConnectionFromDb(record: PlainRecord): PlainRecord {
  const {
    encrypted_key_ciphertext,
    created_by_user_id,
    ...rest
  } = record;

  return {
    ...rest,
    encrypted_key_blob: encrypted_key_ciphertext,
    created_by: created_by_user_id
  };
}

const configs = {
  users: { tableName: "users", schema: userSchema },
  workspaces: { tableName: "workspaces", schema: workspaceSchema },
  provider_connections: {
    tableName: "provider_keys",
    schema: providerConnectionSchema,
    toDb: providerConnectionToDb,
    fromDb: providerConnectionFromDb
  },
  projects: { tableName: "projects", schema: promptProjectSchema },
  prompts: { tableName: "prompts", schema: promptSchema },
  prompt_versions: { tableName: "prompt_versions", schema: promptVersionSchema },
  prompt_analyses: { tableName: "prompt_analyses", schema: promptAnalysisSchema },
  quality_contracts: { tableName: "quality_contracts", schema: qualityContractSchema },
  test_cases: { tableName: "test_cases", schema: testCaseSchema },
  eval_runs: { tableName: "eval_runs", schema: evalRunSchema },
  eval_results: { tableName: "eval_results", schema: evalResultSchema },
  optimization_candidates: {
    tableName: "optimization_candidates",
    schema: optimizationCandidateSchema
  },
  reports: { tableName: "reports", schema: recommendationReportSchema },
  report_artifacts: { tableName: "report_artifacts", schema: reportArtifactSchema },
  deletion_requests: { tableName: "deletion_requests", schema: deletionRequestSchema },
  model_registry: { tableName: "model_registry", schema: modelRegistryRecordSchema },
  model_registry_versions: {
    tableName: "model_registry_versions",
    schema: modelRegistryVersionSchema
  },
  free_audits: { tableName: "free_audits", schema: freeAuditSchema },
  accounts: { tableName: "accounts", schema: accountSchema },
  contacts: { tableName: "contacts", schema: contactSchema },
  opportunities: {
    tableName: "opportunities",
    schema: opportunitySchema,
    toDb: opportunityToDb,
    fromDb: opportunityFromDb
  },
  crm_notes: { tableName: "crm_notes", schema: crmNoteSchema },
  tasks: { tableName: "tasks", schema: taskSchema },
  admin_audit_logs: { tableName: "admin_audit_logs", schema: adminAuditLogSchema },
  entitlements: {
    tableName: "entitlements",
    schema: entitlementSchema,
    toDb: entitlementToDb,
    fromDb: entitlementFromDb
  },
  usage_ledger: { tableName: "usage_ledger", schema: usageLedgerEntrySchema },
  plans: { tableName: "plans", schema: planSchema },
  billing_events: { tableName: "billing_events", schema: billingEventSchema },
  invoices: { tableName: "invoices", schema: invoiceSchema },
  credits: { tableName: "credits", schema: creditSchema },
  feature_flags: { tableName: "feature_flags", schema: featureFlagSchema },
  admin_roles: { tableName: "admin_roles", schema: adminRoleRecordSchema },
  admin_users: { tableName: "admin_users", schema: adminUserRecordSchema },
  admin_sessions: { tableName: "admin_sessions", schema: adminSessionRecordSchema },
  sudo_requests: { tableName: "sudo_requests", schema: sudoRequestSchema }
} satisfies Record<string, CollectionConfig<IdentifiedRecord>>;

export function createPostgresRepository(options: PostgresRepositoryOptions = {}): PromptOptsRepository {
  const executorOptions: PsqlExecutorOptions = {
    databaseUrl: requireDatabaseUrl(options.databaseUrl)
  };

  if (options.psqlPath) {
    executorOptions.psqlPath = options.psqlPath;
  }

  return {
    backend: "postgres",
    users: new PostgresCrudRepository<User>(configs.users, executorOptions),
    workspaces: new PostgresCrudRepository<Workspace>(configs.workspaces, executorOptions),
    provider_connections: new PostgresCrudRepository<ProviderConnection>(
      configs.provider_connections,
      executorOptions
    ),
    projects: new PostgresCrudRepository<PromptProject>(configs.projects, executorOptions),
    prompts: new PostgresCrudRepository<Prompt>(configs.prompts, executorOptions),
    prompt_versions: new PostgresCrudRepository<PromptVersion>(
      configs.prompt_versions,
      executorOptions
    ),
    prompt_analyses: new PostgresCrudRepository<PromptAnalysis>(
      configs.prompt_analyses,
      executorOptions
    ),
    quality_contracts: new PostgresCrudRepository<QualityContract>(
      configs.quality_contracts,
      executorOptions
    ),
    test_cases: new PostgresCrudRepository<TestCase>(configs.test_cases, executorOptions),
    eval_runs: new PostgresCrudRepository<EvalRun>(configs.eval_runs, executorOptions),
    eval_results: new PostgresCrudRepository<EvalResult>(configs.eval_results, executorOptions),
    optimization_candidates: new PostgresCrudRepository<OptimizationCandidate>(
      configs.optimization_candidates,
      executorOptions
    ),
    reports: new PostgresCrudRepository<RecommendationReport>(configs.reports, executorOptions),
    report_artifacts: new PostgresCrudRepository<ReportArtifact>(
      configs.report_artifacts,
      executorOptions
    ),
    deletion_requests: new PostgresCrudRepository<DeletionRequest>(
      configs.deletion_requests,
      executorOptions
    ),
    model_registry: new PostgresCrudRepository<ModelRegistryRecord>(
      configs.model_registry,
      executorOptions
    ),
    model_registry_versions: new PostgresCrudRepository<ModelRegistryVersion>(
      configs.model_registry_versions,
      executorOptions
    ),
    free_audits: new PostgresCrudRepository<FreeAudit>(configs.free_audits, executorOptions),
    accounts: new PostgresCrudRepository<Account>(configs.accounts, executorOptions),
    contacts: new PostgresCrudRepository<Contact>(configs.contacts, executorOptions),
    opportunities: new PostgresCrudRepository<Opportunity>(
      configs.opportunities,
      executorOptions
    ),
    crm_notes: new PostgresCrudRepository<CrmNote>(configs.crm_notes, executorOptions),
    tasks: new PostgresCrudRepository<CrmTask>(configs.tasks, executorOptions),
    admin_audit_logs: new PostgresAppendOnlyRepository<AdminAuditLog>(
      configs.admin_audit_logs,
      executorOptions
    ),
    entitlements: new PostgresCrudRepository<Entitlement>(
      configs.entitlements,
      executorOptions
    ),
    usage_ledger: new PostgresCrudRepository<UsageLedgerEntry>(
      configs.usage_ledger,
      executorOptions
    ),
    plans: new PostgresCrudRepository<Plan>(configs.plans, executorOptions),
    billing_events: new PostgresCrudRepository<BillingEvent>(
      configs.billing_events,
      executorOptions
    ),
    invoices: new PostgresCrudRepository<Invoice>(configs.invoices, executorOptions),
    credits: new PostgresCrudRepository<Credit>(configs.credits, executorOptions),
    feature_flags: new PostgresCrudRepository<FeatureFlag>(
      configs.feature_flags,
      executorOptions
    ),
    admin_roles: new PostgresCrudRepository<AdminRoleRecord>(
      configs.admin_roles,
      executorOptions
    ),
    admin_users: new PostgresCrudRepository<AdminUserRecord>(
      configs.admin_users,
      executorOptions
    ),
    admin_sessions: new PostgresCrudRepository<AdminSessionRecord>(
      configs.admin_sessions,
      executorOptions
    ),
    sudo_requests: new PostgresCrudRepository<SudoRequest>(
      configs.sudo_requests,
      executorOptions
    )
  };
}

export function createRepositoryFromEnv(): PromptOptsRepository {
  if (process.env.DATABASE_URL && process.env.PROMPTOPTS_REPOSITORY !== "memory") {
    return createPostgresRepository({ databaseUrl: process.env.DATABASE_URL });
  }

  throw new Error("createRepositoryFromEnv requires DATABASE_URL or explicit memory wiring.");
}

export function isPostgresRepository(repository: PromptOptsRepository): boolean {
  return repository.backend === "postgres";
}
