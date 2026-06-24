#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { resolveFixtureByLabel } from './atdb-fixtures.mjs';
import { createAtdbScriptHarness, withQuietProjectLogs } from './atdb-test-harness.mjs';
import { diffAtdbRoundtripInvariants } from './atdb-roundtrip-invariants.mjs';

const projectRoot = process.cwd();
const args = process.argv.slice(2);
const fixtureFlagIndex = args.findIndex((arg) => arg === '--fixture');
const fixtureFlagValue = fixtureFlagIndex >= 0 ? args[fixtureFlagIndex + 1] : undefined;
const inlineFixtureArg = args.find((arg) => arg.startsWith('--fixture='));
const explicitFixtureLabel = process.env.ATDB_SMOKE_FIXTURE_LABEL || fixtureFlagValue || inlineFixtureArg?.slice('--fixture='.length);
const registeredFixture = explicitFixtureLabel ? resolveFixtureByLabel(projectRoot, explicitFixtureLabel) : null;
const fixturePath =
  process.env.ATDB_SMOKE_FIXTURE ||
  registeredFixture?.absolutePath ||
  path.join(projectRoot, 'scripts/fixtures/local-smoke.atdb');
const fixtureLabel = registeredFixture?.label ?? 'local-smoke';

const safeLog = (message) => {
  console.log(`[safe-atdb-smoke] ${message}`);
};

const status = {
  parse: 'not-run',
  build: 'not-run',
  reparse: 'not-run',
};

function safeErrorMessage(error) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

async function main() {
  safeLog('status: start');
  safeLog(`fixture-label: ${fixtureLabel}`);

  if (!fs.existsSync(fixturePath)) {
    safeLog('status: skipped');
    safeLog('fixture-bytes: 0');
    safeLog('parse-persons: 0');
    safeLog('parse-families: 0');
    safeLog('parse-events: 0');
    safeLog('parse-places: 0');
    safeLog('reason: local fixture missing');
    return;
  }

  const buffer = fs.readFileSync(fixturePath);
  safeLog(`fixture-bytes: ${buffer.length}`);
  const harness = createAtdbScriptHarness({ tempPrefix: 'geneotools-atdb-smoke-' });

  try {
    harness.compileLib();
    const { parseAtdb, buildAtdb } = harness.requireCompiled('lib/sqlProcessor.js');
    const parsed = await withQuietProjectLogs(() => parseAtdb(new Uint8Array(buffer)));
    status.parse = 'ok';
    safeLog(`parse: ${status.parse}`);
    safeLog(`parse-persons: ${parsed.persons.length}`);
    safeLog(`parse-families: ${parsed.families.length}`);
    safeLog(`parse-events: ${parsed.events.length}`);
    safeLog(`parse-places: ${parsed.places.length}`);

    const rebuilt = await withQuietProjectLogs(() => buildAtdb(parsed, new Uint8Array(buffer)));
    status.build = 'ok';
    safeLog(`build: ${status.build}`);
    safeLog(`rebuilt-bytes: ${rebuilt.length}`);

    const reparsed = await withQuietProjectLogs(() => parseAtdb(rebuilt));
    status.reparse = 'ok';
    safeLog(`reparse: ${status.reparse}`);
    safeLog(`reparse-persons: ${reparsed.persons.length}`);
    safeLog(`reparse-families: ${reparsed.families.length}`);
    safeLog(`reparse-events: ${reparsed.events.length}`);
    safeLog(`reparse-places: ${reparsed.places.length}`);
    const drift = {
      persons: reparsed.persons.length - parsed.persons.length,
      families: reparsed.families.length - parsed.families.length,
      events: reparsed.events.length - parsed.events.length,
      places: reparsed.places.length - parsed.places.length,
    };
    const aggregateDrift = diffAtdbRoundtripInvariants(parsed, reparsed);
    safeLog(`drift-persons: ${drift.persons}`);
    safeLog(`drift-families: ${drift.families}`);
    safeLog(`drift-events: ${drift.events}`);
    safeLog(`drift-places: ${drift.places}`);
    for (const [key, value] of Object.entries(aggregateDrift)) {
      safeLog(`drift-aggregate-${key}: ${value}`);
    }
    const hasDrift = Object.values(drift).some((value) => value !== 0);
    const driftedAggregateKeys = Object.entries(aggregateDrift)
      .filter(([, value]) => value !== 0)
      .map(([key]) => key);
    if (hasDrift) {
      safeLog('status: failure');
      safeLog('error: drift gate failed with nonzero parse-build deltas');
      process.exitCode = 1;
      return;
    }
    if (driftedAggregateKeys.length > 0) {
      safeLog('status: failure');
      safeLog(`error: roundtrip invariant gate failed (${driftedAggregateKeys.join(',')})`);
      process.exitCode = 1;
      return;
    }
    safeLog('status: success');
  } catch (error) {
    safeLog(`parse: ${status.parse}`);
    safeLog(`build: ${status.build}`);
    safeLog(`reparse: ${status.reparse}`);
    safeLog(`status: failure`);
    safeLog(`error: ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  } finally {
    harness.cleanup();
  }
}

await main();
