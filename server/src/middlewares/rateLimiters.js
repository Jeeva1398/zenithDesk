const rateLimit = require('express-rate-limit');
const ApiError = require('../utils/ApiError');

// express-rate-limit sends its own plain response by default, which would be
// the one place in the API that doesn't match the errorHandler's shape. Route
// it through ApiError instead so clients see the same `{ error }` body here as
// everywhere else.
function rejectWith(message) {
  return (req, res, next) => next(new ApiError(429, message));
}

const common = {
  standardHeaders: true,
  legacyHeaders: false,
};

// Broad backstop against scripted traffic. Deliberately loose — an agent
// working a ticket queue fires a lot of legitimate requests, and the tighter
// limiters below cover the endpoints that actually matter.
const generalLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 600,
  handler: rejectWith('Too many requests — please slow down and try again shortly.'),
});

// Credential endpoints: the cost of a wrong guess should grow fast, and no
// human logs in ten times in a quarter hour.
const authLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  handler: rejectWith('Too many attempts — please wait a few minutes and try again.'),
});

// Sending an OTP costs a real email (and real money) and is reachable without
// any credential, including via the chatbot's own public /chat endpoint. The
// service layer already caps requests per email address; this caps them per
// IP, which is what stops one caller from cycling through many addresses.
const otpRequestLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  handler: rejectWith('Too many verification codes requested — please wait before trying again.'),
});

// Verification is the brute-force surface: 6 digits is a million combinations,
// and the per-OTP attempt counter resets whenever a new code is issued.
const otpVerifyLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 15,
  skipSuccessfulRequests: true,
  handler: rejectWith('Too many verification attempts — please wait before trying again.'),
});

module.exports = { generalLimiter, authLimiter, otpRequestLimiter, otpVerifyLimiter };
