import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  webServer: {
    command: "../../node_modules/.bin/vite dev --port 5174",
    port: 5174,
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://localhost:5174",
  },
});
