import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import AdminAuditLogsScreen from "./AdminAuditLogsScreen";
import AdminBillingScreen from "./AdminBillingScreen";
import AdminEvalJobsScreen from "./AdminEvalJobsScreen";
import AdminModelRegistryScreen from "./AdminModelRegistryScreen";
import AdminReportsVaultScreen from "./AdminReportsVaultScreen";

describe("admin ops screens", () => {
  test("renders eval job control with queue, worker health, detail, and actions", () => {
    const html = renderToString(<AdminEvalJobsScreen />);

    expect(html).toContain("Eval job control");
    expect(html).toContain("queued");
    expect(html).toContain("running");
    expect(html).toContain("failed");
    expect(html).toContain("retrying");
    expect(html).toContain("rate limited");
    expect(html).toContain("eval-runner");
    expect(html).toContain("provider-adapter");
    expect(html).toContain("scoring");
    expect(html).toContain("report-generator");
    expect(html).toContain("Sanitized payload");
    expect(html).toContain("Retry");
    expect(html).toContain("Cancel");
    expect(html).toContain("Regenerate report");
    expect(html).not.toContain("Classify the inbound support message");
    expect(html).not.toContain("{{customer_message}}");
    expect(html).not.toContain("sk-");
  });

  test("renders model registry admin with freshness, metadata table, and diff approval", () => {
    const html = renderToString(<AdminModelRegistryScreen />);

    expect(html).toContain("Model registry");
    expect(html).toContain("fresh");
    expect(html).toContain("stale");
    expect(html).toContain("deprecated");
    expect(html).toContain("preview experimental");
    expect(html).toContain("Provider");
    expect(html).toContain("Model ID");
    expect(html).toContain("Input / output / cached");
    expect(html).toContain("Context");
    expect(html).toContain("Capabilities");
    expect(html).toContain("Official source");
    expect(html).toContain("OpenAI Demo Balanced");
    expect(html).toContain("Approve");
    expect(html).toContain("Reject");
    expect(html).not.toContain("api_key");
    expect(html).not.toContain("raw prompt");
  });

  test("renders reports privacy vault with redacted states and actions", () => {
    const html = renderToString(<AdminReportsVaultScreen />);

    expect(html).toContain("Reports");
    expect(html).toContain("ready redacted");
    expect(html).toContain("raw locked");
    expect(html).toContain("failed export");
    expect(html).toContain("deletion pending");
    expect(html).toContain("deleted");
    expect(html).toContain("open redacted");
    expect(html).toContain("retry export");
    expect(html).toContain("regenerate export");
    expect(html).toContain("approve deletion");
    expect(html).toContain("request sudo for raw");
    expect(html).not.toContain("Classify the inbound support message");
    expect(html).not.toContain("{{customer_message}}");
    expect(html).not.toContain("sk-");
  });

  test("renders billing admin with entitlements, usage, invoices, credits, and flags", () => {
    const html = renderToString(<AdminBillingScreen />);

    expect(html).toContain("Billing");
    expect(html).toContain("Plan");
    expect(html).toContain("Trial state");
    expect(html).toContain("Seats");
    expect(html).toContain("Hosted eval run limit");
    expect(html).toContain("Prompt history entitlement");
    expect(html).toContain("Report export entitlement");
    expect(html).toContain("CSV upload");
    expect(html).toContain("BYOK");
    expect(html).toContain("PDF export");
    expect(html).toContain("CLI beta");
    expect(html).toContain("Invoices");
    expect(html).toContain("Credits");
    expect(html).toContain("Usage ledger");
    expect(html).toContain("Feature flags");
    expect(html).toContain("Issue report export credit");
  });

  test("renders audit logs with redacted append-only metadata", () => {
    const html = renderToString(<AdminAuditLogsScreen />);

    expect(html).toContain("Audit logs");
    expect(html).toContain("Append-only trust trail");
    expect(html).toContain("read_metadata");
    expect(html).toContain("delete_report");
    expect(html).toContain("report_deletion_approval");
    expect(html).not.toContain("Classify the inbound support message");
    expect(html).not.toContain("{{customer_message}}");
    expect(html).not.toContain("sk-");
  });
});
