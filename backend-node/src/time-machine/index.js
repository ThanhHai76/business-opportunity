'use strict';
/**
 * Hanoi Time Machine API — mounted by server.js at /api/time-machine.
 *
 *   GET  /health
 *   POST /ask  { question, landmark?, era?, lang? }  AI Storyteller, grounded in landmarks.json (lang: 'vi' | 'en')
 *
 * The answer's sources are the sources of the landmarks it drew on (never written by the model).
 * Claude answers when ANTHROPIC_API_KEY is set (AI_PROVIDER=auto|anthropic); otherwise a template storyteller.
 */
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { HttpError, asyncHandler, badRequest, errorBody } = require('../living-score/common/http');
const { createLogger } = require('../living-score/common/logger');
const { loadConfig } = require('../business-copilot');
const { createStorytellers, tell, LANDMARK_KEYS, ERA_IDS } = require('./storyteller');

const logger = createLogger('TimeMachine');

const AskSchema = z.strictObject({
  question: z.string().trim().min(2).max(500),
  landmark: z.enum(LANDMARK_KEYS).optional(),
  era: z.enum(ERA_IDS).optional(),
  lang: z.enum(['vi', 'en']).default('vi'),
});

/** Small TTL cache so a repeated question does not call the model again. */
function createAnswerCache(ttlMs = 30 * 60_000, max = 300) {
  const store = new Map();
  return async (key, compute) => {
    const hit = store.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;
    const value = await compute();
    store.set(key, { value, expires: Date.now() + ttlMs });
    if (store.size > max) store.delete(store.keys().next().value);
    return value;
  };
}

/**
 * @param options.config        { aiProvider, anthropicApiKey, llmModel, llmTimeoutMs } (defaults from env)
 * @param options.storytellers  { primary, fallback } — replaces the storytellers (tests)
 * @param options.rateLimits    { global, ask } requests per minute per client (defaults 120 / 20)
 */
function createTimeMachine(options = {}) {
  const config = options.config ?? loadConfig();
  const storytellers = options.storytellers ?? createStorytellers(config);
  const limits = { global: 120, ask: 20, ...options.rateLimits };
  const cached = createAnswerCache();
  const tooMany = (req, res, next) => next(new HttpError(429, 'Bạn hỏi hơi nhanh. Vui lòng thử lại sau ít phút.'));

  const router = express.Router();
  router.use(helmet());
  router.use(rateLimit({ windowMs: 60_000, limit: limits.global, standardHeaders: true, legacyHeaders: false, handler: tooMany }));
  router.use(express.json({ limit: '4kb' }));

  const ai = { provider: storytellers.primary.name, model: storytellers.primary.model };
  router.get('/health', (req, res) => res.json({ status: 'ok', ai }));

  router.post(
    '/ask',
    rateLimit({ windowMs: 60_000, limit: limits.ask, standardHeaders: true, legacyHeaders: false, handler: tooMany }),
    asyncHandler(async (req, res) => {
      const parsed = AskSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        const details = parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
        throw badRequest(`Dữ liệu gửi lên không hợp lệ — ${details}`);
      }
      const body = parsed.data;
      const key = `${body.lang}|${body.question.toLowerCase()}|${body.landmark ?? ''}|${body.era ?? ''}`;
      res.json(await cached(key, () => tell(storytellers, body)));
    }),
  );

  router.use((req, res, next) => next(new HttpError(404, `Không tìm thấy đường dẫn ${req.method} ${req.originalUrl}.`)));

  // eslint-disable-next-line no-unused-vars
  router.use((err, req, res, next) => {
    let error = err;
    if (err?.type === 'entity.parse.failed') error = badRequest('Body JSON không hợp lệ.');
    else if (err?.type === 'entity.too.large') error = new HttpError(413, 'Body quá lớn.');
    const { status, body } = errorBody(error, req);
    if (status >= 500) logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, err);
    res.status(status).json(body);
  });

  return { router, config, storytellers };
}

module.exports = { createTimeMachine };
