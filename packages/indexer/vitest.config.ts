import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 30000, // 30 seconds timeout
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      reporter: ["text", "html", "json"],
      exclude: [
        "node_modules/",
        "dist/",
        "test/",
        "**/*.test.ts",
        "**/*.spec.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "@shared": new URL("../shared/src", import.meta.url).pathname,
    },
  },
});
