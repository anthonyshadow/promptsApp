import { describe, expect, test } from "bun:test";
import { DEMO_IDS, healthResponseSchema } from "@promptopts/shared";
import { createTotpCode } from "@promptopts/admin-core";
import {
  adminEvalRunDetailResponseSchema,
  adminEvalRunsResponseSchema,
  adminModelRegistryResponseSchema,
  adminOverviewResponseSchema,
  adminProviderConnectionsResponseSchema,
  adminReportsResponseSchema,
  billingCreditResponseSchema,
  billingResponseSchema,
  modelApproveResponseSchema,
  modelPatchResponseSchema,
  reportDeleteResponseSchema,
  reportExportActionResponseSchema
} from "./contracts";
import {
  adminGetRequest,
  adminJsonRequest,
  adminPatchJsonRequest,
  createAdminTestRepository,
  createDeleteFailingStorage,
  createTestApp,
  expectOkJson,
  jsonRequest,
  patchJsonRequest
} from "./appTestHelpers";

describe("route request validation", () => {
  test("rejects invalid bodies on every POST and PATCH skeleton route", async () => {
    const app = createTestApp();
    const invalidRoutes: Array<{ method: "POST" | "PATCH"; path: string }> = [
      { method: "POST", path: "/audits" },
      { method: "POST", path: "/prompts" },
      { method: "POST", path: `/prompts/${DEMO_IDS.prompt}/optimize` },
      { method: "POST", path: "/eval-runs" },
      { method: "POST", path: "/reports" },
      { method: "POST", path: "/admin-api/accounts" },
      { method: "PATCH", path: `/admin-api/accounts/${DEMO_IDS.account}` },
      { method: "POST", path: `/admin-api/accounts/${DEMO_IDS.account}/notes` },
      { method: "POST", path: `/admin-api/accounts/${DEMO_IDS.account}/tasks` },
      { method: "POST", path: `/admin-api/users/${DEMO_IDS.user}/revoke-sessions` },
      { method: "PATCH", path: `/admin-api/workspaces/${DEMO_IDS.workspace}` },
      { method: "POST", path: `/admin-api/eval-runs/${DEMO_IDS.evalRun}/retry` },
      { method: "POST", path: `/admin-api/eval-runs/${DEMO_IDS.evalRun}/cancel` },
      { method: "POST", path: `/admin-api/eval-runs/${DEMO_IDS.evalRun}/regenerate-report` },
      { method: "PATCH", path: "/admin-api/models/model_registry_openai_demo_balanced" },
      { method: "POST", path: "/admin-api/models/model_registry_openai_demo_balanced/approve" },
      { method: "POST", path: `/admin-api/reports/${DEMO_IDS.report}/retry-export` },
      { method: "POST", path: `/admin-api/reports/${DEMO_IDS.report}/regenerate` },
      { method: "POST", path: `/admin-api/reports/${DEMO_IDS.report}/delete` },
      { method: "POST", path: `/admin-api/billing/${DEMO_IDS.workspace}/credit` }
    ];

    for (const route of invalidRoutes) {
      const response = await app.request(
        route.path,
        route.method === "PATCH"
          ? adminPatchJsonRequest({}, { sudo_grant: { reason_code: "validation_test" } })
          : adminJsonRequest({}, { sudo_grant: { reason_code: "validation_test" } })
      );
      expect(response.status).toBe(400);
    }
  });

  test("requires a reason code for billing and entitlement workspace changes", async () => {
    const response = await createTestApp().request(
      `/admin-api/workspaces/${DEMO_IDS.workspace}`,
      adminPatchJsonRequest(
        {
          plan_id: DEMO_IDS.plan
        },
        { sudo_grant: { reason_code: "plan_change" } }
      )
    );

    expect(response.status).toBe(400);
  });

  test("requires verification metadata for model metadata edits", async () => {
    const response = await createTestApp().request(
      "/admin-api/models/model_registry_openai_demo_balanced",
      adminPatchJsonRequest(
        {
          input_price_per_million_tokens: 2,
          source_url: "https://example.com/verified"
        },
        { sudo_grant: { reason_code: "registry_validation" } }
      )
    );

    expect(response.status).toBe(400);
  });

  test("requires official source URL for any model registry change", async () => {
    const response = await createTestApp().request(
      "/admin-api/models/model_registry_openai_demo_balanced",
      adminPatchJsonRequest(
        {
          display_name: "Missing Source"
        },
        { sudo_grant: { reason_code: "registry_validation" } }
      )
    );

    expect(response.status).toBe(400);
  });
});
