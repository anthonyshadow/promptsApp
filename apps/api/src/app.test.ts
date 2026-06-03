import { expect, test } from "bun:test";
import app from "./app";
import { healthResponseSchema } from "@promptopts/shared";

test("GET /health returns API health", async () => {
  const response = await app.request("/health");
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(healthResponseSchema.parse(body).status).toBe("ok");
});
