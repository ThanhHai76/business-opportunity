'use strict';
const { CRITERION_KEYS } = require('../scoring/criteria');

class CompareService {
  constructor(areas, scoring) {
    this.areas = areas;
    this.scoring = scoring;
  }

  /** Two or three areas side by side: per-criterion values, the best area(s) for each criterion, and the best overall. */
  async compare(slugs, weights) {
    const records = await Promise.all(slugs.map((slug) => this.areas.getRecordOrThrow(slug)));
    const summaries = records.map((record) => this.areas.toSummary(record, weights));

    const criteria = CRITERION_KEYS.map((criterion) => {
      const values = Object.fromEntries(summaries.map((s) => [s.slug, s.scores[criterion]]));
      const top = Math.max(...Object.values(values));
      return { criterion, values, best: summaries.filter((s) => s.scores[criterion] === top).map((s) => s.slug) };
    });

    const bestOverall = [...summaries].sort((a, b) => b.livingScore - a.livingScore)[0].slug;
    return {
      areas: summaries,
      criteria,
      bestOverall,
      meta: { isPersonalized: this.scoring.isPersonalized(weights), sampleData: true },
    };
  }
}

module.exports = { CompareService };
