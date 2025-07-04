import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  config,
  getEnvConfig,
  getTestConfig,
  getValidatedConfig,
  isDevelopment,
  isProduction,
  isTest,
  mergeConfig,
  validateConfig,
} from "./config.js";
import type { Config } from "./types.js";

describe("Configuration Module", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("config object", () => {
    it("should have all required properties", () => {
      expect(config).toBeDefined();
      expect(config.hubs).toBeDefined();
      expect(config.strategy).toBeDefined();
      expect(config.redis).toBeDefined();
      expect(config.postgres).toBeDefined();
      expect(config.auth).toBeDefined();
      expect(config.concurrency).toBeDefined();
    });

    it("should have at least one hub configured", () => {
      expect(config.hubs).toHaveLength(2);
      expect(config.hubs[0].url).toBe("https://hub.merv.fun");
      expect(config.hubs[1].url).toBe("https://snapchain-api.neynar.com");
    });

    it("should have valid strategy configuration", () => {
      expect(config.strategy.rootTargets).toEqual([1, 2, 3]);
      expect(config.strategy.targetClients).toEqual([4, 5, 6]);
      expect(config.strategy.enableClientDiscovery).toBe(true);
    });

    it("should have valid redis configuration", () => {
      expect(config.redis.host).toBe("localhost");
      expect(config.redis.port).toBe(6379);
    });

    it("should have valid postgres configuration", () => {
      expect(config.postgres.connectionString).toMatch(/^postgres:\/\//);
    });

    it("should have valid auth configuration", () => {
      expect(config.auth.jwtSecret).toBeDefined();
      expect(config.auth.jwtSecret.length).toBeGreaterThanOrEqual(32);
      expect(config.auth.adminPassword).toBeDefined();
    });

    it("should have valid concurrency configuration", () => {
      expect(config.concurrency.backfill).toBe(5);
      expect(config.concurrency.realtime).toBe(1);
    });
  });

  describe("validateConfig", () => {
    it("should validate a valid config", () => {
      expect(() => validateConfig(config)).not.toThrow();
    });

    it("should throw error for invalid config", () => {
      const invalidConfig = {
        ...config,
        hubs: [],
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        /Invalid configuration/
      );
    });

    it("should throw error for invalid hub URL", () => {
      const invalidConfig = {
        ...config,
        hubs: [{ url: "not-a-url" }],
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        /Invalid configuration/
      );
    });

    it("should throw error for invalid redis port", () => {
      const invalidConfig = {
        ...config,
        redis: { ...config.redis, port: -1 },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        /Invalid configuration/
      );
    });

    it("should throw error for short JWT secret", () => {
      const invalidConfig = {
        ...config,
        auth: { ...config.auth, jwtSecret: "short" },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        /Invalid configuration/
      );
    });

    it("should throw error for short admin password", () => {
      const invalidConfig = {
        ...config,
        auth: { ...config.auth, adminPassword: "short" },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        /Invalid configuration/
      );
    });
  });

  describe("getEnvConfig", () => {
    it("should return default config when no env vars are set", () => {
      const envConfig = getEnvConfig();
      expect(envConfig.redis?.host).toBe("localhost");
      expect(envConfig.redis?.port).toBe(6379);
    });

    it("should read redis config from environment variables", () => {
      process.env.REDIS_HOST = "redis-server";
      process.env.REDIS_PORT = "6380";
      process.env.REDIS_PASSWORD = "secret";
      process.env.REDIS_DB = "1";

      const envConfig = getEnvConfig();
      expect(envConfig.redis?.host).toBe("redis-server");
      expect(envConfig.redis?.port).toBe(6380);
      expect(envConfig.redis?.password).toBe("secret");
      expect(envConfig.redis?.db).toBe(1);
    });

    it("should read postgres config from environment variables", () => {
      process.env.DATABASE_URL = "postgres://user:pass@host:5432/db";

      const envConfig = getEnvConfig();
      expect(envConfig.postgres?.connectionString).toBe(
        "postgres://user:pass@host:5432/db"
      );
    });

    it("should read auth config from environment variables", () => {
      process.env.JWT_SECRET =
        "new-secret-key-that-is-definitely-32-characters-long";
      process.env.ADMIN_PASSWORD = "new-admin-password";

      const envConfig = getEnvConfig();
      expect(envConfig.auth?.jwtSecret).toBe(
        "new-secret-key-that-is-definitely-32-characters-long"
      );
      expect(envConfig.auth?.adminPassword).toBe("new-admin-password");
    });

    it("should read concurrency config from environment variables", () => {
      process.env.BACKFILL_CONCURRENCY = "10";
      process.env.REALTIME_CONCURRENCY = "2";

      const envConfig = getEnvConfig();
      expect(envConfig.concurrency?.backfill).toBe(10);
      expect(envConfig.concurrency?.realtime).toBe(2);
    });
  });

  describe("mergeConfig", () => {
    it("should merge configs correctly", () => {
      const override = {
        redis: { host: "new-host", port: 6380 },
        auth: {
          jwtSecret: "new-secret-key-that-is-definitely-32-characters-long",
        },
      };

      const merged = mergeConfig(config, override);
      expect(merged.redis.host).toBe("new-host");
      expect(merged.redis.port).toBe(6380);
      expect(merged.auth.jwtSecret).toBe(
        "new-secret-key-that-is-definitely-32-characters-long"
      );
      expect(merged.auth.adminPassword).toBe(config.auth.adminPassword);
    });

    it("should preserve nested properties", () => {
      const override = {
        redis: { host: "new-host" },
      };

      const merged = mergeConfig(config, override);
      expect(merged.redis.host).toBe("new-host");
      expect(merged.redis.port).toBe(config.redis.port);
    });
  });

  describe("getValidatedConfig", () => {
    it("should return validated config with env overrides", () => {
      process.env.REDIS_HOST = "env-redis";
      process.env.REDIS_PORT = "6380";

      const validatedConfig = getValidatedConfig();
      expect(validatedConfig.redis.host).toBe("env-redis");
      expect(validatedConfig.redis.port).toBe(6380);
    });

    it("should throw error if merged config is invalid", () => {
      process.env.REDIS_PORT = "invalid-port";

      expect(() => getValidatedConfig()).toThrow();
    });
  });

  describe("environment detection", () => {
    it("should detect development environment", () => {
      process.env.NODE_ENV = "development";
      expect(isDevelopment()).toBe(true);
      expect(isProduction()).toBe(false);
      expect(isTest()).toBe(false);
    });

    it("should detect production environment", () => {
      process.env.NODE_ENV = "production";
      expect(isDevelopment()).toBe(false);
      expect(isProduction()).toBe(true);
      expect(isTest()).toBe(false);
    });

    it("should detect test environment", () => {
      process.env.NODE_ENV = "test";
      expect(isDevelopment()).toBe(false);
      expect(isProduction()).toBe(false);
      expect(isTest()).toBe(true);
    });
  });

  describe("getTestConfig", () => {
    it("should return test configuration in test environment", () => {
      process.env.NODE_ENV = "test";

      const testConfig = getTestConfig();
      expect(testConfig.redis.host).toBe("localhost");
      expect(testConfig.redis.port).toBe(6380);
      expect(testConfig.postgres.connectionString).toMatch(/postgres_test/);
      expect(testConfig.auth.jwtSecret).toBe(
        "test-secret-key-minimum-32-characters-long"
      );
      expect(testConfig.concurrency.backfill).toBe(1);
      expect(testConfig.concurrency.realtime).toBe(1);
    });

    it("should throw error when not in test environment", () => {
      process.env.NODE_ENV = "development";

      expect(() => getTestConfig()).toThrow(
        "Test configuration can only be used in test environment"
      );
    });

    it("should use test environment variables when available", () => {
      process.env.NODE_ENV = "test";
      process.env.TEST_REDIS_HOST = "test-redis";
      process.env.TEST_REDIS_PORT = "6381";
      process.env.TEST_DATABASE_URL =
        "postgres://test:test@localhost:5434/test_db";

      const testConfig = getTestConfig();
      expect(testConfig.redis.host).toBe("test-redis");
      expect(testConfig.redis.port).toBe(6381);
      expect(testConfig.postgres.connectionString).toBe(
        "postgres://test:test@localhost:5434/test_db"
      );
    });
  });

  describe("hub configuration", () => {
    it("should have transform request function for neynar hub", () => {
      const neynarHub = config.hubs.find((hub) => hub.url.includes("neynar"));
      expect(neynarHub?.transformRequest).toBeDefined();

      if (neynarHub?.transformRequest) {
        const init = { headers: {} };
        const transformed = neynarHub.transformRequest(init);
        expect(transformed.headers).toHaveProperty("x-api-key");
      }
    });

    it("should use environment variable for neynar api key", () => {
      process.env.NEYNAR_API_KEY = "test-api-key";

      const neynarHub = config.hubs.find((hub) => hub.url.includes("neynar"));
      if (neynarHub?.transformRequest) {
        const init = { headers: {} };
        const transformed = neynarHub.transformRequest(init);
        expect((transformed.headers as any)["x-api-key"]).toBe("test-api-key");
      }
    });
  });
});
