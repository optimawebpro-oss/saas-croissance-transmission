const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');

if (KEY.length !== 32) {
  console.warn('[WARN] ENCRYPTION_KEY invalide ou absente — chiffrement désactivé en dev');
}

/**
 * Chiffre une chaîne ou un objet JSON avec AES-256-GCM
 * @param {string|object} data
 * @returns {string} payload chiffré (iv:tag:ciphertext en hex)
 */
function encrypt(data) {
  if (KEY.length !== 32) return JSON.stringify(data); // dev fallback
  const text = typeof data === 'object' ? JSON.stringify(data) : String(data);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

/**
 * Déchiffre un payload AES-256-GCM
 * @param {string} payload iv:tag:ciphertext
 * @returns {string|object}
 */
function decrypt(payload) {
  if (KEY.length !== 32) return JSON.parse(payload); // dev fallback
  const [ivHex, tagHex, encHex] = payload.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  try { return JSON.parse(decrypted); } catch { return decrypted; }
}

module.exports = { encrypt, decrypt };
