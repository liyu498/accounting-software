import { defineConfig } from "playwright-core";

export default defineConfig({
  use: {
    launchOptions: {
      executablePath: "C:/Users/liyu498/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe",
    },
  },
});
