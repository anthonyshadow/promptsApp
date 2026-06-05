import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import AdminOverviewScreen from "./AdminOverviewScreen";

describe("admin overview screen", () => {
  test("renders command-center widgets with redacted metadata only", () => {
    const html = renderToString(<AdminOverviewScreen />);

    expect(html).toContain("Admin overview");
    expect(html).toContain("MRR / trials / failed payments");
    expect(html).toContain("Free audits and conversion");
    expect(html).toContain("Eval jobs queued/running/failed/retrying");
    expect(html).toContain("Provider spend / usage ledger");
    expect(html).toContain("API");
    expect(html).toContain("Eval worker");
    expect(html).toContain("Queue");
    expect(html).toContain("Storage");
    expect(html).toContain("Risk queue");
    expect(html).toContain("Stale model prices");
    expect(html).toContain("Failed report exports");
    expect(html).toContain("Secret-scan warnings");
    expect(html).toContain("Deletion requests");
    expect(html).toContain("Live activity feed");
    expect(html).not.toContain("{{customer_message}}");
    expect(html).not.toContain("prompt_text");
    expect(html).not.toContain("api_key");
  });
});
