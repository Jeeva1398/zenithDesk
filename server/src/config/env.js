const MIN_SECRET_LENGTH = 32;

// A missing JWT_SECRET doesn't fail loudly — `jwt.sign` throws per-request
// while the process still reports healthy, and a short one signs tokens that
// are brute-forceable offline. Both are worth refusing to boot over, so this
// runs before the server starts listening rather than on first request.
function validateEnv() {
  const errors = [];

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    errors.push('JWT_SECRET is required');
  } else if (secret.length < MIN_SECRET_LENGTH) {
    errors.push(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters (got ${secret.length}) — generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }

  if (!process.env.DB_NAME) {
    errors.push('DB_NAME is required');
  }

  if (isProduction() && !process.env.CORS_ORIGINS) {
    errors.push('CORS_ORIGINS is required in production (comma-separated list of allowed origins)');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n  - ${errors.join('\n  - ')}`);
  }
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

// In development the client runs on whichever port Vite grabs, so the usual
// 5173-5175 range is allowed by default; production has no default and must
// name its origins explicitly (enforced above).
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];

function getCorsOrigins() {
  const configured = process.env.CORS_ORIGINS;
  if (configured) {
    return configured
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  return isProduction() ? [] : DEV_ORIGINS;
}

module.exports = { validateEnv, isProduction, getCorsOrigins };
