'use strict';
/**
 * In-memory account store with the same interface as PostgresStore: for tests and local development without a
 * database (ACCOUNTS=memory). Everything is lost when the server stops.
 */
const crypto = require('node:crypto');
const { conflict, paymentRequired } = require('./errors');

class MemoryStore {
  constructor() {
    this.kind = 'memory';
    this.users = new Map();
    this.sessions = new Map();
    this.emailTokens = new Map(); // tokenHash -> { userId, purpose, email, createdAt, expiresAt, usedAt }
    this.items = new Map(); // id -> item
    this.orders = new Map(); // id -> order
    this.ledger = []; // { userId, delta, reason, orderId, reportId }
    this.paidReports = new Map(); // id -> report
    this.aiUsage = []; // { id, userId, tool, source, usedAt }
    this.aiLedger = []; // { userId, delta, reason, orderId, usageId }
    this.nextUsageId = 1;
    this.nextOrderCode = 100001;
  }

  async init() {}
  async close() {}

  async createUser({ email, passwordHash, displayName, termsAcceptedAt }) {
    if ([...this.users.values()].some((u) => u.email.toLowerCase() === email.toLowerCase())) throw conflict();
    const user = {
      id: crypto.randomUUID(),
      email,
      passwordHash,
      displayName: displayName ?? null,
      createdAt: new Date(),
      lastLoginAt: null,
      premiumUntil: null,
      emailVerifiedAt: null,
      termsAcceptedAt: termsAcceptedAt ?? null,
    };
    this.users.set(user.id, user);
    return publicUser(user);
  }

  async findUserByEmail(email) {
    const user = [...this.users.values()].find((u) => u.email.toLowerCase() === email.toLowerCase());
    return user ? { ...publicUser(user), passwordHash: user.passwordHash } : null;
  }

  async getUser(id) {
    const user = this.users.get(id);
    return user ? { ...publicUser(user), passwordHash: user.passwordHash } : null;
  }

  async updateUser(id, patch) {
    const user = this.users.get(id);
    if (!user) return null;
    if (patch.displayName !== undefined) user.displayName = patch.displayName;
    if (patch.passwordHash !== undefined) user.passwordHash = patch.passwordHash;
    if (patch.lastLoginAt !== undefined) user.lastLoginAt = patch.lastLoginAt;
    if (patch.emailVerifiedAt !== undefined) user.emailVerifiedAt = patch.emailVerifiedAt;
    return publicUser(user);
  }

  async deleteUser(id) {
    this.users.delete(id);
    for (const [hash, s] of this.sessions) if (s.userId === id) this.sessions.delete(hash);
    for (const [hash, t] of this.emailTokens) if (t.userId === id) this.emailTokens.delete(hash);
    for (const [itemId, it] of this.items) if (it.userId === id) this.items.delete(itemId);
    for (const o of this.orders.values()) if (o.userId === id) o.userId = null; // kept for the books
    this.ledger = this.ledger.filter((l) => l.userId !== id);
    for (const [reportId, r] of this.paidReports) if (r.userId === id) this.paidReports.delete(reportId);
    this.aiUsage = this.aiUsage.filter((u) => u.userId !== id);
    this.aiLedger = this.aiLedger.filter((l) => l.userId !== id);
  }

  async createSession({ tokenHash, userId, expiresAt, userAgent }) {
    this.sessions.set(tokenHash, { userId, expiresAt, lastSeenAt: new Date(), userAgent: userAgent ?? null });
  }

  async getSession(tokenHash) {
    const s = this.sessions.get(tokenHash);
    return s ? { ...s } : null;
  }

  async touchSession(tokenHash, at) {
    const s = this.sessions.get(tokenHash);
    if (s) s.lastSeenAt = at;
  }

  async deleteSession(tokenHash) {
    this.sessions.delete(tokenHash);
  }

  async deleteUserSessions(userId, exceptHash) {
    for (const [hash, s] of this.sessions) if (s.userId === userId && hash !== exceptHash) this.sessions.delete(hash);
  }

  async purgeExpiredSessions(now) {
    for (const [hash, s] of this.sessions) if (s.expiresAt <= now) this.sessions.delete(hash);
    for (const [hash, t] of this.emailTokens) if (t.expiresAt <= now) this.emailTokens.delete(hash);
  }

  // ---------------------------------------------------------------- one-time links sent by email
  /** Stores a token's hash; a user has at most one live token per purpose, so the older one stops working. */
  async createEmailToken({ tokenHash, userId, purpose, email, expiresAt }) {
    for (const [hash, t] of this.emailTokens) if (t.userId === userId && t.purpose === purpose) this.emailTokens.delete(hash);
    this.emailTokens.set(tokenHash, { userId, purpose, email, createdAt: new Date(), expiresAt, usedAt: null });
  }

  /** When the user's latest token of a purpose was made (null: none), to keep a mailbox from being flooded. */
  async lastEmailTokenAt(userId, purpose) {
    let last = null;
    for (const t of this.emailTokens.values()) if (t.userId === userId && t.purpose === purpose && (!last || t.createdAt > last)) last = t.createdAt;
    return last;
  }

  /** Uses a token (once): { userId, email } while it is unused and not expired, otherwise null. */
  async consumeEmailToken(tokenHash, purpose, now) {
    const t = this.emailTokens.get(tokenHash);
    if (!t || t.purpose !== purpose || t.usedAt || t.expiresAt <= now) return null;
    t.usedAt = now;
    return { userId: t.userId, email: t.email };
  }

  async listItems(userId, kind) {
    return [...this.items.values()]
      .filter((it) => it.userId === userId && it.kind === kind)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(publicItem);
  }

  async putItem(userId, kind, key, payload, updatedAt) {
    let item = [...this.items.values()].find((it) => it.userId === userId && it.kind === kind && it.key === key);
    if (item) Object.assign(item, { payload, updatedAt });
    else {
      item = { id: crypto.randomUUID(), userId, kind, key, payload, createdAt: updatedAt, updatedAt };
      this.items.set(item.id, item);
    }
    return publicItem(item);
  }

  async deleteItem(userId, kind, id) {
    const item = this.items.get(id);
    if (!item || item.userId !== userId || item.kind !== kind) return false;
    this.items.delete(id);
    return true;
  }

  async deleteAllItems(userId, kind) {
    for (const [id, it] of this.items) if (it.userId === userId && it.kind === kind) this.items.delete(id);
  }

  /** Keeps the `max` most recent items of a kind. */
  async trimItems(userId, kind, max) {
    const list = await this.listItems(userId, kind);
    for (const it of list.slice(max)) this.items.delete(it.id);
  }

  // ---------------------------------------------------------------- purchases and paid reports
  async createOrder({ userId, product, credits, grants, amountVnd, provider, expiresAt }) {
    const order = {
      id: crypto.randomUUID(),
      orderCode: this.nextOrderCode++,
      userId,
      product,
      credits,
      grants: grants ?? null,
      amountVnd,
      provider,
      status: 'pending',
      providerRef: null,
      createdAt: new Date(),
      expiresAt,
      paidAt: null,
    };
    this.orders.set(order.id, order);
    return { ...order };
  }

  async setOrderProviderRef(id, providerRef) {
    const order = this.orders.get(id);
    if (!order) return null;
    order.providerRef = providerRef;
    return { ...order };
  }

  async getOrder(id) {
    const order = this.orders.get(id);
    return order ? { ...order } : null;
  }

  async getOrderByCode(orderCode) {
    const order = [...this.orders.values()].find((o) => o.orderCode === orderCode);
    return order ? { ...order } : null;
  }

  async listOrders(userId, limit) {
    return [...this.orders.values()]
      .filter((o) => o.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map((o) => ({ ...o }));
  }

  async cancelOrder(userId, id) {
    const order = this.orders.get(id);
    if (!order || order.userId !== userId) return null;
    if (order.status === 'pending') order.status = 'cancelled';
    return { ...order };
  }

  async markOrderPaid(orderCode, { amountVnd, providerRef, paidAt }) {
    const order = [...this.orders.values()].find((o) => o.orderCode === orderCode);
    if (!order) return { order: null, credited: false };
    if (order.status === 'paid') return { order: { ...order }, credited: false };
    if (order.amountVnd !== amountVnd) return { order: { ...order }, credited: false, mismatch: true };
    Object.assign(order, { status: 'paid', paidAt, providerRef: providerRef ?? order.providerRef });
    const user = order.userId ? this.users.get(order.userId) : null;
    if (user) {
      const g = order.grants ?? { reportCredits: order.credits };
      if (g.reportCredits > 0) this.ledger.push({ userId: user.id, delta: g.reportCredits, reason: 'purchase', orderId: order.id, reportId: null });
      if (g.aiCredits > 0) this.aiLedger.push({ userId: user.id, delta: g.aiCredits, reason: 'purchase', orderId: order.id, usageId: null });
      if (g.premiumDays > 0) {
        const from = user.premiumUntil && user.premiumUntil > paidAt ? user.premiumUntil : paidAt;
        user.premiumUntil = new Date(from.getTime() + g.premiumDays * 86_400_000);
      }
    }
    return { order: { ...order }, credited: Boolean(user) };
  }

  async creditBalance(userId) {
    return this.balanceOf(userId);
  }

  balanceOf(userId) {
    return this.ledger.filter((l) => l.userId === userId).reduce((sum, l) => sum + l.delta, 0);
  }

  async createPaidReport(userId, { kind, title, input, content }) {
    // No await between the check and the spend: two reports created at once cannot use the same credit.
    const balance = this.balanceOf(userId);
    if (balance < 1) throw paymentRequired();
    const report = { id: crypto.randomUUID(), userId, kind, title, input, content, createdAt: new Date() };
    this.paidReports.set(report.id, report);
    this.ledger.push({ userId, delta: -1, reason: 'report', orderId: null, reportId: report.id });
    return { report: publicPaidReport(report), credits: balance - 1 };
  }

  // ---------------------------------------------------------------- in-depth AI questions and Premium
  aiCreditsOf(userId) {
    return this.aiLedger.filter((l) => l.userId === userId).reduce((sum, l) => sum + l.delta, 0);
  }

  /** Today's answers by allowance; the free ones of the `storyTools` are counted apart (`freeStory`). */
  usedToday(userId, dayStart, storyTools = []) {
    const used = { free: 0, freeStory: 0, premium: 0, credit: 0 };
    for (const u of this.aiUsage) {
      if (u.userId !== userId || u.usedAt < dayStart) continue;
      used[u.source === 'free' && storyTools.includes(u.tool) ? 'freeStory' : u.source]++;
    }
    return used;
  }

  /** When the user's Premium ends (see PostgresStore.premiumUntil). */
  async premiumUntil(userId) {
    return this.users.get(userId)?.premiumUntil ?? null;
  }

  /** Premium end, AI credits and today's use (see PostgresStore.aiStatus). */
  async aiStatus(userId, { now, dayStart, storyTools = [] }) {
    const user = this.users.get(userId);
    if (!user) return null;
    return { premiumUntil: user.premiumUntil, aiCredits: this.aiCreditsOf(userId), used: this.usedToday(userId, dayStart, storyTools) };
  }

  /** Records one in-depth AI answer against the first allowance that has room (see PostgresStore.spendAi). */
  async spendAi(userId, { tool, now, dayStart, freePerDay, storyFreePerDay = freePerDay, premiumPerDay, storyTools = [] }) {
    // No await between the check and the record: two questions at once cannot use the same allowance.
    const user = this.users.get(userId);
    if (!user) return { ok: false };
    const used = this.usedToday(userId, dayStart, storyTools);
    const premium = Boolean(user.premiumUntil && user.premiumUntil > now);
    const story = storyTools.includes(tool);
    let source = null;
    if (premium && used.premium < premiumPerDay) source = 'premium';
    else if ((story ? used.freeStory : used.free) < (story ? storyFreePerDay : freePerDay)) source = 'free';
    else if (this.aiCreditsOf(userId) > 0) source = 'credit';
    if (!source) return { ok: false };
    const usage = { id: this.nextUsageId++, userId, tool, source, usedAt: now };
    this.aiUsage.push(usage);
    if (source === 'credit') this.aiLedger.push({ userId, delta: -1, reason: 'use', orderId: null, usageId: usage.id });
    return { ok: true, source, usageId: usage.id };
  }

  /** Gives back an answer that was recorded but not given by the AI (it failed and the template answered). */
  async refundAi(userId, usageId) {
    this.aiUsage = this.aiUsage.filter((u) => !(u.userId === userId && u.id === usageId));
    this.aiLedger = this.aiLedger.filter((l) => !(l.userId === userId && l.usageId === usageId && l.reason === 'use'));
  }

  async listPaidReports(userId, limit) {
    return [...this.paidReports.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map(({ content, ...r }) => publicPaidReport(r));
  }

  async getPaidReport(userId, id) {
    const report = this.paidReports.get(id);
    return report && report.userId === userId ? publicPaidReport(report) : null;
  }
}

const publicPaidReport = (r) => ({ id: r.id, kind: r.kind, title: r.title, input: r.input, content: r.content, createdAt: r.createdAt });

const publicUser = (u) => ({ id: u.id, email: u.email, displayName: u.displayName, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, emailVerifiedAt: u.emailVerifiedAt ?? null, termsAcceptedAt: u.termsAcceptedAt ?? null });
const publicItem = (it) => ({ id: it.id, key: it.key, payload: it.payload, createdAt: it.createdAt, updatedAt: it.updatedAt });

module.exports = { MemoryStore };
