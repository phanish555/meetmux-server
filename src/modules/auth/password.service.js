const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../../config/env');

// bcryptjs — pure JS, no native compile. Cost 12 is defensible per OWASP.
// (argon2 would be stronger; documented in ADR-0013.)
const COST = 12;

// The pepper is an application secret from config, mixed in before bcrypt.
// If the DB is dumped without the server config, hashes stay useless.
function withPepper(plain) {
  return crypto
    .createHmac('sha256', config.auth.passwordPepper)
    .update(String(plain))
    .digest('hex');
}

async function hashPassword(plain) {
  return bcrypt.hash(withPepper(plain), COST);
}

async function verifyPassword(hash, plain) {
  try {
    return await bcrypt.compare(withPepper(plain), hash);
  } catch {
    return false;
  }
}

function needsRehash(hash) {
  try {
    const rounds = bcrypt.getRounds(hash);
    return rounds < COST;
  } catch {
    return true;
  }
}

module.exports = { hashPassword, verifyPassword, needsRehash };
