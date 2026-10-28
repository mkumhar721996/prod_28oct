import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const apiPort = 4100;

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/e2e/records-api-stub.mjs",
      url: `http://localhost:${apiPort}/hires`,
      env: { PORT: String(apiPort) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `pnpm build && pnpm exec next start -p ${port}`,
      url: `http://localhost:${port}`,
      env: { RECORDS_API_URL: `http://localhost:${apiPort}` },
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
});
