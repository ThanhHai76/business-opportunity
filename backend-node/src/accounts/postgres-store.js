'use strict';
/** PostgreSQL account store (pg Pool). The schema (database/accounts/*.sql) is applied by init(). */
const fs = require('node:fs');
const path = require('node:path');
const { conflict, paymentRequired } = require('./errors');

// Applied in order on start: accounts and saved items, purchases and paid reports, then AI questions and Premium.
const SCHEMAS = ['01-schema.sql', '02-billing.sql', '03-ai-premium.sql', '04-email-terms.sql', '05-broker-brand.sql', '06-career.sql', '07-data-reports.sql'].map((f) => path.join(__dirname, '..', '..', 'database', 'accounts', f));

const toUser = (r) => r && { id: r.id, email: r.email, displayName: r.display_name, createdAt: r.created_at, lastLoginAt: r.last_login_at, emailVerifiedAt: r.email_verified_at, termsAcceptedAt: r.terms_accepted_at };
const toItem = (r) => ({ id: r.id, key: r.item_key, payload: r.payload, createdAt: r.created_at, updatedAt: r.updated_at });

/**
 * Today's in-depth AI answers by allowance (`db` is the pool or a transaction's client). The free answers of the
 * `storyTools` are counted apart, as `freeStory`: those tools have a free allowance of their own.
 */
async function usedToday(db, userId, dayStart, storyTools) {
  const { rows } = await db.query(
    `SELECT source, (tool = ANY($3::text[])) AS story, count(*)::int AS n
     FROM ai_usage WHERE user_id = $1 AND used_at >= $2 GROUP BY source, story`,
    [userId, dayStart, storyTools],
  );
  const used = { free: 0, freeStory: 0, premium: 0, credit: 0 };
  for (const r of rows) used[r.source === 'free' && r.story ? 'freeStory' : r.source] += r.n;
  return used;
}

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
    for (const file of SCHEMAS) await this.pool.query(fs.readFileSync(file, 'utf8'));
  }

  async close() {
    await this.pool.end();
  }

  async createUser({ email, passwordHash, displayName, termsAcceptedAt }) {
    try {
      const { rows } = await this.pool.query(
        'INSERT INTO app_users (email, password_hash, display_name, terms_accepted_at) VALUES ($1, $2, $3, $4) RETURNING *',
        [email, passwordHash, displayName ?? null, termsAcceptedAt ?? null],
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
    if (patch.emailVerifiedAt !== undefined) add('email_verified_at', patch.emailVerifiedAt);
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
    await this.pool.query('DELETE FROM app_email_tokens WHERE expires_at <= $1', [now]);
  }

  // ---------------------------------------------------------------- one-time links sent by email (04-email-terms.sql)
  /** Stores a token's hash; a user has at most one live token per purpose, so the older one stops working. */
  async createEmailToken({ tokenHash, userId, purpose, email, expiresAt }) {
    await this.transaction(async (client) => {
      await client.query('DELETE FROM app_email_tokens WHERE user_id = $1 AND purpose = $2', [userId, purpose]);
      await client.query('INSERT INTO app_email_tokens (token_hash, user_id, purpose, email, expires_at) VALUES ($1, $2, $3, $4, $5)', [tokenHash, userId, purpose, email, expiresAt]);
    });
  }

  /** When the user's latest token of a purpose was made (null: none), to keep a mailbox from being flooded. */
  async lastEmailTokenAt(userId, purpose) {
    const { rows } = await this.pool.query('SELECT max(created_at) AS at FROM app_email_tokens WHERE user_id = $1 AND purpose = $2', [userId, purpose]);
    return rows[0].at ?? null;
  }

  /** Uses a token (once): { userId, email } while it is unused and not expired, otherwise null. One statement, so two clicks race safely. */
  async consumeEmailToken(tokenHash, purpose, now) {
    const { rows } = await this.pool.query(
      'UPDATE app_email_tokens SET used_at = $3 WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > $3 RETURNING user_id, email',
      [tokenHash, purpose, now],
    );
    return rows[0] ? { userId: rows[0].user_id, email: rows[0].email } : null;
  }

  async listItems(userId, kind) {
    const { rows } = await this.pool.query('SELECT * FROM saved_items WHERE user_id = $1 AND kind = $2 ORDER BY updated_at DESC', [userId, kind]);
    return rows.map(toItem);
  }

  /** A report of a wrong figure (src/feedback). */
  async addDataReport({ kind, target, targetName, page, message, contact, userId }) {
    const { rows } = await this.pool.query(
      `INSERT INTO data_reports (kind, target, target_name, page, message, contact, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
      [kind, target, targetName, page, message, contact, userId],
    );
    return { id: rows[0].id, createdAt: rows[0].created_at };
  }

  /** What else the account holds, for the data export: AI questions asked, and the reports of wrong figures it sent. */
  async exportExtras(userId) {
    const [usage, reports] = await Promise.all([
      this.pool.query('SELECT tool, source, used_at FROM ai_usage WHERE user_id = $1 ORDER BY used_at DESC LIMIT 5000', [userId]),
      this.pool.query('SELECT kind, target, target_name, page, message, contact, status, created_at FROM data_reports WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1000', [userId]),
    ]);
    return {
      aiUsage: usage.rows.map((r) => ({ tool: r.tool, source: r.source, usedAt: r.used_at })),
      dataReports: reports.rows.map((r) => ({ kind: r.kind, target: r.target, targetName: r.target_name, page: r.page, message: r.message, contact: r.contact, status: r.status, createdAt: r.created_at })),
    };
  }

  async listDataReports(limit = 50) {
    const { rows } = await this.pool.query('SELECT id, kind, target, target_name, page, message, contact, status, created_at FROM data_reports ORDER BY created_at DESC LIMIT $1', [limit]);
    return rows;
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

  // ---------------------------------------------------------------- purchases and paid reports (02-billing.sql)
  async createOrder({ userId, product, credits, grants, amountVnd, provider, expiresAt }) {
    const { rows } = await this.pool.query(
      `INSERT INTO billing_orders (user_id, product, credits, grants, amount_vnd, provider, expires_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7) RETURNING *`,
      [userId, product, credits, grants ? JSON.stringify(grants) : null, amountVnd, provider, expiresAt],
    );
    return toOrder(rows[0]);
  }

  async setOrderProviderRef(id, providerRef) {
    const { rows } = await this.pool.query('UPDATE billing_orders SET provider_ref = $2 WHERE id = $1 RETURNING *', [id, providerRef]);
    return rows[0] ? toOrder(rows[0]) : null;
  }

  async getOrder(id) {
    const { rows } = await this.pool.query('SELECT * FROM billing_orders WHERE id = $1', [id]);
    return rows[0] ? toOrder(rows[0]) : null;
  }

  async getOrderByCode(orderCode) {
    const { rows } = await this.pool.query('SELECT * FROM billing_orders WHERE order_code = $1', [orderCode]);
    return rows[0] ? toOrder(rows[0]) : null;
  }

  async listOrders(userId, limit) {
    const { rows } = await this.pool.query('SELECT * FROM billing_orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [userId, limit]);
    return rows.map(toOrder);
  }

  /** Cancels the user's pending order; returns the order as it now is (null: not theirs). */
  async cancelOrder(userId, id) {
    const { rows } = await this.pool.query(
      `UPDATE billing_orders SET status = 'cancelled' WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING *`,
      [id, userId],
    );
    if (rows[0]) return toOrder(rows[0]);
    const order = await this.getOrder(id);
    return order && order.userId === userId ? order : null;
  }

  /**
   * Records the payment of an order and adds what it grants (report credits, AI credits, Premium days), once: a
   * repeated webhook finds the order paid and changes nothing. A different amount is not credited (`mismatch`), so it
   * can be checked by hand.
   * @returns { order: Order|null, credited: boolean, mismatch?: true }
   */
  async markOrderPaid(orderCode, { amountVnd, providerRef, paidAt }) {
    return this.transaction(async (client) => {
      const found = (await client.query('SELECT * FROM billing_orders WHERE order_code = $1 FOR UPDATE', [orderCode])).rows[0];
      if (!found) return { order: null, credited: false };
      if (found.status === 'paid') return { order: toOrder(found), credited: false };
      if (Number(found.amount_vnd) !== amountVnd) return { order: toOrder(found), credited: false, mismatch: true };
      const { rows } = await client.query(
        `UPDATE billing_orders SET status = 'paid', paid_at = $2, provider_ref = COALESCE($3, provider_ref) WHERE id = $1 RETURNING *`,
        [found.id, paidAt, providerRef ?? null],
      );
      if (found.user_id) {
        const g = found.grants ?? { reportCredits: found.credits };
        if (g.reportCredits > 0) {
          await client.query(`INSERT INTO credit_ledger (user_id, delta, reason, order_id) VALUES ($1, $2, 'purchase', $3)`, [found.user_id, g.reportCredits, found.id]);
        }
        if (g.aiCredits > 0) {
          await client.query(`INSERT INTO ai_credit_ledger (user_id, delta, reason, order_id) VALUES ($1, $2, 'purchase', $3)`, [found.user_id, g.aiCredits, found.id]);
        }
        if (g.premiumDays > 0) {
          // Extends from the current end when Premium is still running, from the payment otherwise.
          await client.query(
            `UPDATE app_users SET premium_until = GREATEST(COALESCE(premium_until, $2::timestamptz), $2::timestamptz) + make_interval(days => $3::int) WHERE id = $1`,
            [found.user_id, paidAt, g.premiumDays],
          );
        }
      }
      return { order: toOrder(rows[0]), credited: Boolean(found.user_id) };
    });
  }

  async creditBalance(userId) {
    const { rows } = await this.pool.query('SELECT COALESCE(SUM(delta), 0)::int AS n FROM credit_ledger WHERE user_id = $1', [userId]);
    return rows[0].n;
  }

  /** Saves a paid report and uses one credit, both or neither (402 without a credit). */
  async createPaidReport(userId, { kind, title, input, content }) {
    return this.transaction(async (client) => {
      // Locks the user's row: two reports created at once cannot spend the same credit.
      await client.query('SELECT id FROM app_users WHERE id = $1 FOR UPDATE', [userId]);
      const balance = (await client.query('SELECT COALESCE(SUM(delta), 0)::int AS n FROM credit_ledger WHERE user_id = $1', [userId])).rows[0].n;
      if (balance < 1) throw paymentRequired();
      const { rows } = await client.query(
        'INSERT INTO paid_reports (user_id, kind, title, input, content) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb) RETURNING *',
        [userId, kind, title, JSON.stringify(input), JSON.stringify(content)],
      );
      await client.query(`INSERT INTO credit_ledger (user_id, delta, reason, report_id) VALUES ($1, -1, 'report', $2)`, [userId, rows[0].id]);
      return { report: toPaidReport(rows[0]), credits: balance - 1 };
    });
  }

  // ---------------------------------------------------------------- in-depth AI questions and Premium (03-ai-premium.sql)
  /** When the user's Premium ends (null: never had it, or no such user). Used to open Premium-only data. */
  async premiumUntil(userId) {
    const { rows } = await this.pool.query('SELECT premium_until FROM app_users WHERE id = $1', [userId]);
    return rows[0]?.premium_until ?? null;
  }

  /**
   * Premium end, bought AI credits left, and today's in-depth AI answers by allowance.
   * The free answers of the `storyTools` are counted apart (`freeStory`): they have an allowance of their own.
   * @returns { premiumUntil: Date|null, aiCredits: number, used: { free, freeStory, premium, credit } } | null (no such user)
   */
  async aiStatus(userId, { dayStart, storyTools = [] }) {
    const { rows } = await this.pool.query(
      `SELECT u.premium_until,
              (SELECT COALESCE(SUM(delta), 0)::int FROM ai_credit_ledger WHERE user_id = u.id) AS ai_credits
       FROM app_users u WHERE u.id = $1`,
      [userId],
    );
    if (!rows[0]) return null;
    return { premiumUntil: rows[0].premium_until, aiCredits: rows[0].ai_credits, used: await usedToday(this.pool, userId, dayStart, storyTools) };
  }

  /**
   * Records one in-depth AI answer against the first allowance with room: Premium (while active), the free daily
   * allowance, then one bought AI credit. Both or neither: the answer is recorded only with something to pay for it.
   * @returns { ok: true, source: 'premium'|'free'|'credit', usageId } | { ok: false }
   */
  async spendAi(userId, { tool, now, dayStart, freePerDay, storyFreePerDay = freePerDay, premiumPerDay, storyTools = [] }) {
    return this.transaction(async (client) => {
      // Locks the user's row: two questions at once cannot use the same allowance or credit.
      const user = (await client.query('SELECT premium_until FROM app_users WHERE id = $1 FOR UPDATE', [userId])).rows[0];
      if (!user) return { ok: false };
      const used = await usedToday(client, userId, dayStart, storyTools);
      const premium = Boolean(user.premium_until && new Date(user.premium_until) > now);
      const story = storyTools.includes(tool);
      let source = null;
      if (premium && used.premium < premiumPerDay) source = 'premium';
      else if ((story ? used.freeStory : used.free) < (story ? storyFreePerDay : freePerDay)) source = 'free';
      else {
        const balance = (await client.query('SELECT COALESCE(SUM(delta), 0)::int AS n FROM ai_credit_ledger WHERE user_id = $1', [userId])).rows[0].n;
        if (balance > 0) source = 'credit';
      }
      if (!source) return { ok: false };
      const { rows } = await client.query('INSERT INTO ai_usage (user_id, tool, source, used_at) VALUES ($1, $2, $3, $4) RETURNING id', [userId, tool, source, now]);
      const usageId = Number(rows[0].id);
      if (source === 'credit') await client.query(`INSERT INTO ai_credit_ledger (user_id, delta, reason, usage_id) VALUES ($1, -1, 'use', $2)`, [userId, usageId]);
      return { ok: true, source, usageId };
    });
  }

  /** Gives back an answer that was recorded but not given by the AI (it failed and the template answered). */
  async refundAi(userId, usageId) {
    await this.transaction(async (client) => {
      await client.query(`DELETE FROM ai_credit_ledger WHERE user_id = $1 AND usage_id = $2 AND reason = 'use'`, [userId, usageId]);
      await client.query('DELETE FROM ai_usage WHERE user_id = $1 AND id = $2', [userId, usageId]);
    });
  }

  async listPaidReports(userId, limit) {
    const { rows } = await this.pool.query(
      'SELECT id, kind, title, input, created_at FROM paid_reports WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit],
    );
    return rows.map(toPaidReport);
  }

  async getPaidReport(userId, id) {
    const { rows } = await this.pool.query('SELECT * FROM paid_reports WHERE id = $1 AND user_id = $2', [id, userId]);
    return rows[0] ? toPaidReport(rows[0]) : null;
  }

  async transaction(work) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}

const toOrder = (r) => ({
  id: r.id,
  orderCode: Number(r.order_code),
  userId: r.user_id,
  product: r.product,
  credits: r.credits,
  grants: r.grants ?? null,
  amountVnd: Number(r.amount_vnd),
  provider: r.provider,
  status: r.status,
  providerRef: r.provider_ref,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  paidAt: r.paid_at,
});
const toPaidReport = (r) => ({ id: r.id, kind: r.kind, title: r.title, input: r.input, content: r.content, createdAt: r.created_at });

module.exports = { PostgresStore };
