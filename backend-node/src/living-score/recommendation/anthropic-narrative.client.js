'use strict';
const { z } = require('zod');
const { createLogger } = require('../common/logger');

const logger = createLogger('AnthropicNarrativeClient');

const NarrativeSchema = z.object({
  areas: z.array(
    z.object({
      slug: z.string(),
      summary: z.string(),
      reasons: z.array(z.string()),
      pros: z.array(z.string()),
      cons: z.array(z.string()),
    }),
  ),
});

const SYSTEM_PROMPT = `You write short, honest explanations of why each candidate Hanoi neighbourhood fits a person's housing preferences, for the "Hanoi Living Score" app.

Rules:
- Use ONLY facts present in the JSON the user message contains (criteria scores, rent, budget, commute distance, known pros/cons, knowledge snippets, amenity counts). Never invent statistics, prices, place names, transport lines or events.
- The numeric scores are computed by a separate scoring engine. Quote them if useful, but never change them or make up new ones.
- All data is SAMPLE / illustrative demo data. Never present it as official statistics. Phrase claims as "theo dữ liệu mẫu" where natural.
- Write in Vietnamese, in a warm but concise tone.
- Per area: "summary" = at most 2 sentences; "reasons" = 3 or 4 bullets (each at most 200 characters) tied to the user's household, interests, budget and priorities; "pros" = 2 or 3 bullets; "cons" = 1 to 3 honest bullets about real weaknesses in the data.
- Return exactly one entry per input area, using its exact "slug".`;

/**
 * Text-generation step of the recommendation (the "LLM" in LLM + RAG). It only rewords facts the
 * engine already computed. `generate()` returns null when the model is unavailable, refuses, or
 * returns something unusable — callers then fall back to rule-based text.
 */
class AnthropicNarrativeClient {
  constructor(config) {
    this.config = config;
    this.enabled = Boolean(config.anthropicApiKey);
    this.model = this.enabled ? config.llmModel : null;
    this.client = null;
    if (this.enabled) {
      const Anthropic = require('@anthropic-ai/sdk');
      this.Anthropic = Anthropic.default ?? Anthropic;
      this.client = new this.Anthropic({ apiKey: config.anthropicApiKey, timeout: config.llmTimeoutMs, maxRetries: 1 });
    }
  }

  /** @param context { household, interests, weightsPct } @param areas facts per candidate area */
  async generate(context, areas) {
    if (!this.client) return null;
    try {
      const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');
      const response = await this.client.beta.messages.parse({
        model: this.config.llmModel,
        max_tokens: 12_000,
        // Let the API re-run the request on a fallback model if a safety classifier declines it.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify({ userProfile: context, candidateAreas: areas }) }],
        output_config: { effort: 'medium', format: zodOutputFormat(NarrativeSchema) },
      });

      if (response.stop_reason === 'refusal') {
        logger.warn(`Model refused the request (${response.stop_details?.category ?? 'no category'}); using rule-based text.`);
        return null;
      }
      return response.parsed_output?.areas ?? null;
    } catch (error) {
      if (error instanceof this.Anthropic.APIError) {
        logger.warn(`Anthropic API error ${error.status ?? ''}: ${error.message}`);
      } else {
        logger.warn(`LLM call failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      return null;
    }
  }
}

module.exports = { AnthropicNarrativeClient };
