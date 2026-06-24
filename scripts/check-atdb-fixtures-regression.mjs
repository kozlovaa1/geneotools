#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'geneotools-atdb-fixtures-regression-'));

function copyFile(relativePath) {
  const sourcePath = path.join(projectRoot, relativePath);
  const targetPath = path.join(tempRoot, relativePath);
  assert.ok(fs.existsSync(sourcePath), `required fixture regression input missing: ${relativePath}`);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function writeSyntheticScript(relativePath, content) {
  const targetPath = path.join(tempRoot, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
}

function runFixtureGate(mode = 'gate') {
  return spawnSync(process.execPath, ['scripts/check-atdb-fixtures.mjs', mode], {
    cwd: tempRoot,
    encoding: 'utf8',
  });
}

function outputOf(result) {
  return `${result.stdout || ''}${result.stderr || ''}`;
}

function assertNoTempPath(output) {
  assert.doesNotMatch(output, /geneotools-atdb-fixtures-regression-/);
}

try {
  for (const relativePath of [
    'scripts/atdb-fixtures.mjs',
    'scripts/atdb-roundtrip-invariants.mjs',
    'scripts/check-atdb-fixtures.mjs',
    'docs/atdb_schema_yaman.snapshot.json',
  ]) {
    copyFile(relativePath);
  }

  const result = runFixtureGate('diff');
  const output = outputOf(result);
  assert.equal(result.status, 0, output);
  assert.match(output, /fixture yaman-full skipped \(local fixture and snapshot missing\)/);
  assert.match(output, /fixture family skipped \(local fixture and snapshot missing\)/);
  assert.match(output, /\[safe-atdb-fixtures\] status: success/);
  assertNoTempPath(output);

  fs.rmSync(path.join(tempRoot, 'docs/atdb_schema_yaman.snapshot.json'), { force: true });
  const missingTrackedSnapshotResult = runFixtureGate('diff');
  const missingTrackedSnapshotOutput = outputOf(missingTrackedSnapshotResult);
  assert.notEqual(missingTrackedSnapshotResult.status, 0, missingTrackedSnapshotOutput);
  assert.match(
    missingTrackedSnapshotOutput,
    /tracked snapshot missing for fixture yaman snapshot docs\/atdb_schema_yaman\.snapshot\.json/,
  );
  assertNoTempPath(missingTrackedSnapshotOutput);
  copyFile('docs/atdb_schema_yaman.snapshot.json');

  const manualCheckResult = spawnSync(process.execPath, ['scripts/inspect-atdb-schema.mjs', 'manual-missing.atdb', '--check'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  const manualCheckOutput = outputOf(manualCheckResult);
  assert.equal(manualCheckResult.status, 0, manualCheckOutput);
  assert.match(manualCheckOutput, /\[safe-atdb-schema\] status: skipped/);
  assert.doesNotMatch(manualCheckOutput, /manual fixture input requires --output/);

  writeSyntheticScript(
    'scripts/inspect-atdb-schema.mjs',
    `#!/usr/bin/env node
console.log('[safe-atdb-schema] status: success');
`,
  );
  writeSyntheticScript(
    'scripts/smoke-atdb.mjs',
    `#!/usr/bin/env node
console.log('[safe-atdb-smoke] fixture-label: synthetic-drift');
console.log('[safe-atdb-smoke] parse: ok');
console.log('[safe-atdb-smoke] build: ok');
console.log('[safe-atdb-smoke] reparse: ok');
console.log('[safe-atdb-smoke] drift-persons: 0');
console.log('[safe-atdb-smoke] drift-families: 0');
console.log('[safe-atdb-smoke] drift-events: 1');
console.log('[safe-atdb-smoke] drift-places: 0');
console.log('[safe-atdb-smoke] status: failure');
console.log('[safe-atdb-smoke] error: drift gate failed with nonzero parse-build deltas');
process.exitCode = 1;
`,
  );

  const driftGateResult = runFixtureGate('gate');
  const driftGateOutput = outputOf(driftGateResult);
  assert.notEqual(driftGateResult.status, 0, driftGateOutput);
  assert.match(driftGateOutput, /\[safe-atdb-smoke\] drift-events: 1/);
  assert.match(driftGateOutput, /\[safe-atdb-fixtures\] status: failure/);
  assert.match(driftGateOutput, /smoke failed for fixture yaman/);
  assertNoTempPath(driftGateOutput);

  writeSyntheticScript(
    'scripts/smoke-atdb.mjs',
    `#!/usr/bin/env node
console.log('[safe-atdb-smoke] fixture-label: synthetic-aggregate-drift');
console.log('[safe-atdb-smoke] parse: ok');
console.log('[safe-atdb-smoke] build: ok');
console.log('[safe-atdb-smoke] reparse: ok');
console.log('[safe-atdb-smoke] drift-persons: 0');
console.log('[safe-atdb-smoke] drift-families: 0');
console.log('[safe-atdb-smoke] drift-events: 0');
console.log('[safe-atdb-smoke] drift-places: 0');
console.log('[safe-atdb-smoke] drift-aggregate-persons-with-father: 1');
console.log('[safe-atdb-smoke] drift-aggregate-persons-with-mother: 0');
console.log('[safe-atdb-smoke] drift-aggregate-persons-with-birth-date: 0');
console.log('[safe-atdb-smoke] drift-aggregate-persons-with-death-date: 0');
console.log('[safe-atdb-smoke] drift-aggregate-persons-with-birth-place: 0');
console.log('[safe-atdb-smoke] drift-aggregate-persons-with-death-place: 0');
console.log('[safe-atdb-smoke] drift-aggregate-events-with-date: 0');
console.log('[safe-atdb-smoke] drift-aggregate-events-with-participants: 0');
console.log('[safe-atdb-smoke] status: failure');
console.log('[safe-atdb-smoke] error: roundtrip invariant gate failed (persons-with-father)');
process.exitCode = 1;
`,
  );

  const aggregateDriftResult = runFixtureGate('gate');
  const aggregateDriftOutput = outputOf(aggregateDriftResult);
  assert.notEqual(aggregateDriftResult.status, 0, aggregateDriftOutput);
  assert.match(aggregateDriftOutput, /roundtrip invariant gate failed \(persons-with-father\)/);
  assert.match(aggregateDriftOutput, /smoke failed for fixture yaman/);
  assertNoTempPath(aggregateDriftOutput);

  writeSyntheticScript(
    'scripts/smoke-atdb.mjs',
    `#!/usr/bin/env node
console.log('[safe-atdb-smoke] fixture-label: synthetic-incomplete-smoke');
console.log('[safe-atdb-smoke] parse: ok');
console.log('[safe-atdb-smoke] build: ok');
console.log('[safe-atdb-smoke] reparse: ok');
console.log('[safe-atdb-smoke] drift-persons: 0');
console.log('[safe-atdb-smoke] drift-families: 0');
console.log('[safe-atdb-smoke] drift-events: 0');
console.log('[safe-atdb-smoke] drift-places: 0');
console.log('[safe-atdb-smoke] status: success');
`,
  );

  const missingAggregateResult = runFixtureGate('gate');
  const missingAggregateOutput = outputOf(missingAggregateResult);
  assert.notEqual(missingAggregateResult.status, 0, missingAggregateOutput);
  assert.match(missingAggregateOutput, /smoke output missing aggregate key persons-with-father for fixture yaman/);
  assertNoTempPath(missingAggregateOutput);

  console.log('[safe-atdb-fixtures-regression] missing-local-fixtures: ok');
  console.log('[safe-atdb-fixtures-regression] missing-tracked-snapshot: ok');
  console.log('[safe-atdb-fixtures-regression] drift-gate-failure: ok');
  console.log('[safe-atdb-fixtures-regression] aggregate-drift-gate-failure: ok');
  console.log('[safe-atdb-fixtures-regression] missing-aggregate-key: ok');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
