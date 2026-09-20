'use strict';

/** Tiny console logger with a context prefix (keeps the module free of a logging dependency). */
function createLogger(context) {
  const prefix = `[${context}]`;
  return {
    log: (message) => console.log(prefix, message),
    warn: (message) => console.warn(prefix, message),
    error: (message, detail) => console.error(prefix, message, ...(detail === undefined ? [] : [detail])),
  };
}

module.exports = { createLogger };
