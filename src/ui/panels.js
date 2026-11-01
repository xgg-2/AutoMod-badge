'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  escapeMarkdown,
} = require('discord.js');

const PREFIX = 'badge:';
const IDS = {
  start: `${PREFIX}start`,
  refresh: `${PREFIX}refresh`,
  cancel: `${PREFIX}cancel`,
  remove: `${PREFIX}remove`,
  removeConfirm: `${PREFIX}remove-confirm`,
  unregister: `${PREFIX}unregister`,
};

const COLORS = {
  green: 0x57f287,
  yellow: 0xfee75c,
  red: 0xed4245,
  blue: 0x5865f2,
};

const MAX_LISTED = 5;

const text = (content) => new TextDisplayBuilder().setContent(content);

const code = (pairs) => {
  const width = Math.max(...pairs.map(([key]) => key.length));
  const lines = pairs.map(([key, value]) => `${key.padEnd(width)} = ${value}`);
  return `\`\`\`prolog\n${lines.join('\n')}\n\`\`\``;
};
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

const button = (id, label, style, disabled = false) =>
  new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled);

function wrap(container) {
  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}

function safeName(name) {
  const trimmed = name.length > 40 ? `${name.slice(0, 37)}...` : name;
  return escapeMarkdown(trimmed);
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`;
}

function progressBar(done, total, width = 20) {
  const ratio = total === 0 ? 1 : Math.min(1, done / total);
  const filled = Math.round(ratio * width);
  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`;
}

function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

function verdictCopy(summary, cfg) {
  const { verdict } = summary;

  if (verdict === 'met') {
    return {
      color: COLORS.green,
      title: 'Requirement already met',
      body:
        `The bot owns ${summary.owned} active rules, which meets the requirement of ${summary.targetRules}. ` +
        'The badge can take up to about 24 hours to appear. Keep the rules until it shows on the bot profile.',
    };
  }

  if (verdict === 'ready') {
    const seconds = Math.ceil((summary.toCreate * cfg.createDelayMs) / 1000);
    return {
      color: COLORS.green,
      title: 'Ready to start',
      body:
        `There are enough servers. Press Start to create ${summary.toCreate} rules, ` +
        `one at a time. Estimated time: ${formatDuration(seconds)}.`,
    };
  }

  if (verdict === 'marginal') {
    const seconds = Math.ceil((summary.toCreate * cfg.createDelayMs) / 1000);
    return {
      color: COLORS.yellow,
      title: 'Possible, but with little margin',
      body:
        `The projected total reaches ${summary.targetRules} but not the safety goal of ${summary.goal}. ` +
        'If a few rules fail, the total could fall short. ' +
        `Adding ${plural(summary.extraGuildsForGoal, 'more server', 'more servers')} is recommended. ` +
        `You can also start now (about ${formatDuration(seconds)}) and run the command again later to top up.`,
    };
  }

  return {
    color: COLORS.red,
    title: 'Not enough servers',
    body:
      `At ${summary.rulesPerGuild} rules per server, ${summary.targetRules} rules need at least ` +
      `${summary.minGuildsTotal} servers, and ${summary.recommendedGuildsTotal} is recommended. ` +
      `Add the bot to ${plural(summary.extraGuildsForGoal, 'more server', 'more servers')} ` +
      `(at least ${summary.extraGuildsForTarget}) and run the command again.`,
  };
}

function skippedLines(plans) {
  const labels = {
    no_permission: 'missing Manage Server permission',
    no_slots: 'keyword rule slots are full',
    error: 'could not be read',
  };
  const skipped = plans.filter((plan) => labels[plan.status]);
  if (skipped.length === 0) return null;

  const lines = skipped
    .slice(0, MAX_LISTED)
    .map((plan) => `- ${safeName(plan.name)}: ${labels[plan.status]}`);
  if (skipped.length > MAX_LISTED) lines.push(`- and ${skipped.length - MAX_LISTED} more`);
  return `**Skipped servers**\n${lines.join('\n')}`;
}

function statusPanel({ plans, summary }, cfg, { inviteUrl } = {}) {
  const copy = verdictCopy(summary, cfg);
  const { counts } = summary;

  const skippedTotal = counts.noPermission + counts.noSlots + counts.errors;
  const figures = code([
    ['Servers', summary.totalGuilds],
    ['Can_receive', counts.ready],
    ['Skipped', skippedTotal],
    ['Owned_rules', summary.owned],
    ['To_create', summary.toCreate],
    ['Projected', summary.projected],
    ['Required', summary.targetRules],
    ['Goal', summary.goal],
  ]);

  const container = new ContainerBuilder()
    .setAccentColor(copy.color)
    .addTextDisplayComponents(text(`## AutoMod Badge Setup\n**${copy.title}**`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(figures))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(copy.body));

  const skipped = skippedLines(plans);
  if (skipped) {
    container.addSeparatorComponents(divider()).addTextDisplayComponents(text(skipped));
  }

  const buttons = [
    button(IDS.start, 'Start', ButtonStyle.Success, !summary.canStart),
    button(IDS.refresh, 'Refresh', ButtonStyle.Secondary),
  ];
  if (summary.owned > 0) buttons.push(button(IDS.remove, 'Remove rules', ButtonStyle.Danger));
  buttons.push(button(IDS.unregister, 'Delete command', ButtonStyle.Secondary, summary.verdict !== 'met'));
  if (inviteUrl && (summary.verdict === 'insufficient' || summary.verdict === 'marginal')) {
    buttons.push(new ButtonBuilder().setLabel('Add bot to a server').setStyle(ButtonStyle.Link).setURL(inviteUrl));
  }

  container.addActionRowComponents(new ActionRowBuilder().addComponents(buttons));
  return wrap(container);
}

function progressPanel(progress, { title, canCancel = true } = {}) {
  const { done, total, succeeded, failed, skipped } = progress;
  const container = new ContainerBuilder()
    .setAccentColor(COLORS.blue)
    .addTextDisplayComponents(text(`## ${title}`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        code([
          ['Progress', `${progressBar(done, total)} ${total === 0 ? 100 : Math.round((done / total) * 100)}%`],
          ['Done', `${done} / ${total}`],
          ['Succeeded', succeeded],
          ['Failed', failed],
          ['Skipped', skipped],
        ]),
      ),
    )
    .addTextDisplayComponents(
      text('Requests are sent one at a time, spread across servers, to stay within Discord rate limits.'),
    );

  if (canCancel) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(button(IDS.cancel, 'Cancel', ButtonStyle.Danger)),
    );
  }
  return wrap(container);
}

function failureLines(result) {
  const failing = [...result.perKey.values()].filter((stats) => stats.failed > 0 || stats.skipped > 0);
  if (failing.length === 0) return null;

  const lines = failing.slice(0, MAX_LISTED).map((stats) => {
    const reason = stats.lastError ? escapeMarkdown(stats.lastError).slice(0, 120) : 'skipped';
    return `- ${safeName(stats.label)}: ${reason}`;
  });
  if (failing.length > MAX_LISTED) lines.push(`- and ${failing.length - MAX_LISTED} more`);
  return `**Servers with problems**\n${lines.join('\n')}`;
}

function createResultPanel({ result, ownedAfter, cfg }) {
  const met = ownedAfter >= cfg.targetRules;
  const notAttempted = result.total - result.done;

  const container = new ContainerBuilder()
    .setAccentColor(met ? COLORS.green : COLORS.yellow)
    .addTextDisplayComponents(
      text(`## ${result.aborted ? 'Run cancelled' : 'Run finished'}\n**${met ? 'Requirement met' : 'Requirement not met yet'}**`),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        code([
          ['Owned_rules', ownedAfter],
          ['Required', cfg.targetRules],
          ['Created', result.succeeded],
          ['Failed', result.failed],
          ['Skipped', result.skipped],
          ['Not_attempted', notAttempted],
        ]),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        met
          ? 'The badge can take up to about 24 hours to appear. Keep the rules until it shows on the bot profile.'
          : `${cfg.targetRules - ownedAfter} more rules are needed. Run the command again to create only the missing ` +
              'rules, or add the bot to more servers first.',
      ),
    );

  const problems = failureLines(result);
  if (problems) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(problems));

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(button(IDS.refresh, 'Back to status', ButtonStyle.Secondary)),
  );
  return wrap(container);
}

function removeConfirmPanel({ ruleCount, guildCount }) {
  const container = new ContainerBuilder()
    .setAccentColor(COLORS.red)
    .addTextDisplayComponents(text('## Remove rules\n**This cannot be undone**'))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        `This deletes ${plural(ruleCount, 'rule', 'rules')} created by this bot in ` +
          `${plural(guildCount, 'server', 'servers')}.\n` +
          'If the badge has not appeared yet, or you remove rules after it did, the bot may lose it.',
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        button(IDS.removeConfirm, 'Confirm removal', ButtonStyle.Danger),
        button(IDS.refresh, 'Cancel', ButtonStyle.Secondary),
      ),
    );
  return wrap(container);
}

function removeResultPanel(result) {
  const container = new ContainerBuilder()
    .setAccentColor(result.failed === 0 ? COLORS.green : COLORS.yellow)
    .addTextDisplayComponents(text(`## ${result.aborted ? 'Removal cancelled' : 'Removal finished'}`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(code([['Removed', result.succeeded], ['Failed', result.failed]])));

  const problems = failureLines(result);
  if (problems) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(problems));

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(button(IDS.refresh, 'Back to status', ButtonStyle.Secondary)),
  );
  return wrap(container);
}

function noticePanel(title, body, { color = COLORS.yellow, withRefresh = true } = {}) {
  const container = new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(text(`## ${title}`))
    .addTextDisplayComponents(text(body));

  if (withRefresh) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(button(IDS.refresh, 'Refresh', ButtonStyle.Secondary)),
    );
  }
  return wrap(container);
}

module.exports = {
  PREFIX,
  IDS,
  COLORS,
  statusPanel,
  progressPanel,
  createResultPanel,
  removeConfirmPanel,
  removeResultPanel,
  noticePanel,
};
