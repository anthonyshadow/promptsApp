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

async function resolvePromptVersionId(
  repository: PromptOptsRepository,
  promptText: string,
  requestedPromptVersionId: string | undefined
): Promise<string | null> {
  if (requestedPromptVersionId) {
    const requested = await repository.prompt_versions.get(requestedPromptVersionId);

    return requested?.id ?? null;
  }

  const matchingVersion = (await repository.prompt_versions.list()).find(
    (version) => version.prompt_text === promptText
  );

  return matchingVersion?.id ?? null;
}

async function checkWorkspaceEntitlement(
  repository: PromptOptsRepository,
  workspaceId: string,
  feature: Entitlement["feature"]
): Promise<{ allowed: true; entitlement: Entitlement | null } | { allowed: false; message: string }> {
  const entitlements = await repository.entitlements.list();
  const entitlement =
    entitlements.find((item) => item.workspace_id === workspaceId && item.feature === feature) ??
    getLegacyEntitlement(entitlements, workspaceId, feature);

  if (!entitlement) {
    return {
      allowed: false,
      message: `${feature} entitlement is not enabled for this workspace.`
    };
  }

  if (entitlement.used >= entitlement.limit) {
    return {
      allowed: false,
      message: `${feature} entitlement limit has been reached.`
    };
  }

  return {
    allowed: true,
    entitlement
  };
}

function getLegacyEntitlement(
  entitlements: Entitlement[],
  workspaceId: string,
  feature: Entitlement["feature"]
): Entitlement | null {
  if (feature === "hosted_eval_runs") {
    return entitlements.find((item) => item.workspace_id === workspaceId && item.feature === "eval_runs") ?? null;
  }

  return null;
}

async function writeUsageLedger(
  repository: PromptOptsRepository,
  input: {
    workspaceId: string;
    feature: UsageLedgerEntry["feature"];
    quantity: number;
    sourceType: string;
    sourceId: string;
    timestamp: string;
  }
): Promise<void> {
  const entry: UsageLedgerEntry = {
    id: createId("usage_ledger"),
    workspace_id: input.workspaceId,
    feature: input.feature,
    quantity: input.quantity,
    unit: unitForFeature(input.feature),
    direction: "debit",
    source_type: input.sourceType,
    source_id: input.sourceId,
    is_mock: true,
    created_at: input.timestamp
  };

  await repository.usage_ledger.create(entry);
  await incrementEntitlementUsage(repository, input.workspaceId, input.feature, input.quantity);
}

async function incrementEntitlementUsage(
  repository: PromptOptsRepository,
  workspaceId: string,
  feature: Entitlement["feature"],
  quantity: number
): Promise<void> {
  const entitlements = await repository.entitlements.list();
  const entitlement =
    entitlements.find((item) => item.workspace_id === workspaceId && item.feature === feature) ??
    getLegacyEntitlement(entitlements, workspaceId, feature);

  if (!entitlement) {
    return;
  }

  await repository.entitlements.update(entitlement.id, {
    used: entitlement.used + quantity
  });
}

function entitlementForbidden(c: Context<ApiEnv>, message: string): Response {
  return c.json(
    errorResponseSchema.parse({
      error: {
        code: "entitlement_required",
        message
      }
    }),
    403
  );
}

function publicError(
  c: Context<ApiEnv>,
  status: 400 | 409 | 500,
  code: string,
  message: string
): Response {
  return c.json(
    errorResponseSchema.parse({
      error: {
        code,
        message
      }
    }),
    status
  );
}

function toProviderConnectionMetadata(connection: ProviderConnection) {
  const { encrypted_key_blob: _encryptedKeyBlob, ...metadata } = connection;

  return metadata;
}

function readPublicRequestMetadata(c: Context<ApiEnv>) {
  return {
    ipAddress:
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("cf-connecting-ip") ??
      "127.0.0.1",
    userAgent: c.req.header("user-agent") ?? "PromptOpts public API"
  };
}

function tryPrepareProviderKey(apiKey: string):
  | {
      encrypted_key_blob: string;
      encryption_key_id: string;
      key_fingerprint: string;
    }
  | null {
  try {
    return {
      ...encryptSecret(apiKey),
      key_fingerprint: fingerprintSecret(apiKey)
    };
  } catch {
    return null;
  }
}

export { checkWorkspaceEntitlement, entitlementForbidden, publicError, readPublicRequestMetadata, resolvePromptVersionId, toProviderConnectionMetadata, tryPrepareProviderKey, writeUsageLedger };
