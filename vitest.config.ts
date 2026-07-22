import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["tests/bulk-run-*.test.ts", "tests/google-sheets-bulk-run-contract.test.ts", "tests/supabase-secret-contract.test.ts", "tests/e8-*.test.ts", "tests/affiliate-*.test.ts"],
  },
});
