class ApiError extends Error {
  // code is an optional machine-readable reason for clients that act on the
  // error rather than show it, e.g. 'product_not_enabled'.
  constructor(statusCode, message, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
