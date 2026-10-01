import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      PORT: "4000",
      FRONTEND_ORIGIN: "http://localhost:3000",
      API_PREFIX: "/api/v1",
    },
  },
});
