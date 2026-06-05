import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import AdminEvalJobsScreen from "./AdminEvalJobsScreen";
import AdminModelRegistryScreen from "./AdminModelRegistryScreen";

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
});
