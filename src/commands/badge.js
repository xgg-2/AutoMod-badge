'use strict';

const {
  MessageFlags,
  OAuth2Scopes,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const logger = require('../utils/logger');
const { createThrottle } = require('../utils/throttle');
const { planGuild, summarize } = require('../services/planner');
const { runTasks } = require('../services/runner');
const { inspectAll, createRule, collectOwnedRules, deleteRule } = require('../services/rules');
const {
  PREFIX,
  IDS,
  statusPanel,
  progressPanel,
  createResultPanel,
  removeConfirmPanel,
  removeResultPanel,
  noticePanel,
} = require('../ui/panels');

const PROGRESS_EDIT_INTERVAL_MS = 3000;

const state = { busy: false, abort: false };

const data = new SlashCommandBuilder()
  .setName('badge')
  .setDescription('Check server capacity and create the AutoMod rules needed for the badge.');

function inviteUrl(client) {
  return client.generateInvite({
    scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
    permissions: [PermissionFlagsBits.ManageGuild],
  });
}

async function buildStatus({ client, cfg }) {
  const infos = await inspectAll(client);
  const plans = infos.map((info) => planGuild(info, cfg));
  return { plans, summary: summarize(plans, cfg) };
}

async function statusPayload(ctx) {
  if (state.busy) {
    return noticePanel('A run is in progress', 'Wait for it to finish, then press Refresh.');
  }
  const status = await buildStatus(ctx);
  return statusPanel(status, ctx.cfg, { inviteUrl: inviteUrl(ctx.client) });
}

function buildCreateTasks(client, plans, cfg) {
  const tasks = [];
  for (const plan of plans) {
    if (plan.toCreate <= 0) continue;
    const guild = client.guilds.cache.get(plan.id);
    if (!guild) continue;
    for (let i = 0; i < plan.toCreate; i += 1) {
      tasks.push({
        key: plan.id,
        label: plan.name,
        run: () => createRule(guild, plan.owned + i + 1, cfg),
      });
    }
  }
  return tasks;
}

async function runWithProgress(interaction, ctx, tasks, title) {
  const empty = { done: 0, total: tasks.length, succeeded: 0, failed: 0, skipped: 0 };
  await interaction.editReply(progressPanel(empty, { title }));

  const throttle = createThrottle(PROGRESS_EDIT_INTERVAL_MS);
  const result = await runTasks(tasks, {
    delayMs: ctx.cfg.createDelayMs,
    shouldAbort: () => state.abort,
    onProgress: (progress) => throttle.run(() => interaction.editReply(progressPanel(progress, { title }))),
  });
  await throttle.drain();
  return result;
}

async function startCreate(interaction, ctx) {
  if (state.busy) return interaction.editReply(await statusPayload(ctx));
  state.busy = true;
  state.abort = false;

  try {
    const status = await buildStatus(ctx);
    if (!status.summary.canStart) {
      return await interaction.editReply(statusPanel(status, ctx.cfg, { inviteUrl: inviteUrl(ctx.client) }));
    }

    const tasks = buildCreateTasks(ctx.client, status.plans, ctx.cfg);
    logger.info(`Creating ${tasks.length} rule(s) across ${status.summary.counts.ready} server(s).`);
    const result = await runWithProgress(interaction, ctx, tasks, 'Creating rules');

    const after = await buildStatus(ctx);
    logger.info(
      `Run finished: ${result.succeeded} created, ${result.failed} failed, ${result.skipped} skipped. ` +
        `Owned rules now: ${after.summary.owned}.`,
    );
    return await interaction.editReply(
      createResultPanel({ result, ownedAfter: after.summary.owned, cfg: ctx.cfg }),
    );
  } catch (err) {
    logger.error('Rule creation run failed', err);
    return interaction
      .editReply(noticePanel('Run failed', 'Something went wrong. Check the bot logs, then press Refresh.'))
      .catch(() => {});
  } finally {
    state.busy = false;
  }
}

async function confirmRemove(interaction, ctx) {
  if (state.busy) return interaction.editReply(await statusPayload(ctx));

  const owned = await collectOwnedRules(ctx.client);
  if (owned.length === 0) return interaction.editReply(await statusPayload(ctx));

  const guildCount = new Set(owned.map((item) => item.guildId)).size;
  return interaction.editReply(removeConfirmPanel({ ruleCount: owned.length, guildCount }));
}

async function startRemove(interaction, ctx) {
  if (state.busy) return interaction.editReply(await statusPayload(ctx));
  state.busy = true;
  state.abort = false;

  try {
    const owned = await collectOwnedRules(ctx.client);
    const tasks = owned.map((item) => ({
      key: item.guildId,
      label: item.guildName,
      run: () => deleteRule(item.rule),
    }));
    logger.info(`Removing ${tasks.length} rule(s).`);
    const result = await runWithProgress(interaction, ctx, tasks, 'Removing rules');
    logger.info(`Removal finished: ${result.succeeded} removed, ${result.failed} failed.`);
    return await interaction.editReply(removeResultPanel(result));
  } catch (err) {
    logger.error('Rule removal run failed', err);
    return interaction
      .editReply(noticePanel('Removal failed', 'Something went wrong. Check the bot logs, then press Refresh.'))
      .catch(() => {});
  } finally {
    state.busy = false;
  }
}

async function execute(interaction, ctx) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await interaction.editReply(await statusPayload(ctx));
}

async function handleComponent(interaction, ctx) {
  await interaction.deferUpdate();

  switch (interaction.customId) {
    case IDS.refresh:
      return interaction.editReply(await statusPayload(ctx));
    case IDS.start:
      return startCreate(interaction, ctx);
    case IDS.cancel:
      state.abort = true;
      return undefined;
    case IDS.remove:
      return confirmRemove(interaction, ctx);
    case IDS.removeConfirm:
      return startRemove(interaction, ctx);
    default:
      return undefined;
  }
}

module.exports = { data, execute, handleComponent, PREFIX };
