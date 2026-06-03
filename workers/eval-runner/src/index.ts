import { APP_NAME } from "@promptopts/shared";

export function startEvalRunner() {
  console.log(`${APP_NAME} eval-runner ready. No eval queue is wired yet.`);

  setInterval(() => {
    console.log(`${APP_NAME} eval-runner idle`);
  }, 60_000);
}

if (import.meta.main) {
  startEvalRunner();
}
