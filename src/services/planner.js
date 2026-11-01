'use strict';

const { MAX_KEYWORD_RULES_PER_GUILD } = require('../constants');

const sum = (items, pick) => items.reduce((total, item) => total + pick(item), 0);
const ceilDiv = (a, b) => Math.ceil(a / b);

function planGuild(info, { rulesPerGuild }) {
  const owned = info.ownedCount ?? 0;
  const base = { id: info.id, name: info.name, owned, toCreate: 0, freeSlots: 0 };

  if (info.error) return { ...base, status: 'error', reason: info.error };
  if (!info.hasPermission) return { ...base, status: 'no_permission' };

  const freeSlots = Math.max(0, MAX_KEYWORD_RULES_PER_GUILD - (info.keywordRuleCount ?? 0));
  const wanted = Math.max(0, rulesPerGuild - owned);
  const toCreate = Math.min(wanted, freeSlots);

  let status = 'ready';
  if (toCreate === 0) status = wanted === 0 ? 'complete' : 'no_slots';

  return { ...base, freeSlots, toCreate, status };
}

function summarize(plans, { targetRules, safetyMarginPercent, rulesPerGuild }) {
  const owned = sum(plans, (p) => p.owned);
  const toCreate = sum(plans, (p) => p.toCreate);
  const projected = owned + toCreate;

  const goal = ceilDiv(targetRules * (100 + safetyMarginPercent), 100);

  let verdict;
  if (owned >= targetRules) verdict = 'met';
  else if (projected >= goal) verdict = 'ready';
  else if (projected >= targetRules) verdict = 'marginal';
  else verdict = 'insufficient';

  const shortfallToTarget = Math.max(0, targetRules - projected);
  const shortfallToGoal = Math.max(0, goal - projected);

  const count = (status) => plans.filter((p) => p.status === status).length;

  return {
    verdict,
    canStart: (verdict === 'ready' || verdict === 'marginal') && toCreate > 0,
    targetRules,
    goal,
    rulesPerGuild,
    owned,
    toCreate,
    projected,
    totalGuilds: plans.length,
    counts: {
      ready: count('ready'),
      complete: count('complete'),
      noSlots: count('no_slots'),
      noPermission: count('no_permission'),
      errors: count('error'),
    },
    shortfallToTarget,
    shortfallToGoal,
    minGuildsTotal: ceilDiv(targetRules, rulesPerGuild),
    recommendedGuildsTotal: ceilDiv(goal, rulesPerGuild),
    extraGuildsForTarget: ceilDiv(shortfallToTarget, rulesPerGuild),
    extraGuildsForGoal: ceilDiv(shortfallToGoal, rulesPerGuild),
  };
}

module.exports = { planGuild, summarize };
