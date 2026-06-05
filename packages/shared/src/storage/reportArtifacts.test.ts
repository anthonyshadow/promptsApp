import { describe, expect, test } from "bun:test";
import { createMemoryReportArtifactStorage } from "./reportArtifacts";

describe("report artifact storage", () => {
  test("stores redacted report artifacts behind a swappable abstraction", async () => {
    const storage = createMemoryReportArtifactStorage();
    const artifact = await storage.put({
      reportId: "report_test",
      artifactId: "artifact_markdown",
      format: "markdown",
      content: "# Redacted PromptOpts report",
      redactionState: "redacted",
      createdAt: "2026-01-15T12:00:00.000Z"
    });

    expect(artifact.storage_uri).toBe("memory://reports/report_test/artifact_markdown.markdown");
    expect(artifact.content_type).toBe("text/markdown");
    expect(artifact.redaction_state).toBe("redacted");
    expect(artifact.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(artifact.size_bytes).toBeGreaterThan(0);
    expect(await storage.get(artifact.storage_uri)).toEqual(artifact);
  });

  test("represents artifact deletion without exposing deleted content by default", async () => {
    const storage = createMemoryReportArtifactStorage();
    const artifact = await storage.put({
      reportId: "report_test",
      artifactId: "artifact_json",
      format: "json",
      content: "{\"redacted\":true}"
    });

    await expect(
      storage.delete(artifact.storage_uri, {
        reasonCode: "user_requested_delete",
        deletedAt: "2026-01-16T12:00:00.000Z"
      })
    ).resolves.toEqual({
      storage_uri: artifact.storage_uri,
      deleted_at: "2026-01-16T12:00:00.000Z",
      reason_code: "user_requested_delete",
      storage_delete_status: "deleted"
    });

    expect(await storage.get(artifact.storage_uri)).toBeUndefined();
    expect(await storage.get(artifact.storage_uri, { includeDeleted: true })).toMatchObject({
      storage_uri: artifact.storage_uri,
      deleted_at: "2026-01-16T12:00:00.000Z"
    });
  });
});

