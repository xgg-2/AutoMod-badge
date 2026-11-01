'use strict';

const { REST } = require('discord.js');
const { loadConfig } = require('./config');
const logger = require('./utils/logger');
const badge = require('./commands/badge');
const { removeCommand } = require('./services/commands');

async function main() {
  const cfg = loadConfig(['DISCORD_TOKEN', 'CLIENT_ID']);
  const rest = new REST().setToken(cfg.token);

  const removed = await removeCommand(rest, cfg.clientId, badge.data.name);
  logger.info(removed ? 'Deleted the /badge command.' : 'The /badge command was not registered.');
}

main().catch((err) => {
  logger.error('Command removal failed', err);
  process.exit(1);
});
