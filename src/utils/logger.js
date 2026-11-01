'use strict';

function stamp() {
  return new Date().toISOString();
}

module.exports = {
  info: (message) => console.log(`${stamp()} [info]  ${message}`),
  warn: (message) => console.warn(`${stamp()} [warn]  ${message}`),
  error: (message, err) => {
    console.error(`${stamp()} [error] ${message}`);
    if (err) console.error(err);
  },
};
