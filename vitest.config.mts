import { defineConfig } from "vitest/config";
import path from "path";
export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"], testTimeout: 30000, fileParallelism: false },
  // "server-only" throws outside the React server runtime; tests run server code directly.
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src"), "server-only": path.resolve(import.meta.dirname, "tests/server-only-stub.ts") } },
});
