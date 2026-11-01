'use strict';

const { MAX_KEYWORD_RULES_PER_GUILD } = require('./constants');

function readInt(name, fallback, { min, max }) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max} (got "${raw}").`);
  }
  return value;
}

function readList(name) {
  return (process.env[name] ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadConfig(required = ['DISCORD_TOKEN']) {
  require('dotenv').config({ quiet: true });

  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill it in.',
    );
  }

  const prefix = (process.env.RULE_NAME_PREFIX ?? '').trim().slice(0, 60);

  return Object.freeze({
    token: process.env.DISCORD_TOKEN?.trim(),
    clientId: process.env.CLIENT_ID?.trim(),
    ownerIds: readList('OWNER_IDS'),
    rulesPerGuild: readInt('RULES_PER_GUILD', 6, { min: 1, max: MAX_KEYWORD_RULES_PER_GUILD }),
    targetRules: readInt('TARGET_RULES', 100, { min: 1, max: 10000 }),
    safetyMarginPercent: readInt('SAFETY_MARGIN_PERCENT', 10, { min: 0, max: 100 }),
    createDelayMs: readInt('CREATE_DELAY_MS', 1200, { min: 300, max: 10000 }),
    ruleNamePrefix: prefix || 'AutoMod Rule',
  });
}

module.exports = { loadConfig };
