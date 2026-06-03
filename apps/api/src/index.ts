import app from "./app";

const port = Number(Bun.env.PORT ?? 3000);

Bun.serve({
  port,
  fetch: app.fetch
});

console.log(`PromptOpts API listening on http://localhost:${port}`);
