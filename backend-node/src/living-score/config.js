'use strict';
const { z } = require('zod');

const EnvSchema = z
  .object({
    DATA_SOURCE: z.enum(['postgres', 'memory']).default('memory'),
    DATABASE_URL: z.string().min(1).optional(),
    AUTO_SEED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    REDIS_URL: z.string().min(1).optional(),
    CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(300),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    LLM_MODEL: z.string().min(1).default('claude-opus-5'),
    LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).default(45_000),
  })
  .superRefine((env, ctx) => {
    if (env.DATA_SOURCE === 'postgres' && !env.DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'is required when DATA_SOURCE=postgres (or set DATA_SOURCE=memory)',
      });
    }
  });

/**
 * Parses the Living Score settings from the environment once, failing fast with a readable message.
 * Only the variables above are read, so the rest of the server's environment is left alone.
 */
function loadConfig(env = process.env) {
  // Treat empty strings (e.g. "REDIS_URL=") as "not set".
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ''));
  const parsed = EnvSchema.safeParse(cleaned);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`).join('\n');
    throw new Error(`Invalid Hanoi Living Score configuration:\n${details}`);
  }
  const e = parsed.data;
  return {
    dataSource: e.DATA_SOURCE,
    databaseUrl: e.DATABASE_URL,
    autoSeed: e.AUTO_SEED,
    redisUrl: e.REDIS_URL,
    cacheTtlSeconds: e.CACHE_TTL_SECONDS,
    anthropicApiKey: e.ANTHROPIC_API_KEY,
    llmModel: e.LLM_MODEL,
    llmTimeoutMs: e.LLM_TIMEOUT_MS,
  };
}

module.exports = { loadConfig };
