'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runTasks, interleave } = require('../src/services/runner');

const noSleep = async () => {};

function makeTasks(spec, log, failing = new Set()) {
  const tasks = [];
  for (const [key, count] of Object.entries(spec)) {
    for (let i = 0; i < count; i += 1) {
      tasks.push({
        key,
        label: `Server ${key}`,
        run: async () => {
          log.push(key);
          if (failing.has(key)) throw new Error(`${key} failed`);
        },
      });
    }
  }
  return tasks;
}

test('interleave alternates between servers', () => {
  const ordered = interleave(makeTasks({ a: 3, b: 2, c: 1 }, []));
  assert.deepEqual(ordered.map((t) => t.key), ['a', 'b', 'c', 'a', 'b', 'a']);
});

test('all tasks run and are counted', async () => {
  const log = [];
  const result = await runTasks(makeTasks({ a: 2, b: 2 }, log), { delayMs: 1, sleep: noSleep });
  assert.equal(result.succeeded, 4);
  assert.equal(result.failed, 0);
  assert.equal(result.done, 4);
  assert.deepEqual(log, ['a', 'b', 'a', 'b']);
});

test('a server is skipped after consecutive failures', async () => {
  const log = [];
  const tasks = makeTasks({ bad: 6, good: 6 }, log, new Set(['bad']));
  const result = await runTasks(tasks, { delayMs: 1, sleep: noSleep, maxConsecutiveFailures: 2 });
  assert.equal(result.succeeded, 6);
  assert.equal(result.failed, 2);
  assert.equal(result.skipped, 4);
  assert.equal(result.done, 12);
  assert.equal(log.filter((k) => k === 'bad').length, 2);
  assert.equal(result.perKey.get('bad').lastError, 'bad failed');
});

test('a success resets the failure streak', async () => {
  let call = 0;
  const tasks = Array.from({ length: 4 }, () => ({
    key: 'a',
    label: 'A',
    run: async () => {
      call += 1;
      if (call === 1 || call === 3) throw new Error('flaky');
    },
  }));
  const result = await runTasks(tasks, { delayMs: 1, sleep: noSleep, maxConsecutiveFailures: 2 });
  assert.equal(result.failed, 2);
  assert.equal(result.succeeded, 2);
  assert.equal(result.skipped, 0);
});

test('abort stops before the next task', async () => {
  const log = [];
  let abort = false;
  const tasks = makeTasks({ a: 5 }, log).map((task) => ({
    ...task,
    run: async () => {
      log.push('x');
      abort = true;
    },
  }));
  const result = await runTasks(tasks, {
    delayMs: 1,
    sleep: noSleep,
    shouldAbort: () => abort,
  });
  assert.equal(result.aborted, true);
  assert.equal(result.succeeded, 1);
  assert.equal(result.done, 1);
  assert.equal(result.total, 5);
});

test('the delay is applied between calls but not before the first', async () => {
  const waits = [];
  const sleep = async (ms) => waits.push(ms);
  await runTasks(makeTasks({ a: 3 }, []), { delayMs: 1500, sleep });
  assert.deepEqual(waits, [1500, 1500]);
});

test('progress is reported after every task', async () => {
  const seen = [];
  await runTasks(makeTasks({ a: 2, b: 1 }, []), {
    delayMs: 1,
    sleep: noSleep,
    onProgress: (p) => seen.push(p.done),
  });
  assert.deepEqual(seen, [1, 2, 3]);
});
