import { expect, test } from "bun:test";
import { createHealthResponse, healthResponseSchema } from "./index";

test("createHealthResponse creates a valid health payload", () => {
  const health = createHealthResponse("api");

  expect(healthResponseSchema.parse(health).service).toBe("api");
  expect(health.status).toBe("ok");
});
