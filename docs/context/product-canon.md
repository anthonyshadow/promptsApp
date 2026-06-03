# Product Canon

## Purpose

Define what PromptOpts is, what the MVP must prove, and what future implementation work must not dilute.

## Source Summary

Synthesized from:

- `PromptOpts_MVP_Wireframes_Updated_Playbooks.pdf`
- `PromptOpts_MVP_React_Hono_Bun_Playbook.pdf`
- `PromptOpts_MVP_React_Hono_Bun_Admin_CRM_Playbook.pdf`

The PDFs repeatedly frame PromptOpts as a cost-quality control product for LLM API teams. The user starts from a current provider/model and prompt, then receives a deployable recommendation only after eval proof.

## Decisions

- PromptOpts is an LLM cost-quality optimization product, not a generic prompt rewriter.
- The core public loop is: provider/model setup -> prompt paste -> audit -> success contract -> candidates -> model shortlist -> eval matrix -> recommendation report -> export.
- The public promise is to find the cheapest prompt + model + settings combination that still passes the user's quality bar.
- The default MVP comparison path is same-provider model comparison, because cross-provider adoption requires extra API keys, procurement, and implementation work.
- MVP providers are OpenAI, Anthropic, and Gemini only.
- The first two minutes are the conversion moment: setup, paste, audit.
- The emotional hook is the model-fit badge: overpowered, appropriate, or underpowered.
- The final report must make a decision: one winner, one cheaper alternative, and one stronger fallback.
- The internal admin CRM/ops layer ships only as the minimum operating system needed to run the MVP safely.

## Non-Negotiables

- Risk appears before savings.
- No production recommendation without an eval pass threshold and zero must-pass failures.
- Same-provider comparison is the default MVP path.
- The original prompt + current model remain the regression baseline.
- Savings claims depend on fresh model registry metadata and passing evals.
- The admin CRM must not become a public CRM product, sales automation suite, or raw prompt browsing tool.
- The product must not imply automatic savings before eval proof.

## Implementation Notes

- Public UX should stay opinionated and value-first.
- Expert controls should stay below the fold until needed.
- Prompt optimization and model recommendation are inseparable; provider/model setup leads the flow.
- Prompt candidates should have risk profiles: conservative, balanced, aggressive, output-lite, plus model-specific only when provider behavior matters.
- The report should include prompt, settings, implementation notes, eval results, savings estimate, fallback route, and changelog.
- Verified monthly savings generated is the north-star proof metric.

## MVP Exclusions

- Public prompt marketplace.
- Casual ChatGPT prompt library.
- Full production model router.
- Automatic deployment into customer infrastructure.
- Full observability platform.
- Twenty provider integrations.
- Enterprise approval workflows and SOC 2 workstreams.
- Complex RAG debugger, fine-tuning recommendations, or autonomous agent framework.
