import type {
  AuditConstraints,
  AuditRequest,
  CandidateStrategy,
  ModelFit,
  ModelRegistryRecord,
  MonthlyCostEstimate,
  Priority,
  Provider,
  RegistryFreshness,
  RiskLevel,
  SensitiveFinding,
  SuggestedModelRole,
  TaskType
} from "@promptopts/shared";

export type PromptParseResult = {
  detectedVariables: string[];
  repeatedInstructionFindings: string[];
  examplesDetected: boolean;
  constraintsDetected: string[];
  outputRequirements: string[];
  likelyTaskType: TaskType;
  approximateInputTokens: number;
  approximateOutputEstimate: number;
};

export type MonthlyCostInput = {
  inputTokens: number;
  outputTokens: number;
  monthlyCalls: number;
  modelRegistryRecord: ModelRegistryRecord | null;
};

export type ModelFitInput = {
  provider: Provider;
  modelId: string;
  modelRegistryRecord: ModelRegistryRecord | null;
  taskType: TaskType;
  priority: Priority;
  constraints: AuditConstraints;
  promptAnalysis: PromptParseResult;
};

export type ModelFitClassification = {
  fit: ModelFit;
  reasonCodes: string[];
};

export type PromptModelAuditInput = AuditRequest & {
  modelRegistryRecords: ModelRegistryRecord[];
};

export type PromptModelAuditResult = {
  inputTokens: number;
  estimatedOutputTokens: number;
  monthlyCostEstimate: MonthlyCostEstimate;
  promptAnalysis: PromptParseResult;
  sensitiveFindings: SensitiveFinding[];
  wasteFindings: string[];
  modelFit: ModelFit;
  modelFitReasons: string[];
  riskLevel: RiskLevel;
  compressionGuardrails: string[];
  suggestedModels: string[];
  suggestedModelRoles: SuggestedModelRole[];
  suggestedNextAction: string;
  registryFreshness: RegistryFreshness;
};

export type PromptCandidateGenerationInput = {
  id?: string;
  promptText: string;
  strategy?: CandidateStrategy;
  provider?: Provider;
  modelId?: string;
  preservedConstraints?: string[];
  requiredOutput?: string | null;
  outputRequirements?: string[];
};

export type GeneratedPromptCandidate = {
  id: string;
  label: string;
  strategy: CandidateStrategy;
  promptText: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  riskLabel: RiskLevel;
  rationale: string;
  preservedConstraints: string[];
  removedOrCompressedElements: string[];
};
