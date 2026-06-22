#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  defaultFixtureLabel,
  getFixtureRegistry,
  resolveFixtureByLabel,
  safeRelativePath,
} from './atdb-fixtures.mjs';

const projectRoot = process.cwd();
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('--debug') || process.env.LOG_LEVEL === 'debug';
const modeArg = args.find((arg) => !arg.startsWith('--')) ?? 'gate';
const mode = new Set(['schema', 'diff', 'smoke', 'gate']).has(modeArg) ? modeArg : 'gate';
const fixtures = getFixtureRegistry().map((fixture) => resolveFixtureByLabel(projectRoot, fixture.label));
const baseline = fixtures.find((fixture) => fixture.label === defaultFixtureLabel);
const localArtifactDir = path.join(projectRoot, 'docs/atdb_experiments/local');
const requiredSnapshotExclusions = [
  'ValuesStr.vstr',
  'Recs.guid',
  'Global.guid',
  'Global.params',
  'document paths',
  'source text',
  'names',
  'places',
  'notes',
  'private/debug/raw artifacts',
];
const trackedDriftEntities = ['persons', 'families', 'events', 'places'];
const forbiddenPublicContentPatterns = [
  {
    label: 'raw-guid',
    pattern: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/,
  },
  {
    label: 'windows-user-path',
    pattern: /[A-Za-z]:\\Users\\/,
  },
  {
    label: 'unix-user-path',
    pattern: /\/Users\//,
  },
  {
    label: 'local-only-snapshot-path',
    pattern: /docs[\\/]+atdb_experiments[\\/]+local[\\/]+[^`"'\s]+\.snapshot\.json/,
  },
  {
    label: 'run-artifact-path',
    pattern: /docs[\\/]+atdb_experiments[\\/]+runs[\\/]+[^`"'\s]+/,
  },
];

function safeLog(message) {
  console.log(`[safe-atdb-fixtures] ${message}`);
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

function runNodeScript(scriptName, scriptArgs) {
  const result = spawnSync(process.execPath, [scriptName, ...scriptArgs], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr && verbose) {
    process.stdout.write(result.stderr);
  }

  return result;
}

function parseSafeOutput(output) {
  const summary = new Map();
  for (const line of output.split(/\r?\n/)) {
    const match = /^\[[^\]]+\]\s+([^:]+):\s*(.+)$/.exec(line.trim());
    if (match) {
      summary.set(match[1], match[2]);
    }
  }
  return summary;
}

function ensureLocalArtifactDir() {
  fs.mkdirSync(localArtifactDir, { recursive: true });
}

function hasFixtureFile(fixture) {
  return fs.existsSync(fixture.absolutePath);
}

function hasSnapshotFile(fixture) {
  return fs.existsSync(fixture.defaultSnapshotPath);
}

function shouldSkipMissingLocalFixture(fixture) {
  return !fixture.tracked && !hasFixtureFile(fixture) && !hasSnapshotFile(fixture);
}

function warnSkipFixture(fixture, reason) {
  safeLog(`warning: fixture ${fixture.label} skipped (${reason})`);
}

function formatDriftLabel(entity) {
  return `delta${entity[0].toUpperCase()}${entity.slice(1)}`;
}

function formatDriftSummary(summary) {
  return trackedDriftEntities
    .map((entity) => `${formatDriftLabel(entity)}:${summary?.get(`drift-${entity}`) ?? 'n/a'}`)
    .join(',');
}

function runSchemaMatrix() {
  safeLog('mode: schema');
  ensureLocalArtifactDir();

  for (const fixture of fixtures) {
    debugLog(`schema fixture: ${fixture.label} -> ${fixture.defaultSnapshotRelativePath}`);
    const result = runNodeScript('scripts/inspect-atdb-schema.mjs', ['--fixture', fixture.label]);
    if (result.status !== 0) {
      throw new Error(`schema inspect failed for fixture ${fixture.label}`);
    }
  }
}

function runDiffMatrix() {
  safeLog('mode: diff');
  if (!hasSnapshotFile(baseline)) {
    throw new Error(`baseline snapshot missing for fixture ${baseline.label}`);
  }

  for (const fixture of fixtures.filter((entry) => entry.label !== baseline.label)) {
    if (!hasSnapshotFile(fixture)) {
      if (shouldSkipMissingLocalFixture(fixture)) {
        warnSkipFixture(fixture, 'local fixture and snapshot missing');
        continue;
      }
      throw new Error(`snapshot missing for fixture ${fixture.label}`);
    }

    safeLog(`diff-pair: ${baseline.label}->${fixture.label}`);
    const result = runNodeScript('scripts/diff-atdb-schema.mjs', [
      baseline.defaultSnapshotPath,
      fixture.defaultSnapshotPath,
      '--warn-on-diff',
    ]);
    if (result.status !== 0) {
      throw new Error(`schema diff failed for fixture ${fixture.label}`);
    }
  }
}

function runSmokeMatrix() {
  safeLog('mode: smoke');
  const rows = [];
  for (const fixture of fixtures) {
    if (!hasFixtureFile(fixture) && !fixture.tracked) {
      warnSkipFixture(fixture, 'local fixture missing');
      rows.push(`${fixture.label}=parse:skipped,build:skipped,reparse:skipped,${formatDriftSummary()}`);
      continue;
    }

    debugLog(`smoke fixture: ${fixture.label}`);
    const result = runNodeScript('scripts/smoke-atdb.mjs', ['--fixture', fixture.label]);
    if (result.status !== 0) {
      throw new Error(`smoke failed for fixture ${fixture.label}`);
    }
    const summary = parseSafeOutput(result.stdout);
    rows.push(
      `${fixture.label}=parse:${summary.get('parse')},build:${summary.get('build')},reparse:${summary.get('reparse')},${formatDriftSummary(summary)}`,
    );
  }
  safeLog(`smoke-matrix: ${rows.join(' | ')}`);
}

function summarizeSnapshots() {
  const rows = [];
  for (const fixture of fixtures) {
    if (!hasSnapshotFile(fixture)) {
      if (shouldSkipMissingLocalFixture(fixture)) {
        warnSkipFixture(fixture, 'local snapshot missing');
        rows.push(`${fixture.label}=skipped`);
        continue;
      }
      throw new Error(`snapshot missing for fixture ${fixture.label}`);
    }

    const snapshot = JSON.parse(fs.readFileSync(fixture.defaultSnapshotPath, 'utf8'));
    const tables = Object.keys(snapshot.tables || {}).length;
    rows.push(
      `${fixture.label}=tables:${tables},recTables:${snapshot.recTableDistribution.length},tracked:${fixture.tracked ? 'yes' : 'no'}`,
    );
  }
  safeLog(`snapshot-matrix: ${rows.join(' | ')}`);
}

function verifyArtifactRedaction() {
  safeLog('mode: redaction-check');
  debugLog(`redaction markers: ${requiredSnapshotExclusions.join(',')}`);
  const artifacts = [
    path.join(projectRoot, 'docs/atdb_schema_yaman.snapshot.json'),
    path.join(projectRoot, 'docs/atdb_multi_fixture_schema.md'),
    path.join(projectRoot, 'docs/atdb_format.md'),
    path.join(projectRoot, 'docs/getting-started.md'),
  ];

  for (const artifactPath of artifacts) {
    const content = fs.readFileSync(artifactPath, 'utf8');
    for (const { label, pattern } of forbiddenPublicContentPatterns) {
      if (pattern.test(content)) {
        throw new Error(`artifact redaction failed (${label}) for ${safeRelativePath(projectRoot, artifactPath)}`);
      }
    }
  }

  const snapshot = JSON.parse(fs.readFileSync(path.join(projectRoot, 'docs/atdb_schema_yaman.snapshot.json'), 'utf8'));
  if (snapshot.safety?.redacted !== true) {
    throw new Error('tracked snapshot is not marked redacted');
  }

  const exclusions = new Set(snapshot.safety?.excludes || []);
  for (const marker of requiredSnapshotExclusions) {
    if (!exclusions.has(marker)) {
      safeLog(`[FIX:atdb-redaction] missing snapshot exclusion: ${marker}`);
      throw new Error('tracked snapshot exclusions are incomplete');
    }
  }

  safeLog('redaction-check: ok');
}

function runMappingGate() {
  const result = runNodeScript('scripts/check-atdb-mapping.mjs', verbose ? ['--verbose'] : []);
  if (result.status !== 0) throw new Error('mapping gate failed');
}

function main() {
  safeLog('status: start');
  debugLog(`fixtures: ${fixtures.map((fixture) => fixture.label).join(',')}`);

  try {
    if (mode === 'schema' || mode === 'gate') {
      runSchemaMatrix();
      summarizeSnapshots();
    }

    if (mode === 'diff' || mode === 'gate') {
      runDiffMatrix();
    }

    if (mode === 'smoke' || mode === 'gate') {
      runSmokeMatrix();
    }

    if (mode === 'gate') {
      runMappingGate();
      verifyArtifactRedaction();
    }

    safeLog('status: success');
  } catch (error) {
    safeLog('status: failure');
    safeLog(`error: ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  }
}

main();
