import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Map .js imports to .ts sources (needed for ESM TypeScript projects)
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./src/test-setup.ts"],
  },
});
