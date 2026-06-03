import { Hono } from "hono";
import { cors } from "hono/cors";
import { createHealthResponse } from "@promptopts/shared";

export const app = new Hono();

app.use("*", cors());

app.get("/health", (c) => {
  return c.json(createHealthResponse("api"));
});

export default app;
