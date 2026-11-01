'use strict';

const { sleep: defaultSleep } = require('../utils/sleep');

function interleave(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    if (!groups.has(task.key)) groups.set(task.key, []);
    groups.get(task.key).push(task);
  }
  const queues = [...groups.values()];
  const ordered = [];
  while (ordered.length < tasks.length) {
    for (const queue of queues) {
      const task = queue.shift();
      if (task) ordered.push(task);
    }
  }
  return ordered;
}

async function runTasks(tasks, options) {
  const {
    delayMs,
    maxConsecutiveFailures = 2,
    onProgress = () => {},
    shouldAbort = () => false,
    sleep = defaultSleep,
  } = options;

  const ordered = interleave(tasks);
  const perKey = new Map();
  const statsFor = (task) => {
    if (!perKey.has(task.key)) {
      perKey.set(task.key, {
        key: task.key,
        label: task.label,
        ok: 0,
        failed: 0,
        skipped: 0,
        consecutiveFailures: 0,
        lastError: null,
      });
    }
    return perKey.get(task.key);
  };

  const result = {
    total: ordered.length,
    done: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    aborted: false,
    perKey,
  };
  const snapshot = () => ({
    total: result.total,
    done: result.done,
    succeeded: result.succeeded,
    failed: result.failed,
    skipped: result.skipped,
  });

  let calledOnce = false;
  for (const task of ordered) {
    if (shouldAbort()) {
      result.aborted = true;
      break;
    }

    const stats = statsFor(task);

    if (stats.consecutiveFailures >= maxConsecutiveFailures) {
      stats.skipped += 1;
      result.skipped += 1;
      result.done += 1;
      onProgress(snapshot());
      continue;
    }

    if (calledOnce) await sleep(delayMs);
    calledOnce = true;

    try {
      await task.run();
      stats.ok += 1;
      stats.consecutiveFailures = 0;
      result.succeeded += 1;
    } catch (err) {
      stats.failed += 1;
      stats.consecutiveFailures += 1;
      stats.lastError = err?.message ?? String(err);
      result.failed += 1;
    }

    result.done += 1;
    onProgress(snapshot());
  }

  return result;
}

module.exports = { runTasks, interleave };
