import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const sessionPort = 3101;

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/e2e/mock-session-server.mjs",
      env: { MOCK_SESSION_PORT: String(sessionPort) },
      port: sessionPort,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `pnpm build && pnpm exec next start -p ${port}`,
      env: { RECORDS_API_URL: `http://localhost:${sessionPort}` },
      url: `http://localhost:${port}`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
});
