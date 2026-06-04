import { z } from "zod";

export * from "./schemas";
export * from "./repositories/types";
export * from "./repositories/memory";

export const APP_NAME = "PromptOpts";

export const healthResponseSchema = z.object({
  service: z.string().min(1),
  status: z.literal("ok"),
  timestamp: z.string().datetime()
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export function createHealthResponse(service: string): HealthResponse {
  return {
    service,
    status: "ok",
    timestamp: new Date().toISOString()
  };
}
