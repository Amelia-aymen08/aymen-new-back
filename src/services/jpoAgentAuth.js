'use strict';
const crypto = require('node:crypto');

// Mots de passe des commerciaux : hash scrypt salé, jamais stockés en clair.
// Format : scrypt$<sel hex>$<hash hex>
const KEY_LEN = 64;
const scrypt = (password, salt) =>
  new Promise((resolve, reject) =>
    crypto.scrypt(String(password), salt, KEY_LEN, (err, key) => (err ? reject(err) : resolve(key))));

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const expected = Buffer.from(parts[2], 'hex');
  if (expected.length !== KEY_LEN) return false;
  const key = await scrypt(password, Buffer.from(parts[1], 'hex'));
  return crypto.timingSafeEqual(key, expected);
}

// Alphabet sans caractères ambigus (0/O, 1/l/I) : les mots de passe sont dictés ou recopiés à la main.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
function generatePassword(length = 10) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

module.exports = { hashPassword, verifyPassword, generatePassword };
