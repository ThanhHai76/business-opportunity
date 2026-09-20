'use strict';
const { CRITERION_KEYS } = require('../scoring/criteria');
const { INTEREST_EFFECTS } = require('./recommendation.types');

const TOPIC_FOR_CRITERION = {
  transportation: 'transport',
  education: 'family',
  healthcare: 'family',
  safety: 'family',
  greenSpace: 'environment',
  environment: 'environment',
  amenities: 'lifestyle',
  cost: 'cost',
};

/**
 * Retrieval step of the RAG pipeline: picks the knowledge snippets most relevant to what the user
 * cares about. It is lexical/topic based on purpose (no embeddings needed for the MVP); swap the
 * ranking for pgvector similarity search when the knowledge base grows.
 */
class KnowledgeService {
  constructor(data) {
    this.data = data;
  }

  /** @returns Map<areaId, KnowledgeRecord[]> */
  async retrieve(areaIds, profile, perArea = 3) {
    const topicWeight = this.topicWeights(profile);
    const records = await this.data.listKnowledge(areaIds);
    const grouped = new Map();
    for (const areaId of areaIds) {
      const ranked = records
        .filter((r) => r.areaId === areaId)
        .sort((a, b) => (topicWeight.get(b.topic) ?? 0) - (topicWeight.get(a.topic) ?? 0) || a.id - b.id)
        .slice(0, perArea);
      grouped.set(areaId, ranked);
    }
    return grouped;
  }

  topicWeights(profile) {
    const weights = new Map([['overview', 5]]);
    const add = (topic, amount) => weights.set(topic, (weights.get(topic) ?? 0) + amount);
    for (const key of CRITERION_KEYS) add(TOPIC_FOR_CRITERION[key], profile.weights[key]);
    if (profile.household === 'family_with_kids') add('family', 15);
    for (const interest of profile.interests) add(TOPIC_FOR_CRITERION[INTEREST_EFFECTS[interest].criterion], 10);
    return weights;
  }
}

module.exports = { KnowledgeService };
