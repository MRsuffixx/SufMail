import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/server/**", "src/lib/**", "src/domain/**"],
      exclude: [
        "src/server/api/routers/**", // tRPC routers tested separately
        "src/**/*.test.ts",
        "src/tests/**",
      ],
    },
    alias: {
      "~/": resolve(__dirname, "./src/"),
    },
  },
  resolve: {
    alias: {
      "~/": resolve(__dirname, "./src/"),
    },
  },
});
