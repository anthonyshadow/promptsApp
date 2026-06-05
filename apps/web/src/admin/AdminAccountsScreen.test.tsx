import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import AdminAccountDetailScreen from "./AdminAccountDetailScreen";
import AdminAccountsScreen from "./AdminAccountsScreen";

describe("admin CRM screens", () => {
  test("renders the account pipeline stages, table columns, and manual actions", () => {
    const html = renderToString(<AdminAccountsScreen />);

    expect(html).toContain("CRM pipeline");
    expect(html).toContain("new audit");
    expect(html).toContain("qualified");
    expect(html).toContain("eval ready");
    expect(html).toContain("trial");
    expect(html).toContain("paid");
    expect(html).toContain("needs review");
    expect(html).toContain("Fit signal");
    expect(html).toContain("Savings opportunity");
    expect(html).toContain("Assign owner");
    expect(html).toContain("Create task");
    expect(html).toContain("Add note");
    expect(html).toContain("Open account");
    expect(html).toContain("No sequences, campaigns, forecasting");
    expect(html).not.toContain("automation suite");
    expect(html).not.toContain("{{customer_message}}");
  });

  test("renders Account 360 with redacted tabs and no raw prompt controls", () => {
    const html = renderToString(<AdminAccountDetailScreen accountId="account_acme_ai" />);

    expect(html).toContain("Account 360");
    expect(html).toContain("Plan");
    expect(html).toContain("BYOK status");
    expect(html).toContain("Workspace health");
    expect(html).toContain("Projects tab");
    expect(html).toContain("Reports tab");
    expect(html).toContain("Billing tab placeholder");
    expect(html).toContain("Support timeline");
    expect(html).toContain("Redacted previews");
    expect(html).not.toContain("Classify the inbound support message");
    expect(html).not.toContain("prompt_text");
    expect(html).not.toContain("api_key");
    expect(html).not.toContain("Reveal raw prompt");
  });
});
