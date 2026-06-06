import { describe, expect, test } from "bun:test";
import {
  createMemoryRepository,
  type ProviderConnection
} from "../index";
import {
  decryptSecretForUse,
  decryptSecretBlob,
  encryptSecret,
  fingerprintSecret
} from "./providerSecrets";

const cryptoOptions = {
  keyMaterial: "test-local-provider-key-material",
  keyId: "local:test"
};
const timestamp = "2026-06-06T12:00:00.000Z";

describe("provider secret encryption", () => {
  test("encrypts and decrypts an opaque provider key envelope", () => {
    const plaintext = "sk-live-secret-that-must-not-leak";
    const encrypted = encryptSecret(plaintext, cryptoOptions);
    const fingerprint = fingerprintSecret(plaintext, cryptoOptions);

    expect(encrypted.encrypted_key_blob.startsWith("\\x")).toBe(true);
    expect(encrypted.encrypted_key_blob).not.toContain(plaintext);
    expect(encrypted.encryption_key_id).toBe("local:test");
    expect(fingerprint.startsWith("fp_")).toBe(true);
    expect(fingerprint).not.toContain(plaintext);
    expect(decryptSecretBlob(encrypted.encrypted_key_blob, cryptoOptions)).toBe(plaintext);
  });

  test("decrypts only through controlled provider-use context and writes audit events", async () => {
    const repository = createMemoryRepository({
      workspaces: [
        {
          id: "workspace_secret_test",
          name: "Secret Test",
          slug: "secret-test",
          is_mock: true,
          created_at: timestamp,
          updated_at: timestamp
        }
      ]
    });
    const encrypted = encryptSecret("gemini-secret-value", cryptoOptions);
    const connection: ProviderConnection = {
      id: "provider_connection_secret_test",
      workspace_id: "workspace_secret_test",
      provider: "gemini",
      encrypted_key_blob: encrypted.encrypted_key_blob,
      encryption_key_id: encrypted.encryption_key_id,
      key_fingerprint: fingerprintSecret("gemini-secret-value", cryptoOptions),
      status: "active",
      created_by: null,
      rotated_at: null,
      revoked_at: null,
      last_used_at: null,
      metadata: {},
      is_mock: true,
      created_at: timestamp,
      updated_at: timestamp
    };

    await repository.provider_connections.create(connection);
    const plaintext = await decryptSecretForUse(connection.id, {
      repository,
      actorId: "system_eval_runner",
      reasonCode: "eval_provider_call",
      now: new Date(timestamp),
      crypto: cryptoOptions
    });
    const updated = await repository.provider_connections.get(connection.id);
    const auditLogs = await repository.admin_audit_logs.list();

    expect(plaintext).toBe("gemini-secret-value");
    expect(updated?.last_used_at).toBe(timestamp);
    expect(JSON.stringify(updated)).not.toContain("gemini-secret-value");
    expect(auditLogs.map((log) => log.action)).toContain("provider_key_used_for_eval");
    expect(JSON.stringify(auditLogs)).not.toContain("gemini-secret-value");
  });

  test("inactive provider connections reject decrypt and audit the failure", async () => {
    const repository = createMemoryRepository();

    await expect(
      decryptSecretForUse("missing_connection", {
        repository,
        actorId: "system_eval_runner",
        reasonCode: "eval_provider_call",
        now: new Date(timestamp),
        crypto: cryptoOptions
      })
    ).rejects.toThrow("Provider connection is not active.");

    const auditLogs = await repository.admin_audit_logs.list();

    expect(auditLogs.at(-1)?.action).toBe("provider_key_decrypt_failed");
  });
});
