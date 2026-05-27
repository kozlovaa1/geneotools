#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';

const projectRoot = process.cwd();
const fixturePath = process.env.ATDB_SMOKE_FIXTURE || path.join(projectRoot, 'scripts/fixtures/local-smoke.atdb');
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

async function loadSqlProcessor() {
  fs.rmSync(tempDir, { force: true, recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });
  fs.symlinkSync(path.join(projectRoot, 'node_modules'), path.join(tempDir, 'node_modules'), 'dir');
  compileTypeScriptModule(path.join(projectRoot, 'lib/initSqlJs.ts'), path.join(tempDir, 'lib/initSqlJs.js'));
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

  if (!fs.existsSync(fixturePath)) {
    safeLog('status: skipped');
    safeLog('fixture-bytes: 0');
    safeLog('persons: 0');
    safeLog('families: 0');
    safeLog('events: 0');
    safeLog('places: 0');
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
    safeLog(`persons: ${parsed.persons.length}`);
    safeLog(`families: ${parsed.families.length}`);
    safeLog(`events: ${parsed.events.length}`);
    safeLog(`places: ${parsed.places.length}`);

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
