const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:';

function getKey() {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) throw new Error('FIELD_ENCRYPTION_KEY is not configured');
  // Accept a 64-char hex string (32 raw bytes); otherwise derive a 32-byte key from any string.
  return /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : crypto.createHash('sha256').update(raw).digest();
}

// Encrypts a field value for at-rest storage. Used as a Mongoose schema `set`,
// so it runs on every write regardless of whether reads later use `.lean()`.
function encryptField(plain) {
  if (plain === null || plain === undefined || plain === '') return plain;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

// Decrypts a field value. Must be called explicitly wherever the value is read
// back out for an authorized consumer — Mongoose getters are skipped by
// `.lean()` queries, which several routes in this codebase rely on, so this is
// not wired as a schema `get` to avoid silently-inconsistent behavior.
function decryptField(value) {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value; // not encrypted (legacy/plain or empty)
  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':');
  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encryptField, decryptField };
