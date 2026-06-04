import type { ModelRegistryRecord } from "@promptopts/shared";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { formatProvider } from "../../formatters";
import type { PublicAppState } from "../../mockData";
import {
  checkboxStyle,
  contentStackStyle,
  heroBandStyle,
  sectionEyebrowStyle,
  sectionTextStyle,
  sectionTitleStyle,
  tableStyle,
  tableSubtextStyle,
  tableWrapStyle
} from "../../styles";

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

export default ModelsScreen;
