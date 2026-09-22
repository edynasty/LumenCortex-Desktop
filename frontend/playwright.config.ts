import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./visual-tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:34115",
    browserName: "chromium",
    colorScheme: "light",
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:34115/visual.html",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
