'use strict';

const MAX_KEYWORD_RULES_PER_GUILD = 6;

const BLOCK_MESSAGE = 'This message was blocked by a server rule.';

const AUDIT_REASON_CREATE = 'AutoMod badge setup';
const AUDIT_REASON_REMOVE = 'AutoMod badge cleanup';

module.exports = {
  MAX_KEYWORD_RULES_PER_GUILD,
  BLOCK_MESSAGE,
  AUDIT_REASON_CREATE,
  AUDIT_REASON_REMOVE,
};
