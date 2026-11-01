'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { planGuild, summarize } = require('../src/services/planner');

const cfg = { rulesPerGuild: 6, targetRules: 100, safetyMarginPercent: 10 };

const healthy = (n) => ({
  id: String(n),
  name: `Server ${n}`,
  hasPermission: true,
  ownedCount: 0,
  keywordRuleCount: 0,
});

const plansFor = (count, mutate = (g) => g) =>
  Array.from({ length: count }, (_, i) => planGuild(mutate(healthy(i)), cfg));

test('a clean server receives the configured number of rules', () => {
  const plan = planGuild(healthy(1), cfg);
  assert.equal(plan.status, 'ready');
  assert.equal(plan.toCreate, 6);
});

test('rules from other apps reduce the free keyword slots', () => {
  const plan = planGuild({ ...healthy(1), keywordRuleCount: 5 }, cfg);
  assert.equal(plan.toCreate, 1);
});

test('a server with all keyword slots used is reported as no_slots', () => {
  const plan = planGuild({ ...healthy(1), keywordRuleCount: 6 }, cfg);
  assert.equal(plan.status, 'no_slots');
  assert.equal(plan.toCreate, 0);
});

test('rules the bot already owns are not created again', () => {
  const done = planGuild({ ...healthy(1), ownedCount: 6, keywordRuleCount: 6 }, cfg);
  assert.equal(done.status, 'complete');
  assert.equal(done.toCreate, 0);

  const partial = planGuild({ ...healthy(1), ownedCount: 4, keywordRuleCount: 4 }, cfg);
  assert.equal(partial.toCreate, 2);
});

test('missing permission and API errors are surfaced', () => {
  assert.equal(planGuild({ ...healthy(1), hasPermission: false }, cfg).status, 'no_permission');
  const failed = planGuild({ id: '1', name: 'x', error: 'boom' }, cfg);
  assert.equal(failed.status, 'error');
  assert.equal(failed.reason, 'boom');
});

test('safety goal uses integer math (100 with 10 percent is 110)', () => {
  const summary = summarize(plansFor(21), cfg);
  assert.equal(summary.goal, 110);
});

test('two servers are insufficient and the missing servers are computed', () => {
  const summary = summarize(plansFor(2), cfg);
  assert.equal(summary.projected, 12);
  assert.equal(summary.verdict, 'insufficient');
  assert.equal(summary.canStart, false);
  assert.equal(summary.minGuildsTotal, 17);
  assert.equal(summary.recommendedGuildsTotal, 19);
  assert.equal(summary.extraGuildsForTarget, 15);
  assert.equal(summary.extraGuildsForGoal, 17);
});

test('enough servers with margin is ready', () => {
  const summary = summarize(plansFor(19), cfg);
  assert.equal(summary.verdict, 'ready');
  assert.equal(summary.canStart, true);
});

test('reaching 100 without the margin is marginal but can start', () => {
  const summary = summarize(plansFor(17), cfg);
  assert.equal(summary.verdict, 'marginal');
  assert.equal(summary.canStart, true);
  assert.equal(summary.extraGuildsForGoal, 2);
});

test('exactly 16 servers is insufficient (96 rules)', () => {
  const summary = summarize(plansFor(16), cfg);
  assert.equal(summary.verdict, 'insufficient');
  assert.equal(summary.extraGuildsForTarget, 1);
});

test('already owning the target is reported as met and nothing starts', () => {
  const plans = plansFor(20, (g) => ({ ...g, ownedCount: 6, keywordRuleCount: 6 }));
  const summary = summarize(plans, cfg);
  assert.equal(summary.verdict, 'met');
  assert.equal(summary.canStart, false);
  assert.equal(summary.toCreate, 0);
});

test('owned rules count toward the projected total', () => {
  const plans = [
    ...plansFor(10, (g) => ({ ...g, ownedCount: 6, keywordRuleCount: 6 })),
    ...plansFor(10).map((p, i) => ({ ...p, id: `new-${i}` })),
  ];
  const summary = summarize(plans, cfg);
  assert.equal(summary.owned, 60);
  assert.equal(summary.toCreate, 60);
  assert.equal(summary.projected, 120);
});

test('a smaller RULES_PER_GUILD needs more servers', () => {
  const small = { ...cfg, rulesPerGuild: 5 };
  const summary = summarize(
    Array.from({ length: 10 }, (_, i) => planGuild(healthy(i), small)),
    small,
  );
  assert.equal(summary.projected, 50);
  assert.equal(summary.minGuildsTotal, 20);
  assert.equal(summary.recommendedGuildsTotal, 22);
});
