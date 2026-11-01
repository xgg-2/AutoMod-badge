'use strict';

const { REST } = require('discord.js');
const { loadConfig } = require('./config');
const logger = require('./utils/logger');
const badge = require('./commands/badge');
const { addCommand } = require('./services/commands');

async function main() {
  const cfg = loadConfig(['DISCORD_TOKEN', 'CLIENT_ID']);
  const rest = new REST().setToken(cfg.token);

  await addCommand(rest, cfg.clientId, badge.data.toJSON());
  logger.info('Added the /badge command. Other commands of this bot were not changed.');
}

main().catch((err) => {
  logger.error('Command registration failed', err);
  process.exit(1);
});
