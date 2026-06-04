# PromptOpts Agent Brief

PromptOpts is an LLM cost-quality optimization product. It is not a generic prompt rewriter. Future work should build toward a deployable recommendation that proves quality through evals before claiming savings.

## Read First

- Product canon: `docs/context/product-canon.md`
- UX and routes: `docs/context/ux-route-map.md`
- API contract: `docs/context/api-contract.md`
- Data model: `docs/context/data-model.md`
- Security and admin trust: `docs/context/security-trust.md`
- Model registry rules: `docs/context/model-registry-policy.md`
- Eval decision rules: `docs/context/eval-decision-rules.md`
- Mock data rules: `docs/context/mock-data-contract.md`
- Build sequence: `docs/context/build-sequence.md`
- Acceptance checklist: `docs/context/acceptance-checklist.md`

## Core Product Loop

Provider/model setup -> prompt paste -> audit -> success contract -> candidates -> model shortlist -> eval matrix -> recommendation report -> export.

Same-provider model comparison is the MVP default. Support OpenAI, Anthropic, and Gemini only.

## Non-Negotiables

- Risk appears before savings.
- No production recommendation without an eval pass threshold and zero must-pass failures.
- The report recommends one winner, one cheaper alternative, and one stronger fallback.
- Model metadata lives in the model registry. Never hard-code long-lived model prices, context windows, feature flags, or stability assumptions.
- Admin is internal only: `/__admin/*` React UI and `/admin-api/*` Hono API.
- Hidden route is not security. Admin requires session, MFA, RBAC, action scopes, sudo for dangerous actions, redacted-by-default views, and append-only `admin_audit_logs`.
- Admin CRM must not become a public CRM product, sales automation suite, or raw prompt browsing tool.

## Implementation Posture

Use React + TypeScript for the frontend, Hono + TypeScript for APIs, Bun for tooling/runtime/workers, shared Zod schemas for contracts, Postgres for durable data, Redis or equivalent queue for async jobs, and object storage for report artifacts. Do not add app code or dependencies until the implementation task explicitly asks for it.

## React Styling

Use `@emotion/css` for app-owned React styles. Component files keep component code first, then `export default ComponentName;`, then bottom-only `css({ ... })` constants. Avoid app-owned CSS files, styled components, Emotion `css` prop, and inline styles unless values are truly dynamic.
