'use strict';
/**
 * In-memory account store with the same interface as PostgresStore: for tests and local development without a
 * database (ACCOUNTS=memory). Everything is lost when the server stops.
 */
const crypto = require('node:crypto');
const { conflict } = require('./errors');

class MemoryStore {
  constructor() {
    this.kind = 'memory';
    this.users = new Map();
    this.sessions = new Map();
    this.items = new Map(); // id -> item
  }

  async init() {}
  async close() {}

  async createUser({ email, passwordHash, displayName }) {
    if ([...this.users.values()].some((u) => u.email.toLowerCase() === email.toLowerCase())) throw conflict();
    const user = { id: crypto.randomUUID(), email, passwordHash, displayName: displayName ?? null, createdAt: new Date(), lastLoginAt: null };
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
    return publicUser(user);
  }

  async deleteUser(id) {
    this.users.delete(id);
    for (const [hash, s] of this.sessions) if (s.userId === id) this.sessions.delete(hash);
    for (const [itemId, it] of this.items) if (it.userId === id) this.items.delete(itemId);
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
}

const publicUser = (u) => ({ id: u.id, email: u.email, displayName: u.displayName, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt });
const publicItem = (it) => ({ id: it.id, key: it.key, payload: it.payload, createdAt: it.createdAt, updatedAt: it.updatedAt });

module.exports = { MemoryStore };
