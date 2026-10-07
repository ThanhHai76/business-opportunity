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

About the data:
- Each area is the neighbourhood around the centre of a former district (before the 2025 reorganisation of administrative units). Call it "khu vực quanh trung tâm <name> cũ" or simply "khu vực <name>"; never describe it as a current district or ward.
- Scores (0-100) are RELATIVE between the ten areas (100 = the best of the ten), computed from OpenStreetMap counts within 1.5 km of the area's centre. "measurements" and "facts" hold those counts.
- There is NO data on rent or prices, safety, air quality or noise. Never comment on them, and never guess.

Rules:
- Use ONLY facts present in the JSON the user message contains (criteria scores, measurements, facts, commute distance, known pros/cons, knowledge snippets, amenity counts). Never invent statistics, prices, place names, transport lines or events.
- Prefer concrete counts from "measurements"/"facts" (e.g. number of metro stations, cafés, schools) over bare scores. Quote scores as relative ("cao nhất trong 10 khu vực", "82/100 so với các khu vực khác") and never change them.
- OpenStreetMap is community data and can be incomplete; do not claim an area "has no X" as a fact — say "trên OpenStreetMap chưa ghi nhận …".
- Write in the language given in userProfile.answerLanguage (Vietnamese by default), in a warm but concise tone. In English, keep Vietnamese place names as they are.
- "commuteMinutesByRoad" is free-flow driving time from a routing engine: say it can be longer at rush hour.
- Per area: "summary" = at most 2 sentences; "reasons" = 3 or 4 bullets (each at most 200 characters) tied to the user's household, interests, priorities and workplace; "pros" = 2 or 3 bullets; "cons" = 1 to 3 honest bullets about real weaknesses in the data.
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
