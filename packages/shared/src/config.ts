import { z } from "zod";
import type { Config } from "./types.js";

const HubConfigSchema = z
  .object({
    url: z.string().url(),
    transformRequest: z.function().optional(),
  })
  .passthrough();

const StrategyConfigSchema = z.object({
  rootTargets: z.array(z.number().int().positive()),
  targetClients: z.array(z.number().int().positive()),
  enableClientDiscovery: z.boolean(),
});

const RedisConfigSchema = z.object({
  host: z.string(),
  port: z.number().int().positive(),
  password: z.string().optional(),
  db: z.number().int().min(0).optional(),
});

const PostgresConfigSchema = z.object({
  connectionString: z.string(),
});

const AuthConfigSchema = z.object({
  jwtSecret: z.string().min(32),
  adminPassword: z.string().min(8),
});

const ConcurrencyConfigSchema = z.object({
  backfill: z.number().int().positive(),
  realtime: z.number().int().positive(),
});

const ConfigSchema = z.object({
  hubs: z.array(HubConfigSchema).min(1),
  strategy: StrategyConfigSchema,
  redis: RedisConfigSchema,
  postgres: PostgresConfigSchema,
  auth: AuthConfigSchema,
  concurrency: ConcurrencyConfigSchema,
});

export const config: Config = {
  hubs: [
    {
      url: "https://hub.merv.fun",
    },
    {
      url: "https://snapchain-api.neynar.com",
      transformRequest: (init: RequestInit): RequestInit => ({
        ...init,
        headers: {
          ...init.headers,
          "x-api-key": process.env.NEYNAR_API_KEY || "",
        },
      }),
    },
  ],

  strategy: {
    rootTargets: [],
    targetClients: [],
    enableClientDiscovery: true,
  },

  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: Number.parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD,
    db: Number.parseInt(process.env.REDIS_DB || "0", 10),
  },

  postgres: {
    connectionString:
      process.env.DATABASE_URL ||
      "postgres://postgres:password@localhost:5432/postgres",
  },

  auth: {
    jwtSecret:
      process.env.JWT_SECRET ||
      "your-secret-key-here-change-this-in-production-minimum-32-characters",
    adminPassword: process.env.ADMIN_PASSWORD || "admin",
  },

  concurrency: {
    backfill: Number.parseInt(process.env.BACKFILL_CONCURRENCY || "5", 10),
    realtime: Number.parseInt(process.env.REALTIME_CONCURRENCY || "1", 10),
  },
};

export function validateConfig(configToValidate: unknown = config): Config {
  try {
    // Skip validation for functions, just ensure the basic structure is correct
    const configCopy = JSON.parse(
      JSON.stringify(configToValidate, (_key, value) => {
        if (typeof value === "function") {
          return undefined;
        }
        return value;
      })
    );

    // Add back the functions from the original config
    if (configToValidate && typeof configToValidate === "object") {
      const original = configToValidate as any;
      if (original.hubs) {
        for (let i = 0; i < original.hubs.length; i++) {
          if (
            original.hubs[i].transformRequest &&
            typeof original.hubs[i].transformRequest === "function"
          ) {
            configCopy.hubs = configCopy.hubs || [];
            configCopy.hubs[i] = configCopy.hubs[i] || {};
            configCopy.hubs[i].transformRequest =
              original.hubs[i].transformRequest;
          }
        }
      }
    }

    // Basic structure validation without functions
    const { hubs, ...rest } = configCopy;
    const hubsWithoutFunctions =
      hubs?.map(({ transformRequest, ...hub }: any) => hub) || [];

    ConfigSchema.parse({
      ...rest,
      hubs: hubsWithoutFunctions.map((hub: any) => ({
        ...hub,
        transformRequest: undefined,
      })),
    });

    return configCopy as Config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(
        (err) => `${err.path.join(".")}: ${err.message}`
      );
      throw new Error(`Invalid configuration:\n${errorMessages.join("\n")}`);
    }
    throw error;
  }
}

export function getEnvConfig(): Partial<Config> {
  return {
    redis: {
      host: process.env.REDIS_HOST || config.redis.host,
      port: Number.parseInt(
        process.env.REDIS_PORT || config.redis.port.toString(),
        10
      ),
      password: process.env.REDIS_PASSWORD || config.redis.password,
      db: Number.parseInt(
        process.env.REDIS_DB || config.redis.db?.toString() || "0",
        10
      ),
    },
    postgres: {
      connectionString:
        process.env.DATABASE_URL || config.postgres.connectionString,
    },
    auth: {
      jwtSecret: process.env.JWT_SECRET || config.auth.jwtSecret,
      adminPassword: process.env.ADMIN_PASSWORD || config.auth.adminPassword,
    },
    concurrency: {
      backfill: Number.parseInt(
        process.env.BACKFILL_CONCURRENCY ||
          config.concurrency.backfill.toString(),
        10
      ),
      realtime: Number.parseInt(
        process.env.REALTIME_CONCURRENCY ||
          config.concurrency.realtime.toString(),
        10
      ),
    },
  };
}

export function mergeConfig(
  baseConfig: Config,
  override: Partial<Config>
): Config {
  return {
    ...baseConfig,
    ...override,
    redis: { ...baseConfig.redis, ...override.redis },
    postgres: { ...baseConfig.postgres, ...override.postgres },
    auth: { ...baseConfig.auth, ...override.auth },
    concurrency: { ...baseConfig.concurrency, ...override.concurrency },
    strategy: { ...baseConfig.strategy, ...override.strategy },
  };
}

export function getValidatedConfig(): Config {
  const envOverrides = getEnvConfig();
  const mergedConfig = mergeConfig(config, envOverrides);
  return validateConfig(mergedConfig);
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isTest(): boolean {
  return process.env.NODE_ENV === "test";
}

export function getTestConfig(): Config {
  if (!isTest()) {
    throw new Error("Test configuration can only be used in test environment");
  }

  return {
    ...config,
    redis: {
      host: process.env.TEST_REDIS_HOST || "localhost",
      port: Number.parseInt(process.env.TEST_REDIS_PORT || "6380", 10),
      password: process.env.TEST_REDIS_PASSWORD,
      db: Number.parseInt(process.env.TEST_REDIS_DB || "0", 10),
    },
    postgres: {
      connectionString:
        process.env.TEST_DATABASE_URL ||
        "postgres://postgres:password@localhost:5433/postgres_test",
    },
    auth: {
      jwtSecret: "test-secret-key-minimum-32-characters-long",
      adminPassword: "test-admin-password",
    },
    concurrency: {
      backfill: 1,
      realtime: 1,
    },
  };
}

export default config;
