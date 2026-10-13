'use strict';
/**
 * Password hashing with scrypt (node:crypto, no native add-on). Stored as `scrypt$N$r$p$salt$hash` (base64url), so
 * the cost can be raised later and old hashes still verify.
 */
const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const COST = { N: 2 ** 15, r: 8, p: 1 };
const KEY_LEN = 64;
// 32 MiB for N = 2^15, r = 8 (128·N·r bytes), above Node's 32 MiB default limit.
const maxmem = (N, r) => 128 * N * r * 2;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, KEY_LEN, { ...COST, maxmem: maxmem(COST.N, COST.r) });
  return ['scrypt', COST.N, COST.r, COST.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

async function verifyPassword(password, stored) {
  const [scheme, n, r, p, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const N = Number(n);
  const R = Number(r);
  const expected = Buffer.from(hash, 'base64url');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64url'), expected.length, { N, r: R, p: Number(p), maxmem: maxmem(N, R) });
  return crypto.timingSafeEqual(key, expected);
}

/** A hash to verify against when the email is unknown, so a wrong email takes as long as a wrong password. */
let dummy;
async function dummyHash() {
  dummy ??= hashPassword(crypto.randomBytes(18).toString('base64url'));
  return dummy;
}

module.exports = { hashPassword, verifyPassword, dummyHash };
