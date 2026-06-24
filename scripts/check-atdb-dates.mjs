#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createAtdbScriptHarness } from './atdb-test-harness.mjs';

function safeLog(message) {
  console.log(`[safe-atdb-dates] ${message}`);
}

function runScenario(label, assertion) {
  try {
    assertion();
    safeLog(`scenario ${label}: success`);
  } catch {
    throw new Error(`scenario ${label}: failure`);
  }
}

const harness = createAtdbScriptHarness({ tempPrefix: 'geneotools-atdb-dates-' });

try {
  safeLog('status: start');
  harness.compileLib();
  const { formatAtdbDate, splitAtdbDate } = harness.requireCompiled('lib/atdb/dates.js');

  runScenario('full-date', () => {
    assert.equal(formatAtdbDate(1901, 2, 3), '1901-02-03');
    assert.deepEqual(splitAtdbDate('1901-02-03'), [1901, 2, 3]);
  });

  runScenario('partial-month-known', () => {
    assert.equal(formatAtdbDate(1901, 2, 0), '1901-02-00');
    assert.deepEqual(splitAtdbDate('1901-02-00'), [1901, 2, 0]);
  });

  runScenario('partial-year-only', () => {
    assert.equal(formatAtdbDate(1901, 0, 0), '1901-00-00');
    assert.deepEqual(splitAtdbDate('1901-00-00'), [1901, 0, 0]);
  });

  runScenario('missing-year', () => {
    assert.equal(formatAtdbDate(0, 2, 3), null);
    assert.equal(splitAtdbDate('0000-02-03'), null);
  });

  runScenario('missing-month-with-day', () => {
    assert.equal(formatAtdbDate(1901, 0, 3), null);
    assert.equal(splitAtdbDate('1901-00-03'), null);
  });

  runScenario('invalid-segments', () => {
    assert.equal(splitAtdbDate('1901-13-03'), null);
    assert.equal(splitAtdbDate('1901-02-32'), null);
    assert.equal(splitAtdbDate('1901-02'), null);
    assert.equal(splitAtdbDate('synthetic-date'), null);
  });

  runScenario('round-trip-supported', () => {
    for (const parts of [
      [1901, 2, 3],
      [1901, 2, 0],
      [1901, 0, 0],
    ]) {
      const formatted = formatAtdbDate(...parts);
      assert.ok(formatted);
      assert.deepEqual(splitAtdbDate(formatted), parts);
    }
  });

  safeLog('status: success');
} catch (error) {
  safeLog('status: failure');
  safeLog(`error: ${error instanceof Error ? error.message : 'unknown'}`);
  process.exitCode = 1;
} finally {
  harness.cleanup();
}
