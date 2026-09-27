'use strict';
/**
 * AIProvider abstraction for the Hanoi Business Copilot.
 *
 *   provider.name        'mock' | 'anthropic' | ...
 *   provider.model       model id, or null for the mock
 *   provider.explain({ task, question, facts }) -> Promise<Narrative | null>
 *
 * A Narrative is { summary, recommendation, evidence[], risks[], nextActions[] }. The provider only
 * WORDS the answer: every score and number comes from the deterministic engine (scoring.js) and is
 * passed in `facts`. `null` means "unavailable" and the caller falls back to the mock provider.
 *
 * To add OpenAI or Gemini later: implement a class with the same three members and register it in
 * PROVIDERS below — nothing else in the app changes.
 */
const { z } = require('zod');
const { createLogger } = require('../living-score/common/logger');

const logger = createLogger('BusinessCopilotAI');

const NarrativeSchema = z.object({
  summary: z.string(),
  recommendation: z.string(),
  evidence: z.array(z.string()),
  risks: z.array(z.string()),
  nextActions: z.array(z.string()),
});

const SYSTEM_PROMPT = `You are "Hanoi Business Copilot", a location-intelligence assistant that helps small businesses decide where to open in Hanoi.

Rules:
- Use ONLY the facts in the JSON the user message contains. Never invent districts, prices, statistics, competitor names or events.
- Every score and money figure was computed by a separate engine. Quote them if useful; never change them or add new ones.
- All data is DEMO / ESTIMATED data for an MVP. Never present it as real market data; say "theo dữ liệu demo" where natural.
- Answer in Vietnamese, concise and practical, like a senior retail-expansion consultant.
- "summary": 1-2 sentences answering the question directly. "recommendation": one sentence with the recommended action.
- "evidence": 2-4 bullets citing the facts. "risks": 1-3 honest bullets. "nextActions": 2-4 concrete next steps.`;

const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n);
const LEVEL_VI = { Low: 'thấp', Medium: 'trung bình', High: 'cao' };

/** Deterministic, template-based answers built from the engine's facts — always available. */
class MockAIProvider {
  constructor() {
    this.name = 'mock';
    this.model = null;
  }

  async explain({ task, facts }) {
    switch (task) {
      case 'location':
        return this.location(facts);
      case 'recommendations':
        return this.recommendations(facts);
      case 'compare':
        return this.compare(facts);
      case 'simulate':
        return this.simulate(facts);
      default:
        return this.general(facts);
    }
  }

  location(f) {
    const traits = [];
    if (f.scores.demand >= 80) traits.push('nhu cầu cao');
    if (f.scores.traffic >= 85) traits.push('lưu lượng khách ngày thường lớn');
    if (f.scores.accessibility >= 80) traits.push('kết nối giao thông công cộng tốt');
    if (f.scores.rent >= 70) traits.push('giá thuê dễ chịu');
    const traitText = traits.length ? traits.join(', ') : 'các chỉ số ở mức cân bằng';
    const competition =
      f.competitionLabel === 'High'
        ? 'Cạnh tranh cao, cần định vị khác biệt rõ ràng.'
        : f.competitionLabel === 'Medium'
          ? 'Cạnh tranh ở mức trung bình nhưng thị trường vẫn hấp dẫn cho mô hình có điểm khác biệt.'
          : 'Cạnh tranh thấp — cơ hội chiếm lĩnh sớm.';
    return {
      summary: `${f.name} phù hợp cho ${f.categoryVi.toLowerCase()} với Business Score ${f.totalScore}/100 nhờ ${traitText}. ${competition}`,
      recommendation: f.recommendation,
      evidence: [...f.evidence, `Doanh thu ước tính ~${f.revenuePotentialMillions} tr/tháng, hoà vốn ${f.breakEvenMonth ? `tháng ${f.breakEvenMonth}` : 'sau 18 tháng'} (ước tính)`],
      risks: f.risks.map((r) => r.text),
      nextActions: [
        'Khảo sát thực địa 2–3 mặt bằng trong khung giờ cao điểm',
        `Đàm phán hợp đồng thuê ${f.breakEvenMonth && f.breakEvenMonth <= 14 ? '3+ năm' : 'ngắn hạn có quyền gia hạn'}`,
        'Kiểm tra lại số liệu demo với dữ liệu thị trường thật trước khi đầu tư',
      ],
    };
  }

  recommendations(f) {
    const [first, second, third] = f.top;
    return {
      summary: `Với ${fmt(f.budgetMillions)} triệu VND cho ${f.categoryVi.toLowerCase()}, ${first.name} dẫn đầu (${first.businessScore}/100), tiếp theo là ${second.name} (${second.businessScore}) và ${third.name} (${third.businessScore}).`,
      recommendation: `Ưu tiên khảo sát ${first.name} trước, giữ ${second.name} làm phương án dự phòng.`,
      evidence: f.top.slice(0, 3).map((t) => `${t.name}: nhu cầu ${t.scores.demand}, cạnh tranh ${LEVEL_VI[t.competitionLabel]}, thuê ~${t.estRentMillions} tr/tháng`),
      risks: f.overBudget.length ? [`${f.overBudget.join(', ')} vượt ngân sách đầu tư ban đầu`] : ['Số liệu là ước tính demo — cần xác minh thực tế'],
      nextActions: ['Mở chi tiết khu vực đứng đầu', 'So sánh 3 khu vực hàng đầu', 'Chạy mô phỏng kinh doanh với số liệu của bạn'],
    };
  }

  compare(f) {
    return {
      summary: f.summary,
      recommendation: `Chọn ${f.winnerName} nếu ưu tiên tổng điểm; cân nhắc khu vực rẻ hơn nếu vốn hạn chế.`,
      evidence: f.metrics.filter((m) => m.best.length === 1).slice(0, 4).map((m) => `${m.label}: tốt nhất ở ${f.names[m.best[0]]}`),
      risks: ['Chênh lệch điểm nhỏ có thể nằm trong sai số của dữ liệu demo'],
      nextActions: ['Xem chi tiết từng khu vực', 'Mô phỏng doanh thu cho khu vực thắng'],
    };
  }

  simulate(f) {
    const best = f.results[0];
    return {
      summary: best
        ? `Mô phỏng cho thấy ${best.name} phù hợp nhất: lợi nhuận ước tính ${best.profitMillions} tr/tháng, hoà vốn ${best.breakEvenMonth ? `tháng ${best.breakEvenMonth}` : 'sau 18 tháng'}.`
        : 'Không có khu vực nào khớp các điều kiện đã nhập.',
      recommendation: best ? `Tập trung vào ${best.name}, mức rủi ro ${best.riskLevel.toLowerCase()}.` : 'Nới giới hạn tiền thuê hoặc tăng ngân sách rồi chạy lại.',
      evidence: f.results.slice(0, 3).map((r) => `${r.name}: doanh thu ~${r.revenueMillions} tr, chi phí ~${r.costMillions} tr/tháng`),
      risks: ['Toàn bộ con số là ước tính mô phỏng từ dữ liệu demo'],
      nextActions: ['Xuất báo cáo cơ hội kinh doanh', 'Đối chiếu giá thuê thực tế với môi giới'],
    };
  }

  general(f) {
    return {
      summary: f.summary ?? 'Tôi có thể giúp bạn chọn khu vực, so sánh các quận hoặc mô phỏng chi phí mở cửa hàng tại Hà Nội.',
      recommendation: f.recommendation ?? 'Hãy cho tôi biết loại hình kinh doanh và ngân sách, ví dụ: "Mở quán cà phê với 500 triệu".',
      evidence: f.evidence ?? [],
      risks: f.risks ?? [],
      nextActions: f.nextActions ?? ['Nhập ý tưởng kinh doanh ở Dashboard', 'Xem bản đồ nhu cầu'],
    };
  }
}

/** Claude writes the wording from the engine's facts. Returns null on any failure so the mock takes over. */
class AnthropicAIProvider {
  constructor({ apiKey, model, timeoutMs }) {
    const Anthropic = require('@anthropic-ai/sdk');
    this.Anthropic = Anthropic.default ?? Anthropic;
    this.client = new this.Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 1 });
    this.name = 'anthropic';
    this.model = model;
  }

  async explain({ task, question, facts }) {
    try {
      const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');
      const response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: 4_000,
        // Let the API re-run the request on a fallback model if a safety classifier declines it.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify({ task, question: question ?? null, facts }) }],
        output_config: { effort: 'low', format: zodOutputFormat(NarrativeSchema) },
      });
      if (response.stop_reason === 'refusal') {
        logger.warn('Model refused the request; using template text.');
        return null;
      }
      return response.parsed_output ?? null;
    } catch (error) {
      logger.warn(`AI provider failed (${error instanceof Error ? error.message : String(error)}); using template text.`);
      return null;
    }
  }
}

const PROVIDERS = {
  mock: () => new MockAIProvider(),
  anthropic: (config) => (config.anthropicApiKey ? new AnthropicAIProvider({ apiKey: config.anthropicApiKey, model: config.llmModel, timeoutMs: config.llmTimeoutMs }) : null),
};

/**
 * `config.aiProvider`: 'auto' (Anthropic when a key is set, otherwise mock), 'mock', or a name in PROVIDERS.
 * Returns { primary, fallback } — the fallback is always the mock.
 */
function createAIProvider(config) {
  const fallback = new MockAIProvider();
  const wanted = config.aiProvider ?? 'auto';
  if (wanted === 'mock') return { primary: fallback, fallback };
  if (wanted === 'auto') return { primary: PROVIDERS.anthropic(config) ?? fallback, fallback };
  const factory = PROVIDERS[wanted];
  if (!factory) throw new Error(`Unknown AI_PROVIDER "${wanted}". Available: auto, ${Object.keys(PROVIDERS).join(', ')}.`);
  return { primary: factory(config) ?? fallback, fallback };
}

/** Asks the primary provider and falls back to the mock; tells the caller which one answered. */
async function explainWithFallback(providers, request) {
  if (providers.primary !== providers.fallback) {
    const answer = await providers.primary.explain(request);
    if (answer) return { narrative: answer, provider: providers.primary.name, model: providers.primary.model };
  }
  const answer = await providers.fallback.explain(request);
  return { narrative: answer, provider: 'mock', model: null, fellBack: providers.primary !== providers.fallback };
}

module.exports = { MockAIProvider, AnthropicAIProvider, createAIProvider, explainWithFallback, PROVIDERS };
