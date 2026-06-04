import { getAdminGateCopy, getAdminGateStateFromSearch } from "../adminGate";
import type { AdminGateState } from "../viewTypes";
import {
  adminEyebrowStyle,
  adminRootStyle,
  adminShellStyle,
  adminTitleStyle,
  gateBodyStyle,
  gateHeaderStyle,
  gatePanelStyle,
  gateStatusStyle,
  gateTitleStyle,
  sudoButtonStyle,
  sudoFormStyle,
  sudoInputStyle,
  sudoLabelStyle
} from "../styles";

function AdminRouteTree() {
  const gateState = getAdminGateStateFromSearch(window.location.search);

  return (
    <main className={adminRootStyle}>
      <section className={adminShellStyle} aria-labelledby="admin-title">
        <p className={adminEyebrowStyle}>Internal only</p>
        <h1 className={adminTitleStyle} id="admin-title">
          PromptOpts Admin
        </h1>
        <AdminGateStateView state={gateState} />
      </section>
    </main>
  );
}

export default AdminRouteTree;

function AdminGateStateView({ state }: { state: AdminGateState }) {
  const copy = getAdminGateCopy(state);

  return (
    <div className={gatePanelStyle}>
      <div className={gateHeaderStyle}>
        <span className={gateStatusStyle}>{copy.status}</span>
        <strong className={gateTitleStyle}>{copy.title}</strong>
      </div>
      <p className={gateBodyStyle}>{copy.body}</p>
      {state === "sudo-required" ? (
        <form className={sudoFormStyle}>
          <label className={sudoLabelStyle} htmlFor="sudo-reason">
            Reason code
          </label>
          <input
            className={sudoInputStyle}
            id="sudo-reason"
            name="sudo-reason"
            placeholder="required before dangerous action"
            type="text"
          />
          <button className={sudoButtonStyle} type="button">
            Request sudo
          </button>
        </form>
      ) : null}
    </div>
  );
}
