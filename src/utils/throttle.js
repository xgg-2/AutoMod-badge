'use strict';

const logger = require('./logger');

function createThrottle(intervalMs) {
  let last = 0;
  let pending = null;

  return {
    run(callback) {
      const now = Date.now();
      if (pending || now - last < intervalMs) return;
      last = now;
      pending = Promise.resolve()
        .then(callback)
        .catch((err) => logger.warn(`Progress update failed: ${err.message}`))
        .finally(() => {
          pending = null;
        });
    },
    async drain() {
      if (pending) await pending;
    },
  };
}

module.exports = { createThrottle };
