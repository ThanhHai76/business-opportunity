'use strict';
/** PostgreSQL account store (pg Pool). The schema (database/accounts/01-schema.sql) is applied by init(). */
const fs = require('node:fs');
const path = require('node:path');
const { conflict } = require('./errors');

const SCHEMA = path.join(__dirname, '..', '..', 'database', 'accounts', '01-schema.sql');

const toUser = (r) => r && { id: r.id, email: r.email, displayName: r.display_name, createdAt: r.created_at, lastLoginAt: r.last_login_at };
const toItem = (r) => ({ id: r.id, key: r.item_key, payload: r.payload, createdAt: r.created_at, updatedAt: r.updated_at });

class PostgresStore {
  /** @param pool a `pg` Pool */
  constructor(pool) {
    this.kind = 'postgres';
    this.pool = pool;
  }

  async init() {
    // Names, report text and icons are Vietnamese / emoji: a database in another encoding (e.g. WIN1252 from a
    // Windows initdb) would fail on the first save, so refuse to start instead.
    const { rows } = await this.pool.query('SHOW server_encoding');
    if (rows[0]?.server_encoding !== 'UTF8') {
      throw new Error(`Accounts database must use UTF8 encoding (found ${rows[0]?.server_encoding}); create it with ENCODING 'UTF8'.`);
    }
    await this.pool.query(fs.readFileSync(SCHEMA, 'utf8'));
  }

  async close() {
    await this.pool.end();
  }

  async createUser({ email, passwordHash, displayName }) {
    try {
      const { rows } = await this.pool.query(
        'INSERT INTO app_users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING *',
        [email, passwordHash, displayName ?? null],
      );
      return toUser(rows[0]);
    } catch (error) {
      if (error.code === '23505') throw conflict(); // unique violation on lower(email)
      throw error;
    }
  }

  async findUserByEmail(email) {
    const { rows } = await this.pool.query('SELECT * FROM app_users WHERE lower(email) = lower($1)', [email]);
    return rows[0] ? { ...toUser(rows[0]), passwordHash: rows[0].password_hash } : null;
  }

  async getUser(id) {
    const { rows } = await this.pool.query('SELECT * FROM app_users WHERE id = $1', [id]);
    return rows[0] ? { ...toUser(rows[0]), passwordHash: rows[0].password_hash } : null;
  }

  async updateUser(id, patch) {
    const sets = [];
    const params = [id];
    const add = (column, value) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (patch.displayName !== undefined) add('display_name', patch.displayName);
    if (patch.passwordHash !== undefined) add('password_hash', patch.passwordHash);
    if (patch.lastLoginAt !== undefined) add('last_login_at', patch.lastLoginAt);
    if (!sets.length) return toUser((await this.pool.query('SELECT * FROM app_users WHERE id = $1', [id])).rows[0]);
    const { rows } = await this.pool.query(`UPDATE app_users SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params);
    return toUser(rows[0]);
  }

  async deleteUser(id) {
    await this.pool.query('DELETE FROM app_users WHERE id = $1', [id]); // sessions and items cascade
  }

  async createSession({ tokenHash, userId, expiresAt, userAgent }) {
    await this.pool.query('INSERT INTO app_sessions (token_hash, user_id, expires_at, user_agent) VALUES ($1, $2, $3, $4)', [
      tokenHash,
      userId,
      expiresAt,
      userAgent ? userAgent.slice(0, 300) : null,
    ]);
  }

  async getSession(tokenHash) {
    const { rows } = await this.pool.query('SELECT user_id, expires_at, last_seen_at FROM app_sessions WHERE token_hash = $1', [tokenHash]);
    return rows[0] ? { userId: rows[0].user_id, expiresAt: rows[0].expires_at, lastSeenAt: rows[0].last_seen_at } : null;
  }

  async touchSession(tokenHash, at) {
    await this.pool.query('UPDATE app_sessions SET last_seen_at = $2 WHERE token_hash = $1', [tokenHash, at]);
  }

  async deleteSession(tokenHash) {
    await this.pool.query('DELETE FROM app_sessions WHERE token_hash = $1', [tokenHash]);
  }

  async deleteUserSessions(userId, exceptHash) {
    await this.pool.query('DELETE FROM app_sessions WHERE user_id = $1 AND token_hash IS DISTINCT FROM $2', [userId, exceptHash ?? null]);
  }

  async purgeExpiredSessions(now) {
    await this.pool.query('DELETE FROM app_sessions WHERE expires_at <= $1', [now]);
  }

  async listItems(userId, kind) {
    const { rows } = await this.pool.query('SELECT * FROM saved_items WHERE user_id = $1 AND kind = $2 ORDER BY updated_at DESC', [userId, kind]);
    return rows.map(toItem);
  }

  async putItem(userId, kind, key, payload, updatedAt) {
    const { rows } = await this.pool.query(
      `INSERT INTO saved_items (user_id, kind, item_key, payload, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $5)
       ON CONFLICT (user_id, kind, item_key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [userId, kind, key, JSON.stringify(payload), updatedAt],
    );
    return toItem(rows[0]);
  }

  async deleteItem(userId, kind, id) {
    const { rowCount } = await this.pool.query('DELETE FROM saved_items WHERE id = $1 AND user_id = $2 AND kind = $3', [id, userId, kind]);
    return rowCount > 0;
  }

  async deleteAllItems(userId, kind) {
    await this.pool.query('DELETE FROM saved_items WHERE user_id = $1 AND kind = $2', [userId, kind]);
  }

  async trimItems(userId, kind, max) {
    await this.pool.query(
      `DELETE FROM saved_items WHERE id IN (
         SELECT id FROM saved_items WHERE user_id = $1 AND kind = $2 ORDER BY updated_at DESC OFFSET $3)`,
      [userId, kind, max],
    );
  }
}

module.exports = { PostgresStore };
