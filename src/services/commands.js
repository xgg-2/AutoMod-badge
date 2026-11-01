'use strict';

const { Routes } = require('discord.js');

async function addCommand(rest, appId, command) {
  return rest.post(Routes.applicationCommands(appId), { body: command });
}

async function removeCommand(rest, appId, name) {
  const list = await rest.get(Routes.applicationCommands(appId));
  const found = list.find((cmd) => cmd.name === name);
  if (!found) return false;
  await rest.delete(Routes.applicationCommand(appId, found.id));
  return true;
}

module.exports = { addCommand, removeCommand };
