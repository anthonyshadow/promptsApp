# PromptOpts

PromptOpts is an LLM cost-quality optimization product for teams using API-based models. The MVP helps a user select their current provider/model, paste a production prompt, define success, audit cost and risk, generate prompt candidates, shortlist same-provider models, run an eval matrix, and export a deployable recommendation.

The product promise is not "rewrite my prompt." It is: find the cheapest prompt + model + settings combination that still passes the user's quality bar.

## Current Repo State

This repo currently contains the durable source of truth extracted from the PromptOpts MVP PDFs. It intentionally does not contain product code, dependencies, or scaffolding yet.

## Source Of Truth

Start with `AGENTS.md`, then use the focused docs under `docs/context/`:

- `product-canon.md`: product thesis, public loop, MVP boundaries
- `ux-route-map.md`: public and admin route contract
- `api-contract.md`: Hono public/admin API boundary
- `data-model.md`: core entities and admin extensions
- `security-trust.md`: privacy, admin controls, auditability
- `model-registry-policy.md`: model metadata and freshness rules
- `eval-decision-rules.md`: quality gates and recommendation rules
- `mock-data-contract.md`: safe synthetic data rules
- `build-sequence.md`: intended implementation order
- `acceptance-checklist.md`: launch readiness checklist

## Intended Build Sequence

1. Create the Bun + TypeScript monorepo shell.
2. Add shared schemas and typed route contracts.
3. Build the public provider/model setup and prompt input.
4. Add token/cost audit, parser, model-fit labels, and secret warnings.
5. Add the admin auth/audit foundation and guarded `/__admin/*` route tree.
6. Build prompt candidates, quality contract, and test-case capture.
7. Build model registry, same-provider shortlist, and freshness warnings.
8. Build eval jobs, matrix results, and verdict rules.
9. Build the recommendation report and export package.
10. Add minimum internal admin CRM/ops surfaces needed to operate the MVP safely.

## Stack Direction

- Frontend: React + TypeScript SPA, Vite, Monaco editor, diff viewer.
- API: Hono + TypeScript with Zod validation, Hono RPC for the internal client, OpenAPI later.
- Runtime/tooling: Bun.
- Workers: Bun eval/report workers.
- Data: Postgres, Redis or equivalent queue, object storage.
- Providers: OpenAI, Anthropic, Gemini only for MVP.
