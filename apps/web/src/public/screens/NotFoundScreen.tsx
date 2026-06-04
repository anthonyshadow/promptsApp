import {
  emptyStateStyle,
  primaryButtonStyle,
  sectionTextStyle,
  sectionTitleStyle
} from "../../styles";
import type { NavigateHandler } from "../../viewTypes";

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

export default NotFoundScreen;
