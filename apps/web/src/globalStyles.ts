import { injectGlobal } from "@emotion/css";

injectGlobal({
  ":root": {
    color: "#1f2421",
    background: "#f4f5f0",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSynthesis: "none",
    textRendering: "optimizeLegibility"
  },
  "*": {
    boxSizing: "border-box"
  },
  body: {
    margin: 0,
    minWidth: "320px",
    minHeight: "100vh"
  },
  "button, input, textarea, select": {
    font: "inherit"
  },
  button: {
    cursor: "pointer"
  }
});
