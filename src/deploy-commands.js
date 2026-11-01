'use strict';

const { REST, Routes } = require('discord.js');
const { loadConfig } = require('./config');
const logger = require('./utils/logger');
const badge = require('./commands/badge');

async function main() {
  const cfg = loadConfig(['DISCORD_TOKEN', 'CLIENT_ID']);
  const rest = new REST().setToken(cfg.token);

  await rest.put(Routes.applicationCommands(cfg.clientId), { body: [badge.data.toJSON()] });
  logger.info('Registered the /badge command. It can take a few minutes to appear everywhere.');
}

main().catch((err) => {
  logger.error('Command registration failed', err);
  process.exit(1);
});
