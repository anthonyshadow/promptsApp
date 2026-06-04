import { css } from "@emotion/css";

export const appRootStyle = css({
  minHeight: "100vh",
  display: "grid",
  gridTemplateColumns: "296px minmax(0, 1fr)",
  background: "#f4f5f0",
  "@media (max-width: 980px)": {
    gridTemplateColumns: "1fr"
  }
});

export const sidebarStyle = css({
  position: "sticky",
  top: 0,
  alignSelf: "start",
  minHeight: "100vh",
  borderRight: "1px solid #d8d6ca",
  background: "#171b18",
  color: "#eef1e9",
  padding: "24px",
  "@media (max-width: 980px)": {
    position: "static",
    minHeight: "auto",
    borderRight: 0,
    padding: "18px"
  }
});

export const brandBlockStyle = css({
  display: "grid",
  gap: "6px",
  paddingBottom: "20px",
  borderBottom: "1px solid #30362f"
});

export const brandEyebrowStyle = css({
  margin: 0,
  color: "#a8b6a6",
  fontSize: "0.76rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase"
});

export const brandTitleStyle = css({
  color: "#ffffff",
  fontSize: "1.35rem",
  lineHeight: 1.2
});

export const navStyle = css({
  display: "grid",
  gap: "8px",
  marginTop: "18px"
});

export const navLinkStyle = css({
  display: "flex",
  alignItems: "center",
  minHeight: "42px",
  borderRadius: "8px",
  color: "#dfe8dc",
  padding: "0 12px",
  textDecoration: "none",
  transition: "background 150ms ease, color 150ms ease",
  ":hover": {
    background: "#283026",
    color: "#ffffff"
  },
  ":focus-visible": {
    outline: "2px solid #9ccf80",
    outlineOffset: "2px"
  }
});

export const activeLinkStyle = css({
  background: "#e2f3d3",
  color: "#162015",
  ":hover": {
    background: "#e2f3d3",
    color: "#162015"
  }
});

export const stepperStyle = css({
  display: "grid",
  gap: "8px",
  marginTop: "24px",
  "@media (max-width: 980px)": {
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))"
  },
  "@media (max-width: 620px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
  }
});

export const stepLinkStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minHeight: "44px",
  borderRadius: "8px",
  color: "#dfe8dc",
  padding: "0 10px",
  textDecoration: "none",
  fontSize: "0.92rem",
  transition: "background 150ms ease, color 150ms ease",
  ":hover": {
    background: "#283026",
    color: "#ffffff"
  },
  ":focus-visible": {
    outline: "2px solid #9ccf80",
    outlineOffset: "2px"
  }
});

export const mainStyle = css({
  width: "min(100%, 1180px)",
  margin: "0 auto",
  padding: "28px",
  "@media (max-width: 760px)": {
    padding: "18px"
  }
});

export const shellHeaderStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "20px",
  alignItems: "start",
  marginBottom: "24px",
  "@media (max-width: 860px)": {
    gridTemplateColumns: "1fr"
  }
});

export const headerEyebrowStyle = css({
  margin: "0 0 8px",
  color: "#636f68",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase"
});

export const headerTitleStyle = css({
  margin: 0,
  color: "#111713",
  fontSize: "2rem",
  lineHeight: 1.15,
  letterSpacing: 0,
  "@media (max-width: 560px)": {
    fontSize: "1.6rem"
  }
});

export const headerStatusGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(150px, 1fr))",
  gap: "10px",
  "@media (max-width: 860px)": {
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))"
  },
  "@media (max-width: 620px)": {
    gridTemplateColumns: "1fr"
  }
});

export const contentStackStyle = css({
  display: "grid",
  gap: "18px"
});

export const heroBandStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "18px",
  alignItems: "center",
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  padding: "24px",
  "@media (max-width: 720px)": {
    gridTemplateColumns: "1fr",
    padding: "18px"
  }
});

export const sectionEyebrowStyle = css({
  margin: "0 0 8px",
  color: "#5b6c5d",
  fontSize: "0.76rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase"
});

export const sectionTitleStyle = css({
  margin: 0,
  color: "#121713",
  fontSize: "1.55rem",
  lineHeight: 1.2,
  letterSpacing: 0
});

export const compactTitleStyle = css({
  margin: 0,
  color: "#121713",
  fontSize: "1.15rem",
  lineHeight: 1.25,
  letterSpacing: 0
});

export const sectionTextStyle = css({
  margin: "12px 0 0",
  color: "#465049",
  lineHeight: 1.6
});

export const primaryButtonStyle = css({
  minHeight: "42px",
  border: "1px solid #1e2a20",
  borderRadius: "8px",
  background: "#1e2a20",
  color: "#ffffff",
  padding: "0 16px",
  fontWeight: 700,
  whiteSpace: "nowrap",
  ":hover": {
    background: "#304131"
  },
  ":disabled": {
    cursor: "not-allowed",
    borderColor: "#8d938e",
    background: "#8d938e"
  },
  ":focus-visible": {
    outline: "2px solid #6b8cff",
    outlineOffset: "2px"
  },
  "@media (max-width: 720px)": {
    width: "100%"
  }
});

export const splitGridStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: "14px",
  "@media (max-width: 760px)": {
    gridTemplateColumns: "1fr"
  }
});

export const summaryPanelStyle = css({
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  padding: "18px"
});

export const panelTitleStyle = css({
  margin: 0,
  color: "#151b17",
  fontSize: "1.1rem",
  lineHeight: 1.3
});

export const plainListStyle = css({
  margin: "12px 0 0",
  paddingLeft: "18px",
  color: "#465049",
  lineHeight: 1.55
});

export const cardGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "12px",
  "@media (max-width: 1080px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
  },
  "@media (max-width: 640px)": {
    gridTemplateColumns: "1fr"
  }
});

export const loopCardStyle = css({
  minHeight: "132px",
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  color: "#151b17",
  padding: "16px",
  textAlign: "left",
  ":hover": {
    borderColor: "#8fa284",
    background: "#f7fbf0"
  },
  ":focus-visible": {
    outline: "2px solid #6b8cff",
    outlineOffset: "2px"
  }
});

export const loopCardLabelStyle = css({
  display: "block",
  marginBottom: "18px",
  color: "#647064",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase"
});

export const loopCardTitleStyle = css({
  display: "block",
  fontSize: "1rem",
  lineHeight: 1.35
});

export const formGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "12px",
  "@media (max-width: 820px)": {
    gridTemplateColumns: "1fr"
  }
});

export const fieldStyle = css({
  display: "grid",
  gap: "7px"
});

export const fieldLabelStyle = css({
  color: "#4b554e",
  fontSize: "0.86rem",
  fontWeight: 700
});

export const fieldControlStyle = css({
  width: "100%",
  minHeight: "42px",
  border: "1px solid #c9c8bc",
  borderRadius: "8px",
  background: "#fffef9",
  color: "#151b17",
  padding: "0 12px",
  ":focus": {
    borderColor: "#6b8cff",
    outline: "2px solid #dfe6ff"
  }
});

export const detailsPanelStyle = css({
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  padding: "16px"
});

export const detailsSummaryStyle = css({
  cursor: "pointer",
  color: "#151b17",
  fontWeight: 800,
  ":focus-visible": {
    outline: "2px solid #6b8cff",
    outlineOffset: "4px"
  }
});

export const checkboxGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "12px",
  marginTop: "16px",
  "@media (max-width: 820px)": {
    gridTemplateColumns: "1fr"
  }
});

export const promptTextareaStyle = css({
  width: "100%",
  minHeight: "220px",
  border: "1px solid #c9c8bc",
  borderRadius: "8px",
  background: "#fffef9",
  color: "#151b17",
  padding: "14px",
  lineHeight: 1.55,
  resize: "vertical",
  ":focus": {
    borderColor: "#6b8cff",
    outline: "2px solid #dfe6ff"
  }
});

export const promptEditorGridStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
  gap: "14px",
  alignItems: "stretch",
  "@media (max-width: 920px)": {
    gridTemplateColumns: "1fr"
  }
});

export const promptPreviewStyle = css({
  minHeight: "220px",
  overflow: "auto",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  color: "#202722",
  padding: "14px",
  lineHeight: 1.55
});

export const promptVariableStyle = css({
  borderRadius: "6px",
  background: "#e2f3d3",
  color: "#162015",
  padding: "1px 4px",
  fontWeight: 800
});

export const metaGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "10px",
  "@media (max-width: 920px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
  },
  "@media (max-width: 560px)": {
    gridTemplateColumns: "1fr"
  }
});

export const chipListStyle = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginTop: "12px"
});

export const chipStyle = css({
  border: "1px solid #c7d5bc",
  borderRadius: "999px",
  background: "#f2f8ed",
  color: "#263128",
  padding: "5px 9px",
  fontSize: "0.84rem",
  fontWeight: 700
});

export const actionRowStyle = css({
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  "@media (max-width: 640px)": {
    display: "grid"
  }
});

export const listPanelStyle = css({
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  padding: "18px"
});

export const testCardStyle = css({
  minHeight: "150px",
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  padding: "16px"
});

export const candidateCardStyle = css({
  minHeight: "190px",
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  padding: "16px"
});

export const candidateHeaderStyle = css({
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  marginBottom: "14px"
});

export const riskPillStyle = css({
  border: "1px solid #caa463",
  borderRadius: "999px",
  background: "#fff4dc",
  color: "#6d4a11",
  padding: "4px 8px",
  fontSize: "0.78rem",
  fontWeight: 700
});

export const checkboxLabelStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  color: "#465049",
  fontSize: "0.86rem"
});

export const checkboxStyle = css({
  width: "18px",
  height: "18px",
  accentColor: "#1e2a20"
});

export const cardKickerStyle = css({
  margin: "0 0 8px",
  color: "#69726b",
  fontSize: "0.76rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase"
});

export const cardTitleStyle = css({
  margin: 0,
  color: "#141915",
  fontSize: "1.05rem",
  lineHeight: 1.3
});

export const cardTextStyle = css({
  margin: "10px 0 0",
  color: "#4d5750",
  lineHeight: 1.5
});

export const metricLineStyle = css({
  margin: "14px 0 0",
  color: "#263128",
  fontWeight: 700
});

export const tableWrapStyle = css({
  overflowX: "auto",
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9"
});

export const tableStyle = css({
  width: "100%",
  minWidth: "760px",
  borderCollapse: "collapse",
  color: "#1f2421",
  th: {
    background: "#ecefe6",
    color: "#475149",
    fontSize: "0.78rem",
    letterSpacing: 0,
    padding: "12px",
    textAlign: "left",
    textTransform: "uppercase"
  },
  td: {
    borderTop: "1px solid #e2e1d8",
    padding: "12px",
    verticalAlign: "top"
  }
});

export const tableSubtextStyle = css({
  display: "block",
  marginTop: "4px",
  color: "#6a716c",
  fontSize: "0.84rem"
});

export const decisionGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "12px",
  "@media (max-width: 820px)": {
    gridTemplateColumns: "1fr"
  }
});

export const decisionCardStyle = css({
  minHeight: "150px",
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  padding: "16px"
});

export const expertPanelStyle = css({
  display: "grid",
  gap: "16px",
  marginTop: "48px",
  borderTop: "1px solid #d7d6ca",
  paddingTop: "22px"
});

export const expertGridStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "12px",
  "@media (max-width: 820px)": {
    gridTemplateColumns: "1fr"
  }
});

export const statusLabelStyle = css({
  display: "block",
  marginBottom: "5px",
  fontSize: "0.74rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase"
});

export const statusValueStyle = css({
  display: "block",
  overflowWrap: "anywhere",
  fontSize: "0.92rem",
  lineHeight: 1.25
});

export const noticeTitleStyle = css({
  margin: 0,
  color: "#151b17",
  fontSize: "1rem",
  lineHeight: 1.3
});

export const noticeBodyStyle = css({
  margin: "8px 0 0",
  color: "#465049",
  lineHeight: 1.55
});

export const emptyStateStyle = css({
  border: "1px solid #d7d6ca",
  borderRadius: "8px",
  background: "#fffef9",
  padding: "24px"
});

export const adminRootStyle = css({
  minHeight: "100vh",
  padding: "28px",
  background: "#111714",
  color: "#eef4ed",
  "@media (max-width: 720px)": {
    padding: "18px"
  }
});

export const adminShellStyle = css({
  width: "min(100%, 880px)",
  margin: "0 auto",
  paddingTop: "8vh"
});

export const adminEyebrowStyle = css({
  margin: "0 0 12px",
  color: "#9fbaaa",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase"
});

export const adminTitleStyle = css({
  margin: 0,
  fontSize: "2.4rem",
  lineHeight: 1,
  letterSpacing: 0,
  "@media (max-width: 560px)": {
    fontSize: "2rem"
  }
});

export const gatePanelStyle = css({
  marginTop: "28px",
  border: "1px solid #415149",
  borderRadius: "8px",
  background: "#17211d",
  padding: "24px"
});

export const gateHeaderStyle = css({
  display: "grid",
  gap: "8px"
});

export const gateStatusStyle = css({
  width: "fit-content",
  border: "1px solid #6f8878",
  borderRadius: "8px",
  padding: "4px 8px",
  color: "#c7ddcf",
  fontSize: "0.8rem"
});

export const gateTitleStyle = css({
  color: "#ffffff",
  fontSize: "1.35rem",
  lineHeight: 1.25
});

export const gateBodyStyle = css({
  maxWidth: "680px",
  margin: "16px 0 0",
  color: "#c7d6ce",
  lineHeight: 1.6
});

export const sudoFormStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(180px, 1fr) auto",
  gap: "10px",
  marginTop: "20px",
  "@media (max-width: 640px)": {
    gridTemplateColumns: "1fr"
  }
});

export const sudoLabelStyle = css({
  gridColumn: "1 / -1",
  color: "#dfeae3",
  fontSize: "0.9rem"
});

export const sudoInputStyle = css({
  minHeight: "42px",
  border: "1px solid #657b6e",
  borderRadius: "8px",
  background: "#101713",
  color: "#ffffff",
  padding: "0 12px"
});

export const sudoButtonStyle = css({
  minHeight: "42px",
  border: "1px solid #b8d1c0",
  borderRadius: "8px",
  background: "#dcebe0",
  color: "#101713",
  padding: "0 14px",
  fontWeight: 700
});

export const getStepDotStyle = (state: "active" | "complete" | "queued") =>
  css({
    display: "grid",
    placeItems: "center",
    width: "24px",
    height: "24px",
    flex: "0 0 24px",
    borderRadius: "999px",
    background: state === "active" ? "#1e2a20" : state === "complete" ? "#6f8f61" : "#343c34",
    color: state === "queued" ? "#d6dfd3" : "#ffffff",
    fontSize: "0.75rem",
    fontWeight: 800
  });

export const getStatusBadgeStyle = (tone: "attention" | "good" | "neutral" | "warn") =>
  css({
    minHeight: "70px",
    border: "1px solid",
    borderColor:
      tone === "attention" ? "#9a7533" : tone === "good" ? "#6a8b5f" : tone === "warn" ? "#c39a55" : "#c9c8bc",
    borderRadius: "8px",
    background:
      tone === "attention" ? "#fff4dc" : tone === "good" ? "#eef8e9" : tone === "warn" ? "#fff8e8" : "#fffef9",
    color:
      tone === "attention" ? "#5e3d08" : tone === "good" ? "#244821" : tone === "warn" ? "#6d4a11" : "#1f2421",
    padding: "12px"
  });

export const getNoticeStyle = (tone: "good" | "warn") =>
  css({
    border: "1px solid",
    borderColor: tone === "good" ? "#8fad81" : "#c39a55",
    borderRadius: "8px",
    background: tone === "good" ? "#f1f8eb" : "#fff8e8",
    padding: "16px"
  });
