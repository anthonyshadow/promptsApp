import {
  APP_NAME,
  type EvalResult,
  type EvalRun,
  type PromptOptsRepository,
  type PromptProject,
  type RecommendationReport,
  type ReportArtifact,
  type ReportArtifactStorage
} from "@promptopts/shared";
import type { RecommendationDecision } from "@promptopts/eval-core";

export type ReportArtifactContent = {
  format: ReportArtifact["format"];
  filename: string;
  content_type: string;
  content: string;
  redaction_state: ReportArtifact["redaction_state"];
};

export type ReportEvalSnapshot = {
  eval_run_id: string;
  status: EvalRun["status"];
  pass_threshold: number;
  captured_at: string;
  result_count: number;
  results: Array<{
    id: string;
    candidate_id: string;
    model_id: string;
    quality_score: number;
    pass_rate: number;
    estimated_cost_usd: number | null;
    cost_estimate_status: EvalResult["cost_estimate_status"];
    latency_ms: number | null;
    risk_level: EvalResult["risk_level"];
    verdict: EvalResult["verdict"];
    failed_check_ids: string[];
    must_pass_failures: number;
  }>;
};

export type RedactedSharePackage = {
  report_id: string;
  redaction_state: "redacted";
  summary: string;
  recommended_result_id: string | null;
  cheaper_alternative_result_id: string | null;
  stronger_fallback_result_id: string | null;
  artifact_formats: ReportArtifact["format"][];
  implementation_notes: string[];
  eval_snapshot: ReportEvalSnapshot;
};

export type GeneratedReportPackage = {
  artifacts: ReportArtifact[];
  contents: ReportArtifactContent[];
  redacted_share_package: RedactedSharePackage;
  eval_snapshot: ReportEvalSnapshot;
};

export type GenerateReportArtifactsInput = {
  report: RecommendationReport;
  evalRun: EvalRun;
  results: EvalResult[];
  decision: RecommendationDecision;
  generatedAt?: string;
};

export type PersistGeneratedReportArtifactsInput = {
  repository: PromptOptsRepository;
  storage: ReportArtifactStorage;
  report: RecommendationReport;
  project: PromptProject;
  generated: GeneratedReportPackage;
  reasonCode?: string;
  createdAt?: string;
};

// Report generation snapshots eval results; regenerating exports must not mutate or rerun the underlying eval matrix.
export function generateReportArtifacts(input: GenerateReportArtifactsInput): GeneratedReportPackage {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const evalSnapshot = createEvalSnapshot(input.evalRun, input.results, generatedAt);
  const jsonContent = createJsonExport(input, evalSnapshot);
  const markdownContent = createMarkdownExport(input, evalSnapshot);
  const pdfStubContent = createPdfStub(input, evalSnapshot);
  const contents: ReportArtifactContent[] = [
    createContent("markdown", `${input.report.id}.md`, "text/markdown", markdownContent),
    createContent("json", `${input.report.id}.json`, "application/json", jsonContent),
    createContent("pdf", `${input.report.id}.pdf`, "application/pdf", pdfStubContent)
  ];
  const artifacts = contents.map((content) => createArtifact(input.report.id, content, generatedAt));
  const redactedSharePackage: RedactedSharePackage = {
    report_id: input.report.id,
    redaction_state: "redacted",
    summary: createDecisionSummary(input.decision),
    recommended_result_id: input.decision.winnerResultId,
    cheaper_alternative_result_id: input.decision.cheaperAlternativeResultId,
    stronger_fallback_result_id: input.decision.strongerFallbackResultId,
    artifact_formats: artifacts.map((artifact) => artifact.format),
    implementation_notes: createImplementationNotes(input.report, input.decision),
    eval_snapshot: evalSnapshot
  };

  return {
    artifacts,
    contents,
    redacted_share_package: redactedSharePackage,
    eval_snapshot: evalSnapshot
  };
}

export async function persistGeneratedReportArtifacts(
  input: PersistGeneratedReportArtifactsInput
): Promise<ReportArtifact[]> {
  const timestamp = input.createdAt ?? new Date().toISOString();
  const existing = await input.repository.report_artifacts.list();
  const persisted: ReportArtifact[] = [];

  for (const content of input.generated.contents) {
    const existingArtifact = existing.find(
      (artifact) => artifact.report_id === input.report.id && artifact.format === content.format
    );
    const artifactId =
      existingArtifact?.id ?? `report_artifact_${sanitizeId(input.report.id)}_${content.format}`;
    const stored = await input.storage.putObject({
      reportId: input.report.id,
      artifactId,
      format: content.format,
      content: content.content,
      contentType: content.content_type,
      redactionState: content.redaction_state,
      createdAt: timestamp
    });
    const artifact: ReportArtifact = {
      id: artifactId,
      report_id: input.report.id,
      workspace_id: input.project.workspace_id,
      project_id: input.project.id,
      format: content.format,
      privacy_state: "ready_redacted",
      storage_key: stored.storage_key,
      storage_uri: stored.storage_uri,
      checksum: stored.checksum,
      size_bytes: stored.size_bytes,
      redaction_state: content.redaction_state,
      deleted_at: null,
      deletion_status: "active",
      deletion_attempts: 0,
      last_deletion_error: null,
      is_mock: input.report.is_mock,
      created_at: existingArtifact?.created_at ?? timestamp
    };

    if (existingArtifact) {
      const { id: _artifactId, ...artifactPatch } = artifact;
      const updated = await input.repository.report_artifacts.update(existingArtifact.id, artifactPatch);
      if (updated) {
        persisted.push(updated);
      }
    } else {
      persisted.push(await input.repository.report_artifacts.create(artifact));
    }
  }

  return persisted;
}

export function startReportGenerator() {
  console.log(`${APP_NAME} report-generator ready. Report jobs are generated on demand for the MVP.`);

  setInterval(() => {
    console.log(`${APP_NAME} report-generator idle`);
  }, 60_000);
}

if (import.meta.main) {
  startReportGenerator();
}

function createMarkdownExport(input: GenerateReportArtifactsInput, evalSnapshot: ReportEvalSnapshot): string {
  const { decision, report } = input;

  return [
    "# PromptOpts Recommendation Report",
    "",
    "## Recommended Setup",
    `- Winner result: ${decision.winnerResultId ?? "No switch recommended"}`,
    `- Cheaper alternative: ${decision.cheaperAlternativeResultId ?? "No passing cheaper alternative"}`,
    `- Stronger fallback: ${decision.strongerFallbackResultId ?? "No passing stronger fallback"}`,
    "",
    "## Risk Notes",
    ...listLines(decision.riskNotes),
    "",
    "## Quality And Performance",
    `- Production recommendation allowed: ${String(decision.productionRecommendationAllowed)}`,
    `- Pass threshold: ${Math.round(evalSnapshot.pass_threshold * 100)}%`,
    `- Rejected combos: ${decision.rejectedCombos.length}`,
    `- Registry freshness: ${report.registry_freshness}`,
    "",
    "## Savings Estimate",
    `- ${report.savings_summary ?? "No savings estimate is available."}`,
    "",
    "## Deployment Routing",
    "- Route production traffic only to the winner after final review.",
    "- Keep baseline available as rollback until live monitoring exists.",
    "- Use stronger fallback for escalations, ambiguity, or low confidence.",
    "",
    "## Developer Implementation Notes",
    ...listLines(createImplementationNotes(report, decision)),
    "",
    "## Eval Snapshot",
    `- Eval run: ${evalSnapshot.eval_run_id}`,
    `- Status: ${evalSnapshot.status}`,
    `- Rows captured: ${evalSnapshot.result_count}`
  ].join("\n");
}

function createJsonExport(input: GenerateReportArtifactsInput, evalSnapshot: ReportEvalSnapshot): string {
  return JSON.stringify(
    {
      report: input.report,
      decision: input.decision,
      eval_snapshot: evalSnapshot,
      implementation_notes: createImplementationNotes(input.report, input.decision),
      redaction_state: "redacted"
    },
    null,
    2
  );
}

function createPdfStub(input: GenerateReportArtifactsInput, evalSnapshot: ReportEvalSnapshot): string {
  return [
    "%PDF-1.4",
    "% PromptOpts PDF export stub",
    `Report: ${input.report.id}`,
    `Winner: ${input.decision.winnerResultId ?? "No switch recommended"}`,
    `Eval snapshot: ${evalSnapshot.eval_run_id}`,
    "This MVP stub preserves the export slot without pretending PDF rendering is complete.",
    "%%EOF"
  ].join("\n");
}

// Eval snapshots are copied into exports so report regeneration is reproducible without mutating eval rows.
function createEvalSnapshot(evalRun: EvalRun, results: EvalResult[], capturedAt: string): ReportEvalSnapshot {
  return {
    eval_run_id: evalRun.id,
    status: evalRun.status,
    pass_threshold: evalRun.pass_threshold,
    captured_at: capturedAt,
    result_count: results.length,
    results: results.map((result) => ({
      id: result.id,
      candidate_id: result.candidate_id,
      model_id: result.model_id,
      quality_score: result.quality_score,
      pass_rate: result.pass_rate,
      estimated_cost_usd: result.estimated_cost_usd,
      cost_estimate_status: result.cost_estimate_status,
      latency_ms: result.latency_ms,
      risk_level: result.risk_level,
      verdict: result.verdict,
      failed_check_ids: result.failed_check_ids,
      must_pass_failures: result.must_pass_failures
    }))
  };
}

function createContent(
  format: ReportArtifact["format"],
  filename: string,
  contentType: string,
  content: string
): ReportArtifactContent {
  return {
    format,
    filename,
    content_type: contentType,
    content,
    redaction_state: "redacted"
  };
}

function createArtifact(reportId: string, content: ReportArtifactContent, createdAt: string): ReportArtifact {
  return {
    id: `report_artifact_${sanitizeId(reportId)}_${content.format}`,
    report_id: reportId,
    format: content.format,
    storage_uri: `memory://reports/${reportId}/${content.filename}`,
    checksum: createChecksum(content.content),
    size_bytes: new TextEncoder().encode(content.content).byteLength,
    redaction_state: content.redaction_state,
    is_mock: true,
    created_at: createdAt
  };
}

function createDecisionSummary(decision: RecommendationDecision): string {
  if (!decision.productionRecommendationAllowed) {
    return "No production switch is recommended until blockers are cleared.";
  }

  return `Winner ${decision.winnerResultId ?? "unknown"} passed eval gates; review risk notes before deployment.`;
}

function createImplementationNotes(
  report: RecommendationReport,
  decision: RecommendationDecision
): string[] {
  const notes = [
    "Use the winner as the default route only after eval gates are reviewed.",
    "Keep baseline routing available as rollback.",
    "Failed combos remain visible and must not receive production traffic."
  ];

  if (decision.strongerFallbackResultId) {
    notes.push("Route high-risk, ambiguous, or escalation traffic to the stronger fallback.");
  }

  if (report.registry_freshness !== "fresh") {
    notes.push("Verify model registry sources before publishing exact savings claims.");
  }

  return notes;
}

function listLines(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- None"];
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-z0-9_]+/giu, "_").toLowerCase();
}

function createChecksum(content: string): string {
  let hash = 0;

  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 31 + content.charCodeAt(index)) >>> 0;
  }

  return `mock-${hash.toString(16).padStart(8, "0")}`;
}
