#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { resolveFixtureByLabel } from './atdb-fixtures.mjs';

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
const tempDir = path.join(os.tmpdir(), 'geneotools-atdb-smoke');
const requireFromSmoke = createRequire(import.meta.url);

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

function compileTypeScriptModule(sourceFile, outputFile) {
  const source = fs.readFileSync(sourceFile, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: sourceFile,
  });

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, compiled.outputText, 'utf8');
}

function compileTypeScriptTree(sourceDir, outputDir) {
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const outputPath = path.join(outputDir, entry.name);

    if (entry.isDirectory()) {
      compileTypeScriptTree(sourcePath, outputPath);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.ts')) {
      compileTypeScriptModule(sourcePath, outputPath.replace(/\.ts$/, '.js'));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.copyFileSync(sourcePath, outputPath);
    }
  }
}

async function loadSqlProcessor() {
  fs.rmSync(tempDir, { force: true, recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });
  fs.symlinkSync(path.join(projectRoot, 'node_modules'), path.join(tempDir, 'node_modules'), 'dir');
  compileTypeScriptModule(path.join(projectRoot, 'lib/types.ts'), path.join(tempDir, 'lib/types.js'));
  compileTypeScriptModule(path.join(projectRoot, 'lib/initSqlJs.ts'), path.join(tempDir, 'lib/initSqlJs.js'));
  compileTypeScriptTree(path.join(projectRoot, 'lib/atdb'), path.join(tempDir, 'lib/atdb'));
  compileTypeScriptModule(path.join(projectRoot, 'lib/sqlProcessor.ts'), path.join(tempDir, 'lib/sqlProcessor.js'));

  return requireFromSmoke(path.join(tempDir, 'lib/sqlProcessor.js'));
}

async function withQuietProjectLogs(callback) {
  const originalWarn = console.warn;
  const originalError = console.error;
  console.warn = () => {};
  console.error = () => {};
  try {
    return await callback();
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
  }
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

  const { parseAtdb, buildAtdb } = await loadSqlProcessor();

  try {
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
    safeLog(`drift-persons: ${drift.persons}`);
    safeLog(`drift-families: ${drift.families}`);
    safeLog(`drift-events: ${drift.events}`);
    safeLog(`drift-places: ${drift.places}`);
    const hasDrift = Object.values(drift).some((value) => value !== 0);
    if (hasDrift) {
      safeLog('status: failure');
      safeLog('error: drift gate failed with nonzero parse-build deltas');
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
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
}

await main();
