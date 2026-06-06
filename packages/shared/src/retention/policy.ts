export type RetentionPolicyRule = {
  data_class: string;
  default_retention: string;
  deletion_behavior: string;
  retained_metadata: string[];
  audit_requirement: string;
};

export const DEFAULT_RETENTION_POLICY: RetentionPolicyRule[] = [
  {
    data_class: "prompts",
    default_retention: "active until user deletion or workspace retention action",
    deletion_behavior: "tombstone prompt records and raw prompt versions; keep redacted metadata for auditability",
    retained_metadata: ["id", "workspace/project linkage", "redacted preview", "timestamps", "reason code"],
    audit_requirement: "deletion request, scoped tombstone, and completion events"
  },
  {
    data_class: "test_cases",
    default_retention: "active until project/report deletion scope requires tombstone",
    deletion_behavior: "delete or tombstone test input/output payloads while retaining counts and linkage",
    retained_metadata: ["id", "project linkage", "quality contract linkage", "timestamps"],
    audit_requirement: "scoped deletion event when affected by prompt/report deletion"
  },
  {
    data_class: "eval_results",
    default_retention: "retained with report snapshots unless deletion is requested",
    deletion_behavior: "tombstone raw output payloads and preserve aggregate verdict/cost-quality metadata",
    retained_metadata: ["id", "eval run linkage", "verdict", "score", "timestamps"],
    audit_requirement: "scoped deletion or retention decision event"
  },
  {
    data_class: "report_artifacts",
    default_retention: "active while report export is available",
    deletion_behavior: "delete object-storage content and keep checksum, size, deletion status, and tombstone metadata",
    retained_metadata: ["id", "report linkage", "format", "checksum", "size", "deletion status"],
    audit_requirement: "object delete started, deleted/failed, and retry events"
  },
  {
    data_class: "admin_audit_logs",
    default_retention: "append-only trust record",
    deletion_behavior: "never delete through product deletion workflows",
    retained_metadata: ["full append-only audit event"],
    audit_requirement: "append-only database trigger and no delete repository helper"
  },
  {
    data_class: "billing_events",
    default_retention: "retained for financial reconciliation",
    deletion_behavior: "retain billing metadata; do not store raw prompts or provider keys",
    retained_metadata: ["event id", "workspace", "amount", "currency", "external reference", "timestamps"],
    audit_requirement: "plan, credit, and limit changes are audited"
  }
];

export function getRetentionPolicyRule(dataClass: string): RetentionPolicyRule | undefined {
  return DEFAULT_RETENTION_POLICY.find((rule) => rule.data_class === dataClass);
}
