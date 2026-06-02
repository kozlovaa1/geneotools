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
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

try {
  for (const relativePath of [
    'scripts/atdb-fixtures.mjs',
    'scripts/check-atdb-fixtures.mjs',
    'docs/atdb_schema_yaman.snapshot.json',
  ]) {
    copyFile(relativePath);
  }

  const result = spawnSync(process.execPath, ['scripts/check-atdb-fixtures.mjs', 'diff'], {
    cwd: tempRoot,
    encoding: 'utf8',
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`;
  assert.equal(result.status, 0, output);
  assert.match(output, /fixture yaman-full skipped \(local fixture and snapshot missing\)/);
  assert.match(output, /fixture family skipped \(local fixture and snapshot missing\)/);
  assert.match(output, /\[safe-atdb-fixtures\] status: success/);

  const manualCheckResult = spawnSync(process.execPath, ['scripts/inspect-atdb-schema.mjs', 'manual-missing.atdb', '--check'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  const manualCheckOutput = `${manualCheckResult.stdout || ''}${manualCheckResult.stderr || ''}`;
  assert.equal(manualCheckResult.status, 0, manualCheckOutput);
  assert.match(manualCheckOutput, /\[safe-atdb-schema\] status: skipped/);
  assert.doesNotMatch(manualCheckOutput, /manual fixture input requires --output/);

  console.log('[safe-atdb-fixtures-regression] missing-local-fixtures: ok');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
