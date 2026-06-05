import {
  redactionStateSchema,
  reportArtifactFormatSchema,
  type RedactionState,
  type ReportArtifactFormat
} from "../schemas";

export type ReportArtifactStorageObject = {
  storage_uri: string;
  report_id: string;
  format: ReportArtifactFormat;
  content_type: string;
  content: string;
  checksum: string;
  size_bytes: number;
  redaction_state: RedactionState;
  created_at: string;
  deleted_at: string | null;
};

export type PutReportArtifactInput = {
  reportId: string;
  artifactId?: string;
  format: ReportArtifactFormat;
  content: string;
  contentType?: string;
  redactionState?: RedactionState;
  createdAt?: string;
};

export type DeleteReportArtifactOptions = {
  reasonCode?: string;
  deletedAt?: string;
};

export type DeleteReportArtifactResult = {
  storage_uri: string;
  deleted_at: string;
  reason_code: string;
  storage_delete_status: "deleted";
};

export type GetReportArtifactOptions = {
  includeDeleted?: boolean;
};

export interface ReportArtifactStorage {
  put(input: PutReportArtifactInput): Promise<ReportArtifactStorageObject>;
  get(
    storageUri: string,
    options?: GetReportArtifactOptions
  ): Promise<ReportArtifactStorageObject | undefined>;
  delete(
    storageUri: string,
    options?: DeleteReportArtifactOptions
  ): Promise<DeleteReportArtifactResult | undefined>;
  list(options?: GetReportArtifactOptions): Promise<ReportArtifactStorageObject[]>;
}

export function createMemoryReportArtifactStorage(
  initialObjects: ReportArtifactStorageObject[] = []
): ReportArtifactStorage {
  return new MemoryReportArtifactStorage(initialObjects);
}

class MemoryReportArtifactStorage implements ReportArtifactStorage {
  private readonly objects = new Map<string, ReportArtifactStorageObject>();

  constructor(initialObjects: ReportArtifactStorageObject[]) {
    for (const object of initialObjects) {
      this.objects.set(object.storage_uri, cloneObject(object));
    }
  }

  async put(input: PutReportArtifactInput): Promise<ReportArtifactStorageObject> {
    const format = reportArtifactFormatSchema.parse(input.format);
    const redactionState = redactionStateSchema.parse(input.redactionState ?? "redacted");
    const storageUri = createStorageUri(input.reportId, input.artifactId, format);
    const checksum = await sha256Hex(input.content);
    const sizeBytes = new TextEncoder().encode(input.content).byteLength;
    const object: ReportArtifactStorageObject = {
      storage_uri: storageUri,
      report_id: input.reportId,
      format,
      content_type: input.contentType ?? defaultContentTypeForFormat(format),
      content: input.content,
      checksum,
      size_bytes: sizeBytes,
      redaction_state: redactionState,
      created_at: input.createdAt ?? new Date().toISOString(),
      deleted_at: null
    };

    this.objects.set(storageUri, cloneObject(object));
    return cloneObject(object);
  }

  async get(
    storageUri: string,
    options: GetReportArtifactOptions = {}
  ): Promise<ReportArtifactStorageObject | undefined> {
    const object = this.objects.get(storageUri);
    if (!object || (object.deleted_at && !options.includeDeleted)) {
      return undefined;
    }

    return cloneObject(object);
  }

  async delete(
    storageUri: string,
    options: DeleteReportArtifactOptions = {}
  ): Promise<DeleteReportArtifactResult | undefined> {
    const object = this.objects.get(storageUri);
    if (!object) {
      return undefined;
    }

    const deletedAt = options.deletedAt ?? new Date().toISOString();
    this.objects.set(storageUri, cloneObject({ ...object, deleted_at: deletedAt }));
    return {
      storage_uri: storageUri,
      deleted_at: deletedAt,
      reason_code: options.reasonCode ?? "unspecified",
      storage_delete_status: "deleted"
    };
  }

  async list(
    options: GetReportArtifactOptions = {}
  ): Promise<ReportArtifactStorageObject[]> {
    return Array.from(this.objects.values())
      .filter((object) => options.includeDeleted || !object.deleted_at)
      .map(cloneObject);
  }
}

function createStorageUri(
  reportId: string,
  artifactId: string | undefined,
  format: ReportArtifactFormat
): string {
  const safeArtifactId = artifactId ?? crypto.randomUUID();
  return `memory://reports/${encodeURIComponent(reportId)}/${encodeURIComponent(
    safeArtifactId
  )}.${format}`;
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

async function sha256Hex(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function cloneObject<TObject>(object: TObject): TObject {
  return structuredClone(object);
}

