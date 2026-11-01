'use strict';

const crypto = require('node:crypto');
const {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  PermissionFlagsBits,
} = require('discord.js');
const {
  BLOCK_MESSAGE,
  AUDIT_REASON_CREATE,
  AUDIT_REASON_REMOVE,
} = require('../constants');

const INSPECT_CONCURRENCY = 5;

function describeError(err) {
  const code = err?.code ? ` (code ${err.code})` : '';
  return `${err?.message ?? String(err)}${code}`;
}

async function getBotMember(guild) {
  return guild.members.me ?? (await guild.members.fetchMe());
}

async function inspectGuild(guild, botId) {
  const base = { id: guild.id, name: guild.name };
  try {
    const me = await getBotMember(guild);
    if (!me.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return { ...base, hasPermission: false, ownedCount: 0, keywordRuleCount: 0 };
    }

    const rules = await guild.autoModerationRules.fetch();
    const owned = rules.filter((rule) => rule.creatorId === botId && rule.enabled);
    const keyword = rules.filter((rule) => rule.triggerType === AutoModerationRuleTriggerType.Keyword);

    return {
      ...base,
      hasPermission: true,
      ownedCount: owned.size,
      keywordRuleCount: keyword.size,
    };
  } catch (err) {
    return { ...base, error: describeError(err) };
  }
}

async function inspectAll(client) {
  const guilds = [...client.guilds.cache.values()];
  const results = [];
  for (let i = 0; i < guilds.length; i += INSPECT_CONCURRENCY) {
    const chunk = guilds.slice(i, i + INSPECT_CONCURRENCY);
    results.push(...(await Promise.all(chunk.map((guild) => inspectGuild(guild, client.user.id)))));
  }
  return results;
}

function createRule(guild, ordinal, { ruleNamePrefix }) {
  const keyword = `badge-${crypto.randomBytes(8).toString('hex')}`;
  return guild.autoModerationRules.create({
    name: `${ruleNamePrefix} ${ordinal}`,
    enabled: true,
    eventType: AutoModerationRuleEventType.MessageSend,
    triggerType: AutoModerationRuleTriggerType.Keyword,
    triggerMetadata: { keywordFilter: [keyword] },
    actions: [
      {
        type: AutoModerationActionType.BlockMessage,
        metadata: { customMessage: BLOCK_MESSAGE },
      },
    ],
    reason: AUDIT_REASON_CREATE,
  });
}

async function collectOwnedRules(client) {
  const found = [];
  for (const guild of client.guilds.cache.values()) {
    try {
      const me = await getBotMember(guild);
      if (!me.permissions.has(PermissionFlagsBits.ManageGuild)) continue;
      const rules = await guild.autoModerationRules.fetch();
      for (const rule of rules.values()) {
        if (rule.creatorId === client.user.id) {
          found.push({ guildId: guild.id, guildName: guild.name, rule });
        }
      }
    } catch {
    }
  }
  return found;
}

function deleteRule(rule) {
  return rule.delete(AUDIT_REASON_REMOVE);
}

module.exports = {
  inspectAll,
  createRule,
  collectOwnedRules,
  deleteRule,
};
