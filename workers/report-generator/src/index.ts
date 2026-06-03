import { APP_NAME } from "@promptopts/shared";

export function startReportGenerator() {
  console.log(`${APP_NAME} report-generator ready. No report queue is wired yet.`);

  setInterval(() => {
    console.log(`${APP_NAME} report-generator idle`);
  }, 60_000);
}

if (import.meta.main) {
  startReportGenerator();
}
