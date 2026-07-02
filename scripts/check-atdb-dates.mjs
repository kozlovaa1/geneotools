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
  const {
    createAtdbDateValue,
    createSimpleAtdbDateMetadata,
    formatAtdbDate,
    isSimpleAtdbDateValue,
    splitAtdbDate,
  } = harness.requireCompiled('lib/atdb/dates.js');

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

  runScenario('metadata-primary-date', () => {
    const value = createAtdbDateValue({ y: 1901, m: 2, d: 3, type: 0 });
    assert.equal(value.value, '1901-02-03');
    assert.equal(value.display, '1901-02-03');
    assert.equal(value.isSimple, true);
    assert.equal(isSimpleAtdbDateValue(value), true);
  });

  runScenario('metadata-primary-date-null-secondary', () => {
    const value = createAtdbDateValue({ y: 1901, m: 2, d: 3, y2: null, m2: null, d2: null, type: 0 });
    assert.equal(value.value, '1901-02-03');
    assert.equal(value.display, '1901-02-03');
    assert.equal(value.isSimple, true);
    assert.equal(isSimpleAtdbDateValue(value), true);
  });

  runScenario('metadata-range-date', () => {
    const value = createAtdbDateValue({ y: 1901, m: 2, d: 3, y2: 1902, m2: 4, d2: 5, type: 4 });
    assert.equal(value.value, '1901-02-03');
    assert.equal(value.display, 'между 1901-02-03 и 1902-04-05');
    assert.equal(value.isSimple, false);
    assert.equal(isSimpleAtdbDateValue(value), false);
  });

  runScenario('metadata-calendar-sort-is-non-simple', () => {
    const value = createAtdbDateValue({ y: 1901, m: 2, d: 3, type: 0, calendar: 1, sorty: 1901 });
    assert.equal(value.value, '1901-02-03');
    assert.equal(value.display, '1901-02-03');
    assert.equal(value.isSimple, false);
    assert.equal(isSimpleAtdbDateValue(value), false);
  });

  runScenario('metadata-unknown-type', () => {
    const diagnostics = [];
    const value = createAtdbDateValue(
      { y: 1901, m: 2, d: 3, type: 999 },
      { fieldId: 29, recTable: 7, logger: (diagnostic) => diagnostics.push(diagnostic) },
    );
    assert.equal(value.value, '1901-02-03');
    assert.equal(value.display, '1901-02-03');
    assert.equal(value.diagnosticCode, 'date.type.unknown');
    assert.equal(diagnostics[0]?.code, 'date.type.unknown');
    assert.equal(diagnostics[0]?.details?.fieldId, 29);
  });

  runScenario('simple-metadata-from-input', () => {
    assert.deepEqual(createSimpleAtdbDateMetadata('1901-02-03'), { y: 1901, m: 2, d: 3, type: 0 });
    assert.equal(createSimpleAtdbDateMetadata('1901-02'), null);
  });

  safeLog('status: success');
} catch (error) {
  safeLog('status: failure');
  safeLog(`error: ${error instanceof Error ? error.message : 'unknown'}`);
  process.exitCode = 1;
} finally {
  harness.cleanup();
}
