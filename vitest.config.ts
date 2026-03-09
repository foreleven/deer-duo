import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    globals: true,
    poolOptions: {
      workers: {
        singleWorker: true,
        wrangler: {
          configPath: "./wrangler.test.toml",
        },
        miniflare: {
          bindings: {
            JWT_SECRET: "test-secret-key-for-vitest",
          },
          d1Databases: ["DB"],
        },
      },
    },
  },
});
