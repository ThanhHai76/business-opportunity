'use strict';
const { STATUS_CODES } = require('node:http');

/** An error that maps 1:1 onto an HTTP status (thrown by validators and services). */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

const badRequest = (message) => new HttpError(400, message);
const notFound = (message) => new HttpError(404, message);

/** Express 4 does not await handlers — forward rejected promises to the error middleware. */
const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

/** Query parameters arrive as string | string[] | object; only a single string is meaningful here. */
function singleString(value, name) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw badRequest(`Tham số ${name} không hợp lệ.`);
  return value;
}

/** Turns any thrown value into { statusCode, error, message, path, timestamp }. */
function errorBody(err, req) {
  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  const known = status < 500;
  return {
    status,
    body: {
      statusCode: status,
      error: STATUS_CODES[status] ?? 'Error',
      message: known ? err.message : 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.',
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    },
  };
}

module.exports = { HttpError, badRequest, notFound, asyncHandler, singleString, errorBody };
