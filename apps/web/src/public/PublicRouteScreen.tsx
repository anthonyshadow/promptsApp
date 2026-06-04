import type { ModelRegistryRecord, Priority, Provider } from "@promptopts/shared";
import DecisionCard from "../components/DecisionCard";
import EmptyState from "../components/EmptyState";
import Field from "../components/Field";
import ModelFitPanel, { RiskSummary, SavingsSummary } from "../components/SummaryPanels";
import StatusBadge from "../components/StatusBadge";
import StatusNotice from "../components/StatusNotice";
import { getRegistryNotice } from "../apiViewState";
import {
  formatCandidateId,
  formatProvider,
  formatModelFit,
  formatStrategy,
  getStepCardTitle
} from "../formatters";
import {
  demoAudit,
  demoCandidates,
  demoEvalResults,
  demoEvalRun,
  demoProject,
  demoPromptVersion,
  demoQualityContract,
  demoReport,
  demoReportArtifacts,
  demoTestCases,
  type PublicAppState
} from "../mockData";
import { stepperItems, type PublicRoute } from "../routes";
import {
  cardGridStyle,
  cardKickerStyle,
  cardTextStyle,
  cardTitleStyle,
  candidateCardStyle,
  candidateHeaderStyle,
  checkboxLabelStyle,
  checkboxStyle,
  compactTitleStyle,
  contentStackStyle,
  decisionGridStyle,
  emptyStateStyle,
  expertGridStyle,
  expertPanelStyle,
  fieldControlStyle,
  formGridStyle,
  heroBandStyle,
  listPanelStyle,
  loopCardLabelStyle,
  loopCardStyle,
  loopCardTitleStyle,
  metricLineStyle,
  panelTitleStyle,
  plainListStyle,
  primaryButtonStyle,
  promptTextareaStyle,
  riskPillStyle,
  sectionEyebrowStyle,
  sectionTextStyle,
  sectionTitleStyle,
  splitGridStyle,
  tableStyle,
  tableSubtextStyle,
  tableWrapStyle,
  testCardStyle
} from "../styles";
import type { ApiState, NavigateHandler } from "../viewTypes";

function PublicRouteScreen({
  apiState,
  appState,
  onNavigate,
  registryModels,
  route,
  updateAppState
}: {
  apiState: ApiState;
  appState: PublicAppState;
  onNavigate: NavigateHandler;
  registryModels: ModelRegistryRecord[];
  route: PublicRoute;
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  switch (route.kind) {
    case "app-home":
      return <WorkspaceScreen appState={appState} onNavigate={onNavigate} />;
    case "free-audit":
      return <FreeAuditScreen appState={appState} onNavigate={onNavigate} updateAppState={updateAppState} />;
    case "setup":
      return (
        <SetupScreen
          apiState={apiState}
          appState={appState}
          onNavigate={onNavigate}
          registryModels={registryModels}
          updateAppState={updateAppState}
        />
      );
    case "prompt":
      return <PromptScreen appState={appState} updateAppState={updateAppState} />;
    case "audit":
      return <AuditScreen appState={appState} onNavigate={onNavigate} />;
    case "success":
      return <SuccessContractScreen appState={appState} updateAppState={updateAppState} />;
    case "candidates":
      return <CandidatesScreen appState={appState} updateAppState={updateAppState} />;
    case "models":
      return <ModelsScreen appState={appState} registryModels={registryModels} updateAppState={updateAppState} />;
    case "eval-run":
      return <EvalRunScreen onNavigate={onNavigate} />;
    case "report":
      return <ReportScreen onNavigate={onNavigate} />;
    case "report-export":
      return <ExportScreen />;
    case "not-found":
      return <NotFoundScreen onNavigate={onNavigate} path={route.path} />;
  }
}

export default PublicRouteScreen;

function WorkspaceScreen({ appState, onNavigate }: { appState: PublicAppState; onNavigate: NavigateHandler }) {
  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="workspace-title">
        <div>
          <p className={sectionEyebrowStyle}>{demoProject.name}</p>
          <h2 className={sectionTitleStyle} id="workspace-title">
            Same-provider optimization path
          </h2>
          <p className={sectionTextStyle}>
            {formatProvider(appState.provider)} baseline, current model {appState.currentModelId},{" "}
            {appState.monthlyCalls.toLocaleString()} monthly calls.
          </p>
        </div>
        <button className={primaryButtonStyle} type="button" onClick={() => onNavigate("/app/setup")}>
          Continue setup
        </button>
      </section>

      <section className={splitGridStyle} aria-label="Workspace health">
        <RiskSummary />
        <SavingsSummary />
      </section>

      <section className={cardGridStyle} aria-label="Product loop">
        {stepperItems.map((step) => (
          <button className={loopCardStyle} key={step.key} type="button" onClick={() => onNavigate(step.path)}>
            <span className={loopCardLabelStyle}>{step.label}</span>
            <strong className={loopCardTitleStyle}>{getStepCardTitle(step.key)}</strong>
          </button>
        ))}
      </section>
    </div>
  );
}

function FreeAuditScreen({
  appState,
  onNavigate,
  updateAppState
}: {
  appState: PublicAppState;
  onNavigate: NavigateHandler;
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="free-audit-title">
        <div>
          <p className={sectionEyebrowStyle}>Free LLM Model Fit Audit</p>
          <h2 className={sectionTitleStyle} id="free-audit-title">
            Model-fit badge first
          </h2>
          <p className={sectionTextStyle}>
            Current mock result: {formatModelFit(demoAudit.modelFit)} with {demoAudit.riskLevel} risk.
          </p>
        </div>
        <button className={primaryButtonStyle} type="button" onClick={() => onNavigate("/app/setup")}>
          Move into app
        </button>
      </section>

      <section className={formGridStyle} aria-label="Audit setup">
        <Field label="Provider">
          <select
            className={fieldControlStyle}
            value={appState.provider}
            onChange={(event) => updateAppState({ provider: event.target.value as Provider })}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
          </select>
        </Field>
        <Field label="Monthly calls">
          <input
            className={fieldControlStyle}
            min={1}
            type="number"
            value={appState.monthlyCalls}
            onChange={(event) => updateAppState({ monthlyCalls: Number(event.target.value) })}
          />
        </Field>
        <Field label="Priority">
          <select
            className={fieldControlStyle}
            value={appState.priority}
            onChange={(event) => updateAppState({ priority: event.target.value as Priority })}
          >
            <option value="balanced">Balanced</option>
            <option value="cost">Cost</option>
            <option value="quality">Quality</option>
            <option value="latency">Latency</option>
          </select>
        </Field>
      </section>

      <section className={splitGridStyle} aria-label="Audit readout">
        <RiskSummary />
        <ModelFitPanel />
      </section>
    </div>
  );
}

function SetupScreen({
  apiState,
  appState,
  onNavigate,
  registryModels,
  updateAppState
}: {
  apiState: ApiState;
  appState: PublicAppState;
  onNavigate: NavigateHandler;
  registryModels: ModelRegistryRecord[];
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  const sameProviderModels = registryModels.filter((model) => model.provider === appState.provider);

  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="setup-title">
        <div>
          <p className={sectionEyebrowStyle}>Provider and model setup</p>
          <h2 className={sectionTitleStyle} id="setup-title">
            Same-provider MVP path
          </h2>
          <p className={sectionTextStyle}>
            OpenAI, Anthropic, and Gemini stay in scope; model metadata comes from the registry.
          </p>
        </div>
        <button className={primaryButtonStyle} type="button" onClick={() => onNavigate("/app/prompts/prompt_demo_support")}>
          Continue to prompt
        </button>
      </section>

      <section className={formGridStyle} aria-label="Project setup">
        <Field label="Provider">
          <select
            className={fieldControlStyle}
            value={appState.provider}
            onChange={(event) => {
              const provider = event.target.value as Provider;
              const nextModel = registryModels.find((model) => model.provider === provider)?.model_id;
              updateAppState({ provider, currentModelId: nextModel ?? appState.currentModelId });
            }}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
          </select>
        </Field>
        <Field label="Current model">
          <select
            className={fieldControlStyle}
            value={appState.currentModelId}
            onChange={(event) => updateAppState({ currentModelId: event.target.value })}
          >
            {sameProviderModels.map((model) => (
              <option key={model.id} value={model.model_id}>
                {model.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select
            className={fieldControlStyle}
            value={appState.priority}
            onChange={(event) => updateAppState({ priority: event.target.value as Priority })}
          >
            <option value="balanced">Balanced</option>
            <option value="cost">Cost</option>
            <option value="quality">Quality</option>
            <option value="latency">Latency</option>
          </select>
        </Field>
      </section>

      <StatusNotice
        tone={apiState.status === "online" ? "good" : "warn"}
        title="Registry status"
        body={getRegistryNotice(apiState)}
      />
    </div>
  );
}

function PromptScreen({
  appState,
  updateAppState
}: {
  appState: PublicAppState;
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="prompt-title">
        <div>
          <p className={sectionEyebrowStyle}>{demoPromptVersion.label}</p>
          <h2 className={sectionTitleStyle} id="prompt-title">
            Prompt baseline
          </h2>
          <p className={sectionTextStyle}>
            Variables: {demoPromptVersion.variables.map((variable) => `{{${variable}}}`).join(", ")}
          </p>
        </div>
        <StatusBadge label="Current model" value={appState.currentModelId} tone="neutral" />
      </section>

      <Field label="Prompt text">
        <textarea
          className={promptTextareaStyle}
          value={appState.promptText}
          onChange={(event) => updateAppState({ promptText: event.target.value })}
        />
      </Field>

      <StatusNotice
        tone="warn"
        title="Risk check"
        body="Prompt content remains customer-owned. Admin views stay redacted by default and raw prompt browsing is not a normal support workflow."
      />
    </div>
  );
}

function AuditScreen({ appState, onNavigate }: { appState: PublicAppState; onNavigate: NavigateHandler }) {
  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="audit-title">
        <div>
          <p className={sectionEyebrowStyle}>Prompt and model audit</p>
          <h2 className={sectionTitleStyle} id="audit-title">
            {formatModelFit(demoAudit.modelFit)}
          </h2>
          <p className={sectionTextStyle}>
            Baseline: {appState.currentModelId}. Registry freshness: {demoAudit.registryFreshness}.
          </p>
        </div>
        <button className={primaryButtonStyle} type="button" onClick={() => onNavigate("/app/projects/project_demo_support/success")}>
          Define success
        </button>
      </section>

      <section className={splitGridStyle} aria-label="Audit findings">
        <RiskSummary />
        <SavingsSummary />
      </section>

      <section className={listPanelStyle} aria-label="Guardrails">
        <h3 className={panelTitleStyle}>Compression guardrails</h3>
        <ul className={plainListStyle}>
          {demoAudit.compressionGuardrails.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SuccessContractScreen({
  appState,
  updateAppState
}: {
  appState: PublicAppState;
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="success-title">
        <div>
          <p className={sectionEyebrowStyle}>Quality contract</p>
          <h2 className={sectionTitleStyle} id="success-title">
            Pass threshold {Math.round(appState.passThreshold * 100)}%
          </h2>
          <p className={sectionTextStyle}>{demoQualityContract.notes}</p>
        </div>
        <StatusBadge label="Must-pass checks" value={String(demoQualityContract.must_pass_check_ids.length)} tone="warn" />
      </section>

      <Field label="Pass threshold">
        <input
          className={fieldControlStyle}
          max={1}
          min={0}
          step={0.01}
          type="number"
          value={appState.passThreshold}
          onChange={(event) => updateAppState({ passThreshold: Number(event.target.value) })}
        />
      </Field>

      <section className={cardGridStyle} aria-label="Test cases">
        {demoTestCases.map((testCase) => (
          <article className={testCardStyle} key={testCase.id}>
            <p className={cardKickerStyle}>{testCase.checks.some((check) => check.must_pass) ? "Must-pass" : "Review"}</p>
            <h3 className={cardTitleStyle}>{testCase.name}</h3>
            <p className={cardTextStyle}>{testCase.checks.map((check) => check.description).join(" / ")}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

function CandidatesScreen({
  appState,
  updateAppState
}: {
  appState: PublicAppState;
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  function toggleCandidate(candidateId: string) {
    const selected = appState.selectedCandidateIds.includes(candidateId)
      ? appState.selectedCandidateIds.filter((id) => id !== candidateId)
      : [...appState.selectedCandidateIds, candidateId];

    updateAppState({ selectedCandidateIds: selected });
  }

  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="candidates-title">
        <div>
          <p className={sectionEyebrowStyle}>Prompt candidates</p>
          <h2 className={sectionTitleStyle} id="candidates-title">
            Risk profiles before token deltas
          </h2>
          <p className={sectionTextStyle}>Baseline remains included for regression proof.</p>
        </div>
        <StatusBadge label="Selected" value={String(appState.selectedCandidateIds.length)} tone="neutral" />
      </section>

      <section className={cardGridStyle} aria-label="Candidate set">
        {demoCandidates.map((candidate) => {
          const checked = appState.selectedCandidateIds.includes(candidate.id);

          return (
            <article className={candidateCardStyle} key={candidate.id}>
              <div className={candidateHeaderStyle}>
                <span className={riskPillStyle}>{candidate.risk} risk</span>
                <label className={checkboxLabelStyle}>
                  <input
                    checked={checked}
                    className={checkboxStyle}
                    type="checkbox"
                    onChange={() => toggleCandidate(candidate.id)}
                  />
                  Include
                </label>
              </div>
              <h3 className={cardTitleStyle}>{formatStrategy(candidate.strategy)}</h3>
              <p className={cardTextStyle}>{candidate.summary}</p>
              <p className={metricLineStyle}>Expected token delta: {candidate.tokenDelta}%</p>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function ModelsScreen({
  appState,
  registryModels,
  updateAppState
}: {
  appState: PublicAppState;
  registryModels: ModelRegistryRecord[];
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  const sameProviderModels = registryModels.filter((model) => model.provider === appState.provider);

  function toggleModel(recordId: string) {
    const selected = appState.selectedModelIds.includes(recordId)
      ? appState.selectedModelIds.filter((id) => id !== recordId)
      : [...appState.selectedModelIds, recordId];

    updateAppState({ selectedModelIds: selected });
  }

  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="models-title">
        <div>
          <p className={sectionEyebrowStyle}>Model shortlist</p>
          <h2 className={sectionTitleStyle} id="models-title">
            Same-provider comparison
          </h2>
          <p className={sectionTextStyle}>
            {formatProvider(appState.provider)} registry rows only. Freshness and stability are read from model metadata.
          </p>
        </div>
        <StatusBadge label="Selected models" value={String(appState.selectedModelIds.length)} tone="neutral" />
      </section>

      {sameProviderModels.length === 0 ? (
        <EmptyState title="No registry rows" body="No same-provider models are available in the current registry payload." />
      ) : (
        <section className={tableWrapStyle} aria-label="Model shortlist table">
          <table className={tableStyle}>
            <thead>
              <tr>
                <th scope="col">Run</th>
                <th scope="col">Model</th>
                <th scope="col">Risk</th>
                <th scope="col">Freshness</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {sameProviderModels.map((model) => (
                <tr key={model.id}>
                  <td>
                    <input
                      checked={appState.selectedModelIds.includes(model.id)}
                      className={checkboxStyle}
                      type="checkbox"
                      onChange={() => toggleModel(model.id)}
                    />
                  </td>
                  <td>
                    <strong>{model.display_name}</strong>
                    <span className={tableSubtextStyle}>{model.model_id}</span>
                  </td>
                  <td>{model.stability_status}</td>
                  <td>{model.freshness_status}</td>
                  <td>{model.source_url ?? "demo/unverified"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function EvalRunScreen({ onNavigate }: { onNavigate: NavigateHandler }) {
  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="eval-title">
        <div>
          <p className={sectionEyebrowStyle}>Eval matrix</p>
          <h2 className={sectionTitleStyle} id="eval-title">
            {demoEvalRun.status}
          </h2>
          <p className={sectionTextStyle}>
            Threshold {Math.round(demoEvalRun.pass_threshold * 100)}%, zero must-pass failures required.
          </p>
        </div>
        <button className={primaryButtonStyle} type="button" onClick={() => onNavigate("/app/reports/report_demo_support")}>
          Review report
        </button>
      </section>

      <section className={tableWrapStyle} aria-label="Eval matrix results">
        <table className={tableStyle}>
          <thead>
            <tr>
              <th scope="col">Candidate</th>
              <th scope="col">Model</th>
              <th scope="col">Risk</th>
              <th scope="col">Pass rate</th>
              <th scope="col">Must-pass failures</th>
              <th scope="col">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {demoEvalResults.map((result) => (
              <tr key={result.id}>
                <td>{formatCandidateId(result.candidate_id)}</td>
                <td>{result.model_id}</td>
                <td>{result.risk_level}</td>
                <td>{Math.round(result.pass_rate * 100)}%</td>
                <td>{result.must_pass_failures}</td>
                <td>{result.verdict}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <StatusNotice
        tone="warn"
        title="Recommendation gate"
        body="Production recommendation remains blocked until the threshold passes and must-pass failures are zero."
      />
    </div>
  );
}

function ReportScreen({ onNavigate }: { onNavigate: NavigateHandler }) {
  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="report-title">
        <div>
          <p className={sectionEyebrowStyle}>Recommendation report</p>
          <h2 className={sectionTitleStyle} id="report-title">
            Production blocked
          </h2>
          <p className={sectionTextStyle}>
            The report reserves one winner, one cheaper alternative, and one stronger fallback after eval proof.
          </p>
        </div>
        <button className={primaryButtonStyle} type="button" onClick={() => onNavigate("/app/reports/report_demo_support/export")}>
          Export
        </button>
      </section>

      <section className={splitGridStyle} aria-label="Report summary">
        <RiskSummary />
        <SavingsSummary />
      </section>

      <section className={decisionGridStyle} aria-label="Decision slots">
        <DecisionCard title="Winner" body="Pending until eval threshold passes." />
        <DecisionCard title="Cheaper alternative" body="Pending verified costs and zero must-pass failures." />
        <DecisionCard title="Stronger fallback" body="Pending quality proof against the baseline." />
      </section>

      <section className={listPanelStyle} aria-label="Production blockers">
        <h3 className={panelTitleStyle}>Production blockers</h3>
        <ul className={plainListStyle}>
          {demoReport.production_blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ExportScreen() {
  return (
    <div className={contentStackStyle}>
      <section className={heroBandStyle} aria-labelledby="export-title">
        <div>
          <p className={sectionEyebrowStyle}>Deploy package export</p>
          <h2 className={sectionTitleStyle} id="export-title">
            Redacted by default
          </h2>
          <p className={sectionTextStyle}>Exports stay blocked from production claims until the report decision is allowed.</p>
        </div>
        <StatusBadge label="Report" value={demoReport.status} tone="warn" />
      </section>

      <section className={cardGridStyle} aria-label="Export artifacts">
        {demoReportArtifacts.map((artifact) => (
          <article className={testCardStyle} key={artifact.id}>
            <p className={cardKickerStyle}>{artifact.redaction_state}</p>
            <h3 className={cardTitleStyle}>{artifact.format.toUpperCase()}</h3>
            <p className={cardTextStyle}>{artifact.storage_uri}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

export function ExpertControls({
  appState,
  updateAppState
}: {
  appState: PublicAppState;
  updateAppState: (next: Partial<PublicAppState>) => void;
}) {
  return (
    <section className={expertPanelStyle} aria-label="Expert controls">
      <div>
        <p className={sectionEyebrowStyle}>Expert controls</p>
        <h2 className={compactTitleStyle}>Constraints and guardrails</h2>
      </div>
      <div className={expertGridStyle}>
        <Field label="Max latency">
          <input className={fieldControlStyle} placeholder="unset" type="text" />
        </Field>
        <Field label="Structured output">
          <select className={fieldControlStyle} defaultValue="required">
            <option value="required">Required</option>
            <option value="optional">Optional</option>
          </select>
        </Field>
        <Field label="Pass threshold">
          <input
            className={fieldControlStyle}
            max={1}
            min={0}
            step={0.01}
            type="number"
            value={appState.passThreshold}
            onChange={(event) => updateAppState({ passThreshold: Number(event.target.value) })}
          />
        </Field>
      </div>
    </section>
  );
}

function NotFoundScreen({ onNavigate, path }: { onNavigate: NavigateHandler; path: string }) {
  return (
    <section className={emptyStateStyle}>
      <h2 className={sectionTitleStyle}>Route unavailable</h2>
      <p className={sectionTextStyle}>{path} is not part of the current public shell.</p>
      <button className={primaryButtonStyle} type="button" onClick={() => onNavigate("/app")}>
        Return to app
      </button>
    </section>
  );
}
