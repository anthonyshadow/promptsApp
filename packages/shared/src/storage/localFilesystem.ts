import {
  redactionStateSchema,
  reportArtifactFormatSchema,
  type RedactionState,
  type ReportArtifactFormat
} from "../schemas";
import type {
  DeleteReportArtifactOptions,
  DeleteReportArtifactResult,
  GetReportArtifactOptions,
  PutReportArtifactInput,
  ReportArtifactObjectMetadata,
  ReportArtifactStorage,
  ReportArtifactStorageObject
} from "./reportArtifacts";

type LocalFileSystemStorageOptions = {
  rootDir?: string;
};

export function createLocalFileSystemReportArtifactStorage(
  options: LocalFileSystemStorageOptions = {}
): ReportArtifactStorage {
  return new LocalFileSystemReportArtifactStorage(
    options.rootDir ?? process.env.PROMPTOPTS_REPORT_STORAGE_DIR ?? ".promptopts-storage/report-artifacts"
  );
}

class LocalFileSystemReportArtifactStorage implements ReportArtifactStorage {
  constructor(private readonly rootDir: string) {}

  async put(input: PutReportArtifactInput): Promise<ReportArtifactStorageObject> {
    return this.putObject(input);
  }

  async putObject(input: PutReportArtifactInput): Promise<ReportArtifactStorageObject> {
    const fs = await import("node:fs/promises");
    const format = reportArtifactFormatSchema.parse(input.format);
    const redactionState = redactionStateSchema.parse(input.redactionState ?? "redacted");
    const storageKey = createStorageKey(input.reportId, input.artifactId, format);
    const objectPath = await this.objectPath(storageKey);
    const metadataPath = await this.metadataPath(storageKey);
    const checksum = await this.calculateChecksum(input.content);
    const sizeBytes = new TextEncoder().encode(input.content).byteLength;
    const createdAt = input.createdAt ?? new Date().toISOString();
    const object: ReportArtifactStorageObject = {
      storage_uri: createStorageUri(storageKey),
      storage_key: storageKey,
      report_id: input.reportId,
      format,
      content_type: input.contentType ?? defaultContentTypeForFormat(format),
      content: input.content,
      checksum,
      etag: checksum,
      size_bytes: sizeBytes,
      redaction_state: redactionState,
      created_at: createdAt,
      deleted_at: null
    };

    await fs.mkdir(await dirname(objectPath), { recursive: true });
    await fs.writeFile(objectPath, input.content, "utf8");
    await fs.writeFile(metadataPath, JSON.stringify(stripContent(object), null, 2), "utf8");

    return object;
  }

  async get(
    storageKeyOrUri: string,
    options: GetReportArtifactOptions = {}
  ): Promise<ReportArtifactStorageObject | undefined> {
    return this.getObject(storageKeyOrUri, options);
  }

  async getObject(
    storageKeyOrUri: string,
    options: GetReportArtifactOptions = {}
  ): Promise<ReportArtifactStorageObject | undefined> {
    const fs = await import("node:fs/promises");
    const metadata = await this.getObjectMetadata(storageKeyOrUri, options);
    if (!metadata) {
      return undefined;
    }

    let content = "";
    if (!metadata.deleted_at) {
      content = await fs.readFile(await this.objectPath(metadata.storage_key), "utf8").catch(() => "");
    }

    return {
      ...metadata,
      content
    };
  }

  async getObjectMetadata(
    storageKeyOrUri: string,
    options: GetReportArtifactOptions = {}
  ): Promise<ReportArtifactObjectMetadata | undefined> {
    const fs = await import("node:fs/promises");
    const storageKey = normalizeStorageKey(storageKeyOrUri);
    const metadata = await fs
      .readFile(await this.metadataPath(storageKey), "utf8")
      .then((value) => JSON.parse(value) as ReportArtifactObjectMetadata)
      .catch(() => undefined);

    if (!metadata || (metadata.deleted_at && !options.includeDeleted)) {
      return undefined;
    }

    return metadata;
  }

  async delete(
    storageKeyOrUri: string,
    options: DeleteReportArtifactOptions = {}
  ): Promise<DeleteReportArtifactResult | undefined> {
    return this.deleteObject(storageKeyOrUri, options);
  }

  async deleteObject(
    storageKeyOrUri: string,
    options: DeleteReportArtifactOptions = {}
  ): Promise<DeleteReportArtifactResult | undefined> {
    const fs = await import("node:fs/promises");
    const storageKey = normalizeStorageKey(storageKeyOrUri);
    const metadata = await this.getObjectMetadata(storageKey, { includeDeleted: true });
    if (!metadata) {
      return undefined;
    }

    const deletedAt = options.deletedAt ?? new Date().toISOString();
    await fs.unlink(await this.objectPath(storageKey)).catch((error: unknown) => {
      if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
        return;
      }

      throw error;
    });
    await fs.writeFile(
      await this.metadataPath(storageKey),
      JSON.stringify({ ...metadata, deleted_at: deletedAt }, null, 2),
      "utf8"
    );

    return {
      storage_uri: metadata.storage_uri,
      deleted_at: deletedAt,
      reason_code: options.reasonCode ?? "unspecified",
      storage_delete_status: "deleted"
    };
  }

  async list(options: GetReportArtifactOptions = {}): Promise<ReportArtifactStorageObject[]> {
    const metadataFiles = await this.listMetadataFiles(this.rootDir);
    const objects = await Promise.all(
      metadataFiles.map(async (metadataFile) => {
        const metadata = await this.readMetadataFile(metadataFile);
        return metadata ? this.getObject(metadata.storage_key, options) : undefined;
      })
    );

    return objects.filter((object): object is ReportArtifactStorageObject => Boolean(object));
  }

  async objectExists(storageKeyOrUri: string): Promise<boolean> {
    return Boolean(await this.getObjectMetadata(storageKeyOrUri));
  }

  async calculateChecksum(content: string): Promise<string> {
    const bytes = new TextEncoder().encode(content);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
  }

  private async objectPath(storageKeyOrUri: string): Promise<string> {
    const path = await import("node:path");
    const storageKey = normalizeStorageKey(storageKeyOrUri);
    const resolvedRoot = path.resolve(this.rootDir);
    const resolvedPath = path.resolve(resolvedRoot, storageKey);

    if (!resolvedPath.startsWith(`${resolvedRoot}${path.sep}`) && resolvedPath !== resolvedRoot) {
      throw new Error("Storage key escapes the configured root directory.");
    }

    return resolvedPath;
  }

  private async metadataPath(storageKeyOrUri: string): Promise<string> {
    return `${await this.objectPath(storageKeyOrUri)}.metadata.json`;
  }

  private async listMetadataFiles(rootDir: string): Promise<string[]> {
    const fs = await import("node:fs/promises");
    const entries = await fs.readdir(rootDir, { withFileTypes: true }).catch(() => []);
    const files = await Promise.all(
      entries.map(async (entry) => {
        const path = await import("node:path");
        const entryPath = path.join(rootDir, entry.name);
        if (entry.isDirectory()) {
          return this.listMetadataFiles(entryPath);
        }

        return entry.name.endsWith(".metadata.json") ? [entryPath] : [];
      })
    );

    return files.flat();
  }

  private async readMetadataFile(
    metadataFile: string
  ): Promise<ReportArtifactObjectMetadata | undefined> {
    const fs = await import("node:fs/promises");
    return fs
      .readFile(metadataFile, "utf8")
      .then((value) => JSON.parse(value) as ReportArtifactObjectMetadata)
      .catch(() => undefined);
  }
}

function createStorageKey(
  reportId: string,
  artifactId: string | undefined,
  format: ReportArtifactFormat
): string {
  const safeArtifactId = artifactId ?? crypto.randomUUID();
  return `reports/${encodeURIComponent(reportId)}/${encodeURIComponent(
    safeArtifactId
  )}.${format}`;
}

function createStorageUri(storageKey: string): string {
  return `local://${storageKey}`;
}

function normalizeStorageKey(storageKeyOrUri: string): string {
  return storageKeyOrUri.replace(/^local:\/\//u, "").replace(/^memory:\/\//u, "");
}

function defaultContentTypeForFormat(format: ReportArtifactFormat): string {
  if (format === "json") {
    return "application/json";
  }

  if (format === "pdf") {
    return "application/pdf";
  }

  return "text/markdown";
}

function stripContent(object: ReportArtifactStorageObject): ReportArtifactObjectMetadata {
  const { content: _content, ...metadata } = object;
  return metadata;
}

async function dirname(filePath: string): Promise<string> {
  const path = await import("node:path");
  return path.dirname(filePath);
}
