'use strict';
/**
 * AI settings shared by every tool that words answers with Claude (Opportunity Map, Future Map, Time Machine,
 * Property Intelligence). Without ANTHROPIC_API_KEY (or with AI_PROVIDER=mock) they answer from templates.
 */
function loadConfig(env = process.env) {
  return {
    aiProvider: env.AI_PROVIDER || 'auto',
    anthropicApiKey: env.ANTHROPIC_API_KEY || undefined,
    llmModel: env.LLM_MODEL || 'claude-opus-5',
    llmTimeoutMs: Number(env.LLM_TIMEOUT_MS) || 45_000,
  };
}

module.exports = { loadConfig };
