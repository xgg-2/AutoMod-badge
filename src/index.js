'use strict';

const { Client, Events, GatewayIntentBits, MessageFlags } = require('discord.js');
const { loadConfig } = require('./config');
const logger = require('./utils/logger');
const { resolveOwnerIds } = require('./services/auth');
const badge = require('./commands/badge');

let cfg;
try {
  cfg = loadConfig(['DISCORD_TOKEN']);
} catch (err) {
  logger.error(err.message);
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let ownerIds = new Set();

client.once(Events.ClientReady, async (readyClient) => {
  logger.info(`Logged in as ${readyClient.user.tag} in ${readyClient.guilds.cache.size} server(s).`);
  try {
    ownerIds = await resolveOwnerIds(readyClient, cfg.ownerIds);
    logger.info(`Authorized user id(s): ${[...ownerIds].join(', ') || 'none'}`);
    if (ownerIds.size === 0) logger.warn('No authorized users. Set OWNER_IDS in .env.');
  } catch (err) {
    logger.error('Could not resolve the bot owner. Set OWNER_IDS in .env.', err);
  }
});

async function notifyFailure(interaction) {
  const content = 'Something went wrong. Check the bot logs.';
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  } catch {
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  const isCommand = interaction.isChatInputCommand() && interaction.commandName === badge.data.name;
  const isButton = interaction.isButton() && interaction.customId.startsWith(badge.PREFIX);
  if (!isCommand && !isButton) return;

  try {
    if (!ownerIds.has(interaction.user.id)) {
      await interaction.reply({
        content: 'Only the bot owner can use this.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const ctx = { client, cfg };
    if (isCommand) await badge.execute(interaction, ctx);
    else await badge.handleComponent(interaction, ctx);
  } catch (err) {
    logger.error('Interaction failed', err);
    await notifyFailure(interaction);
  }
});

process.on('unhandledRejection', (err) => logger.error('Unhandled promise rejection', err));

client.login(cfg.token).catch((err) => {
  logger.error('Login failed. Check DISCORD_TOKEN.', err);
  process.exit(1);
});
