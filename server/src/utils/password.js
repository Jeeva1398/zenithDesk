const bcrypt = require('bcryptjs');
const ApiError = require('./ApiError');

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

// bcrypt silently truncates input past 72 bytes, so anything longer is
// accepted at signup and then only the first 72 bytes are ever checked at
// login. Rejecting it outright is clearer than hashing a prefix.
function assertPasswordPolicy(plain) {
  if (typeof plain !== 'string' || plain.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  if (Buffer.byteLength(plain, 'utf8') > MAX_PASSWORD_LENGTH) {
    throw new ApiError(400, `Password must be at most ${MAX_PASSWORD_LENGTH} bytes`);
  }
}

function hashPassword(plain) {
  assertPasswordPolicy(plain);
  return bcrypt.hash(plain, SALT_ROUNDS);
}

function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, comparePassword, assertPasswordPolicy, MIN_PASSWORD_LENGTH };
