'use strict';
const { z } = require('zod');
const { badRequest } = require('../common/http');
const { CRITERION_KEYS } = require('../scoring/criteria');
const { HOUSEHOLD_TYPES, INTEREST_KEYS } = require('./recommendation.types');

/** Priority 0 (ignore) … 5 (top priority) per criterion. Omitted = 3 (neutral). */
const PrioritiesSchema = z.strictObject(
  Object.fromEntries(CRITERION_KEYS.map((key) => [key, z.number().int().min(0).max(5).optional()])),
);

/** Strict on purpose: unknown fields are rejected instead of silently ignored. */
const RecommendationRequestSchema = z.strictObject({
  /** Monthly rent budget in VND. */
  budgetVnd: z.number().int().min(1_000_000).max(200_000_000),
  /** Slug of the area where the user works/studies (used for commute distance). */
  workplaceAreaSlug: z
    .string()
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  household: z.enum(HOUSEHOLD_TYPES),
  interests: z
    .array(z.enum(INTEREST_KEYS))
    .max(INTEREST_KEYS.length)
    .refine((items) => new Set(items).size === items.length, 'interests không được trùng lặp')
    .optional(),
  priorities: PrioritiesSchema.optional(),
  /** Set false to skip the LLM and get rule-based explanations only. */
  useAi: z.boolean().optional(),
});

/** Validates a request body; throws a 400 with a readable message. */
function parseRecommendationRequest(body) {
  const parsed = RecommendationRequestSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    throw badRequest(`Dữ liệu gửi lên không hợp lệ — ${details}`);
  }
  return parsed.data;
}

module.exports = { parseRecommendationRequest };
