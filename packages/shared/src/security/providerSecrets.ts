import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID
} from "node:crypto";
import type {
  AdminAuditLog,
  ProviderConnection
} from "../schemas";
import type { PromptOptsRepository } from "../repositories/types";

const LOCAL_SECRET_ENV_NAMES = [
  "PROMPTOPTS_SECRET_ENCRYPTION_KEY",
  "ENCRYPTION_KEY"
] as const;
const SECRET_ENVELOPE_VERSION = 1;

export type SecretCryptoOptions = {
  keyMaterial?: string;
  keyId?: string;
};

export type EncryptedSecret = {
  encrypted_key_blob: string;
  encryption_key_id: string;
};

export type ProviderSecretActionContext = {
  repository: PromptOptsRepository;
  actorId: string;
  reasonCode: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  now?: Date | undefined;
  crypto?: SecretCryptoOptions | undefined;
};

type SecretEnvelope = {
  v: typeof SECRET_ENVELOPE_VERSION;
  alg: "AES-256-GCM";
  kid: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

export function encryptSecret(
  plaintext: string,
  options: SecretCryptoOptions = {}
): EncryptedSecret {
  assertNonEmptySecret(plaintext);
  const key = resolveLocalSecretKey(options);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key.keyBytes, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);
  const envelope: SecretEnvelope = {
    v: SECRET_ENVELOPE_VERSION,
    alg: "AES-256-GCM",
    kid: key.keyId,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url")
  };

  return {
    encrypted_key_blob: jsonEnvelopeToBytea(envelope),
    encryption_key_id: key.keyId
  };
}

export function decryptSecretBlob(
  encryptedKeyBlob: string,
  options: SecretCryptoOptions = {}
): string {
  const key = resolveLocalSecretKey(options);
  const envelope = byteaToJsonEnvelope(encryptedKeyBlob);

  if (envelope.v !== SECRET_ENVELOPE_VERSION || envelope.alg !== "AES-256-GCM") {
    throw new Error("Unsupported provider secret envelope.");
  }

  if (envelope.kid !== key.keyId) {
    throw new Error("Provider secret key id does not match configured key.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key.keyBytes,
    Buffer.from(envelope.iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function fingerprintSecret(
  plaintext: string,
  options: SecretCryptoOptions = {}
): string {
  assertNonEmptySecret(plaintext);
  const key = resolveLocalSecretKey(options);

  return `fp_${createHmac("sha256", key.keyBytes)
    .update(plaintext)
    .digest("hex")
    .slice(0, 20)}`;
}

export async function decryptSecretForUse(
  connectionId: string,
  actionContext: ProviderSecretActionContext
): Promise<string> {
  const connection = await actionContext.repository.provider_connections.get(connectionId);

  if (!connection || connection.status !== "active" || connection.revoked_at) {
    await writeProviderKeyAuditEvent(actionContext.repository, {
      connection,
      action: "provider_key_decrypt_failed",
      actorId: actionContext.actorId,
      reasonCode: actionContext.reasonCode,
      ipAddress: actionContext.ipAddress,
      userAgent: actionContext.userAgent,
      now: actionContext.now,
      metadata: { reason: "missing_or_inactive_connection" }
    });
    throw new Error("Provider connection is not active.");
  }

  try {
    const plaintext = decryptSecretBlob(connection.encrypted_key_blob, actionContext.crypto);
    const usedAt = (actionContext.now ?? new Date()).toISOString();

    await actionContext.repository.provider_connections.update(connection.id, {
      last_used_at: usedAt,
      updated_at: usedAt
    });
    await writeProviderKeyAuditEvent(actionContext.repository, {
      connection: { ...connection, last_used_at: usedAt, updated_at: usedAt },
      action: "provider_key_used_for_eval",
      actorId: actionContext.actorId,
      reasonCode: actionContext.reasonCode,
      ipAddress: actionContext.ipAddress,
      userAgent: actionContext.userAgent,
      now: actionContext.now,
      metadata: { provider: connection.provider, workspace_id: connection.workspace_id }
    });

    return plaintext;
  } catch (error) {
    await writeProviderKeyAuditEvent(actionContext.repository, {
      connection,
      action: "provider_key_decrypt_failed",
      actorId: actionContext.actorId,
      reasonCode: actionContext.reasonCode,
      ipAddress: actionContext.ipAddress,
      userAgent: actionContext.userAgent,
      now: actionContext.now,
      metadata: { error: error instanceof Error ? error.message : "decrypt_failed" }
    });
    throw new Error("Provider key decrypt failed.");
  }
}

export async function writeProviderKeyAuditEvent(
  repository: PromptOptsRepository,
  input: {
    connection: ProviderConnection | null | undefined;
    action:
      | "provider_key_created"
      | "provider_key_rotated"
      | "provider_key_revoked"
      | "provider_key_used_for_eval"
      | "provider_key_decrypt_failed";
    actorId: string;
    reasonCode: string;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
    now?: Date | undefined;
    metadata?: Record<string, unknown> | undefined;
  }
): Promise<AdminAuditLog> {
  const timestamp = (input.now ?? new Date()).toISOString();
  const log: AdminAuditLog = {
    id: `admin_audit_log_${input.action}_${randomUUID().replaceAll("-", "")}`,
    admin_user_id: input.actorId,
    workspace_id: input.connection?.workspace_id ?? null,
    account_id: null,
    target_type: "provider_key",
    target_id: input.connection?.id ?? "unknown_provider_key",
    action: input.action,
    action_scope: "manage_workspace",
    reason_code: input.reasonCode,
    sudo_request_id: null,
    ip_address: input.ipAddress ?? "127.0.0.1",
    user_agent: input.userAgent ?? "PromptOpts provider key lifecycle",
    redaction_state: "redacted",
    metadata: {
      provider: input.connection?.provider ?? null,
      key_fingerprint: input.connection?.key_fingerprint ?? null,
      status: input.connection?.status ?? null,
      ...input.metadata
    },
    is_mock: false,
    created_at: timestamp
  };

  return repository.admin_audit_logs.append(log);
}

function resolveLocalSecretKey(options: SecretCryptoOptions): {
  keyBytes: Buffer;
  keyId: string;
} {
  const keyMaterial = options.keyMaterial ?? resolveEnvKeyMaterial();

  if (!keyMaterial) {
    throw new Error(
      "Provider-key encryption requires PROMPTOPTS_SECRET_ENCRYPTION_KEY outside test mode."
    );
  }

  const keyBytes = createHash("sha256").update(keyMaterial).digest();
  const keyId =
    options.keyId ??
    `local:${createHash("sha256").update(keyMaterial).digest("hex").slice(0, 12)}`;

  return { keyBytes, keyId };
}

function resolveEnvKeyMaterial(): string | undefined {
  for (const envName of LOCAL_SECRET_ENV_NAMES) {
    const value = process.env[envName];
    if (value) {
      return value;
    }
  }

  if (isTestRuntime()) {
    return "promptopts-test-provider-secret-key-material";
  }

  return undefined;
}

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || process.env.BUN_ENV === "test";
}

function assertNonEmptySecret(plaintext: string): void {
  if (!plaintext || plaintext.trim().length === 0) {
    throw new Error("Provider key cannot be empty.");
  }
}

function jsonEnvelopeToBytea(envelope: SecretEnvelope): string {
  return `\\x${Buffer.from(JSON.stringify(envelope), "utf8").toString("hex")}`;
}

function byteaToJsonEnvelope(encryptedKeyBlob: string): SecretEnvelope {
  const hex = encryptedKeyBlob.startsWith("\\x")
    ? encryptedKeyBlob.slice(2)
    : Buffer.from(encryptedKeyBlob, "base64").toString("hex");
  const parsed = JSON.parse(Buffer.from(hex, "hex").toString("utf8")) as SecretEnvelope;

  if (
    parsed &&
    parsed.v === SECRET_ENVELOPE_VERSION &&
    parsed.alg === "AES-256-GCM" &&
    typeof parsed.kid === "string" &&
    typeof parsed.iv === "string" &&
    typeof parsed.tag === "string" &&
    typeof parsed.ciphertext === "string"
  ) {
    return parsed;
  }

  throw new Error("Invalid provider secret envelope.");
}
