import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      PORT: "4000",
      CLIENT_URL: "http://localhost:3000",
      API_PREFIX: "/api/v1",
    },
  },
});
