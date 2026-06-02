#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = process.cwd();
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('--debug') || process.env.LOG_LEVEL === 'debug';
const checkMode = args.includes('--check');
const warnOnDiff = args.includes('--warn-on-diff');
const positionalArgs = args.filter((arg) => !arg.startsWith('--'));
const defaultSnapshot = path.join(projectRoot, 'docs/atdb_schema_yaman.snapshot.json');
const supportedArtifactVersion = 1;
const watchedRecTables = new Set([6, 8, 10, 18, 21]);

const exitCodes = {
  success: 0,
  diffFound: 1,
  unsupportedInput: 2,
  unsafeArtifact: 3,
  failure: 4,
};

function safeLog(message) {
  console.log(`[safe-atdb-schema-diff] ${message}`);
}

function debugLog(message) {
  if (verbose) {
    safeLog(`debug: ${message}`);
  }
}

function safeErrorMessage(error) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertSafeSnapshot(snapshot, label) {
  if (snapshot.artifactVersion !== supportedArtifactVersion) {
    const error = new Error(`${label} unsupported artifact version: ${snapshot.artifactVersion ?? 'missing'}`);
    error.exitCode = exitCodes.unsupportedInput;
    throw error;
  }

  if (snapshot.safety?.redacted !== true) {
    const error = new Error(`${label} snapshot is not marked as redacted`);
    error.exitCode = exitCodes.unsafeArtifact;
    throw error;
  }

  const excluded = new Set(snapshot.safety.excludes || []);
  for (const requiredExclusion of ['ValuesStr.vstr', 'Recs.guid', 'Global.guid', 'Global.params']) {
    if (!excluded.has(requiredExclusion)) {
      const error = new Error(`${label} snapshot redaction exclusions are incomplete`);
      error.exitCode = exitCodes.unsafeArtifact;
      throw error;
    }
  }

  for (const section of ['tables', 'recTableDistribution', 'valuesDistribution', 'valuesLinksTargets']) {
    if (!(section in snapshot)) {
      const error = new Error(`${label} snapshot missing required section: ${section}`);
      error.exitCode = exitCodes.unsupportedInput;
      throw error;
    }
  }
}

function inspectAtdb(inputPath, outputPath) {
  const result = spawnSync(
    process.execPath,
    ['scripts/inspect-atdb-schema.mjs', inputPath, '--output', outputPath, ...(verbose ? ['--debug'] : [])],
    {
      cwd: projectRoot,
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    const error = new Error(`inspect failed for ${path.basename(inputPath)} with exit code ${result.status}`);
    error.exitCode = exitCodes.failure;
    throw error;
  }
}

function snapshotFromInput(inputPath, label, tempDir) {
  const resolvedPath = path.resolve(projectRoot, inputPath);
  if (!fs.existsSync(resolvedPath)) {
    const error = new Error(`${label} input missing: ${path.relative(projectRoot, resolvedPath) || resolvedPath}`);
    error.exitCode = exitCodes.unsupportedInput;
    throw error;
  }

  if (resolvedPath.toLowerCase().endsWith('.json')) {
    debugLog(`${label} input snapshot: ${path.relative(projectRoot, resolvedPath) || resolvedPath}`);
    return readJson(resolvedPath);
  }

  if (resolvedPath.toLowerCase().endsWith('.atdb')) {
    const outputPath = path.join(tempDir, `${label}.snapshot.json`);
    debugLog(`${label} input fixture: ${path.relative(projectRoot, resolvedPath) || resolvedPath}`);
    inspectAtdb(resolvedPath, outputPath);
    return readJson(outputPath);
  }

  const error = new Error(`${label} input must be a .json snapshot or .atdb file`);
  error.exitCode = exitCodes.unsupportedInput;
  throw error;
}

function stableJson(value) {
  return JSON.stringify(value, Object.keys(value || {}).sort());
}

function indexBy(rows, keyFn) {
  const indexed = new Map();
  for (const row of rows || []) {
    indexed.set(keyFn(row), row);
  }
  return indexed;
}

function compareRows(section, beforeRows, afterRows, keyFn) {
  const before = indexBy(beforeRows, keyFn);
  const after = indexBy(afterRows, keyFn);
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort();
  const changes = [];

  for (const key of keys) {
    const beforeRow = before.get(key);
    const afterRow = after.get(key);
    if (!beforeRow) {
      changes.push({ section, key, change: 'added', after: afterRow });
    } else if (!afterRow) {
      changes.push({ section, key, change: 'removed', before: beforeRow });
    } else if (stableJson(beforeRow) !== stableJson(afterRow)) {
      changes.push({ section, key, change: 'changed', before: beforeRow, after: afterRow });
    }
  }

  return changes;
}

function recTableFromChange(change) {
  return change.after?.rec_table ?? change.before?.rec_table;
}

function summarizeChanges(baseline, modified) {
  const changes = [];
  const tableNames = [...new Set([...Object.keys(baseline.tables || {}), ...Object.keys(modified.tables || {})])].sort();

  for (const tableName of tableNames) {
    const beforeCount = baseline.tables?.[tableName]?.rowCount;
    const afterCount = modified.tables?.[tableName]?.rowCount;
    if (beforeCount !== afterCount) {
      changes.push({
        section: 'tables',
        key: tableName,
        change: beforeCount === undefined ? 'added' : afterCount === undefined ? 'removed' : 'changed',
        before: { rowCount: beforeCount ?? 0 },
        after: { rowCount: afterCount ?? 0 },
      });
    }
  }

  if (stableJson(baseline.globalMeta) !== stableJson(modified.globalMeta)) {
    changes.push({
      section: 'globalMeta',
      key: 'Global',
      change: 'changed',
      before: baseline.globalMeta ?? {},
      after: modified.globalMeta ?? {},
    });
  }

  changes.push(
    ...compareRows(
      'recTableDistribution',
      baseline.recTableDistribution,
      modified.recTableDistribution,
      (row) => String(row.rec_table),
    ),
  );

  for (const tableName of ['ValuesStr', 'ValuesNum', 'ValuesDates']) {
    changes.push(
      ...compareRows(
        tableName,
        baseline.valuesDistribution?.[tableName],
        modified.valuesDistribution?.[tableName],
        (row) => `${row.rec_table}:${row.f_id}`,
      ),
    );
  }

  changes.push(
    ...compareRows(
      'ValuesLinks',
      baseline.valuesLinksTargets,
      modified.valuesLinksTargets,
      (row) => `${row.rec_table}:${row.f_id}:${row.vlink_table ?? 'none'}`,
    ),
  );

  for (const section of ['eventRoles', 'eventTypes', 'fieldCatalog']) {
    changes.push(...compareRows(section, baseline[section], modified[section], (row) => String(row.id)));
  }

  return changes.sort((a, b) => `${a.section}:${a.key}`.localeCompare(`${b.section}:${b.key}`));
}

function logSummary(changes, baseline, modified) {
  debugLog(`baseline tables: ${Object.keys(baseline.tables || {}).length}`);
  debugLog(`modified tables: ${Object.keys(modified.tables || {}).length}`);
  debugLog(`diff sections: ${[...new Set(changes.map((change) => change.section))].join(',') || 'none'}`);
  const sectionCounts = new Map();

  const affectedRecTables = [
    ...new Set(changes.map(recTableFromChange).filter((recTable) => Number.isInteger(recTable))),
  ].sort((a, b) => a - b);
  const watchedHits = affectedRecTables.filter((recTable) => watchedRecTables.has(recTable));

  for (const change of changes) {
    sectionCounts.set(change.section, (sectionCounts.get(change.section) ?? 0) + 1);
  }

  safeLog(`changes: ${changes.length}`);
  safeLog(`affected-rec-tables: ${affectedRecTables.length ? affectedRecTables.join(',') : 'none'}`);
  safeLog(`watched-rec-tables: ${watchedHits.length ? watchedHits.join(',') : 'none'}`);
  safeLog(
    `section-summary: ${
      sectionCounts.size
        ? [...sectionCounts.entries()]
            .sort((left, right) => left[0].localeCompare(right[0]))
            .map(([section, count]) => `${section}=${count}`)
            .join(', ')
        : 'none'
    }`,
  );

  for (const change of changes.slice(0, 50)) {
    const beforeCount = change.before?.count ?? change.before?.rowCount ?? 'missing';
    const afterCount = change.after?.count ?? change.after?.rowCount ?? 'missing';
    safeLog(`change: ${change.section} ${change.key} ${change.change} ${beforeCount}->${afterCount}`);
  }

  if (changes.length > 50) {
    safeLog(`warning: ${changes.length - 50} additional sanitized changes omitted from console summary`);
  }
}

function resolveInputs() {
  if (checkMode && positionalArgs.length === 0) {
    return [defaultSnapshot, defaultSnapshot];
  }

  if (positionalArgs.length !== 2) {
    const error = new Error('usage: npm run schema:atdb:diff -- <baseline.snapshot.json|baseline.atdb> <modified.snapshot.json|modified.atdb>');
    error.exitCode = exitCodes.unsupportedInput;
    throw error;
  }

  return positionalArgs;
}

function main() {
  safeLog('status: start');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geneotools-atdb-diff-'));

  try {
    const [baselineInput, modifiedInput] = resolveInputs();
    debugLog(`baseline input: ${baselineInput}`);
    debugLog(`modified input: ${modifiedInput}`);

    const baseline = snapshotFromInput(baselineInput, 'baseline', tempDir);
    const modified = snapshotFromInput(modifiedInput, 'modified', tempDir);
    assertSafeSnapshot(baseline, 'baseline');
    assertSafeSnapshot(modified, 'modified');
    safeLog(`artifact-version: ${supportedArtifactVersion}`);

    const changes = summarizeChanges(baseline, modified);
    logSummary(changes, baseline, modified);

    if (changes.length > 0) {
      safeLog(warnOnDiff ? 'status: warning' : 'status: diff-found');
      process.exitCode = warnOnDiff ? exitCodes.success : exitCodes.diffFound;
      return;
    }

    safeLog('status: success');
  } catch (error) {
    const exitCode = error.exitCode ?? exitCodes.failure;
    safeLog(exitCode === exitCodes.unsafeArtifact ? 'status: unsafe-artifact' : 'status: failure');
    safeLog(`error: ${safeErrorMessage(error)}`);
    process.exitCode = exitCode;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
