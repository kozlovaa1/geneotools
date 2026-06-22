#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const projectRoot = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geneotools-edit-draft-'));
const requireFromScript = createRequire(import.meta.url);

function safeLog(message) {
  console.log(`[safe-atdb-edit-draft] ${message}`);
}

function compileTree(sourceDir, outputDir) {
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const output = path.join(outputDir, entry.name);
    if (entry.isDirectory()) compileTree(source, output);
    else if (entry.name.endsWith('.ts')) {
      const compiled = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
        compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      });
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output.replace(/\.ts$/, '.js'), compiled.outputText);
    } else if (entry.name.endsWith('.json')) {
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.copyFileSync(source, output);
    }
  }
}

function syntheticParsedData() {
  return {
    persons: [
      {
        id: 1,
        firstName: 'SyntheticFirst',
        lastName: 'SyntheticLast',
        gender: 'M',
        birthPlaceId: 10,
        deathPlaceId: 11,
      },
      {
        id: 2,
        gender: 'Unknown',
      },
    ],
    families: [
      {
        id: 20,
        familyName: 'SyntheticFamily',
        childrenIds: [],
        color: 3,
      },
    ],
    events: [],
    places: [
      {
        id: 10,
        name: 'SyntheticPlace',
      },
      {
        id: 11,
      },
    ],
    metadata: {},
  };
}

function countFields(changeSet) {
  return changeSet.changes.reduce((total, entityChange) => total + entityChange.fields.length, 0);
}

try {
  safeLog('status: start');
  fs.symlinkSync(path.join(projectRoot, 'node_modules'), path.join(tempDir, 'node_modules'), 'dir');
  compileTree(path.join(projectRoot, 'lib'), path.join(tempDir, 'lib'));

  const editDraft = requireFromScript(path.join(tempDir, 'lib/atdbEditDraft.js'));
  const data = syntheticParsedData();
  const personFirstName = { entityType: 'person', id: 1, field: 'firstName' };
  const personLastName = { entityType: 'person', id: 1, field: 'lastName' };
  const familyName = { entityType: 'family', id: 20, field: 'familyName' };
  const familyColor = { entityType: 'family', id: 20, field: 'color' };
  const placeShortName = { entityType: 'place', id: 11, field: 'shortName' };

  let draft = editDraft.createEmptyAtdbEditDraft();
  draft = editDraft.setDraftField(draft, data, personFirstName, 'SyntheticUpdatedFirst');
  let changeSet = editDraft.buildAtdbChangeSet(data, draft);
  assert.equal(changeSet.changes.length, 1, 'single-field entity count mismatch');
  assert.equal(countFields(changeSet), 1, 'single-field count mismatch');
  safeLog('single-field: ok');

  draft = editDraft.setDraftField(draft, data, personLastName, 'SyntheticUpdatedLast');
  changeSet = editDraft.buildAtdbChangeSet(data, draft);
  assert.equal(changeSet.changes.length, 1, 'same-record grouping entity count mismatch');
  assert.deepEqual(
    changeSet.changes[0].fields.map((fieldChange) => fieldChange.field),
    ['firstName', 'lastName'],
    'same-record field order mismatch',
  );
  safeLog('same-record-grouping: ok');

  draft = editDraft.setDraftField(draft, data, personFirstName, 'SyntheticFirst');
  changeSet = editDraft.buildAtdbChangeSet(data, draft);
  assert.deepEqual(
    changeSet.changes[0].fields.map((fieldChange) => fieldChange.field),
    ['lastName'],
    'return-to-original no-op was not removed',
  );
  safeLog('return-to-original: ok');

  draft = editDraft.setDraftField(draft, data, familyName, 'SyntheticUpdatedFamily');
  draft = editDraft.setDraftField(draft, data, familyColor, 7);
  draft = editDraft.resetDraftField(draft, familyName);
  changeSet = editDraft.buildAtdbChangeSet(data, draft);
  assert.equal(countFields(changeSet), 2, 'field reset left unexpected count');
  draft = editDraft.resetDraftEntity(draft, 'family', 20);
  changeSet = editDraft.buildAtdbChangeSet(data, draft);
  assert.equal(countFields(changeSet), 1, 'entity reset did not clear family changes');
  draft = editDraft.clearDraft();
  assert.equal(countFields(editDraft.buildAtdbChangeSet(data, draft)), 0, 'clearDraft did not empty changes');
  safeLog('reset-flows: ok');

  draft = editDraft.createEmptyAtdbEditDraft();
  draft = editDraft.setDraftField(draft, data, personFirstName, null);
  draft = editDraft.setDraftField(draft, data, familyName, undefined);
  draft = editDraft.setDraftField(draft, data, placeShortName, '');
  changeSet = editDraft.buildAtdbChangeSet(data, draft);
  const scalarValues = changeSet.changes.flatMap((entityChange) =>
    entityChange.fields.map((fieldChange) => [fieldChange.field, fieldChange.value]),
  );
  assert.deepEqual(
    scalarValues,
    [
      ['firstName', null],
      ['familyName', null],
      ['shortName', ''],
    ],
    'clear and empty-string semantics mismatch',
  );
  safeLog('clear-and-empty-string: ok');

  draft = editDraft.createEmptyAtdbEditDraft();
  draft = editDraft.setDraftField(draft, data, { entityType: 'person', id: 1, field: 'gender' }, null);
  changeSet = editDraft.buildAtdbChangeSet(data, draft);
  assert.deepEqual(changeSet.changes[0].fields[0], { field: 'gender', value: null }, 'gender clear mismatch');
  draft = editDraft.setDraftField(draft, data, { entityType: 'person', id: 2, field: 'gender' }, undefined);
  changeSet = editDraft.buildAtdbChangeSet(data, draft);
  assert.equal(countFields(changeSet), 1, 'Unknown gender clear should stay no-op');
  safeLog('gender-clear: ok');

  draft = editDraft.createEmptyAtdbEditDraft();
  draft = editDraft.setDraftField(draft, data, { entityType: 'place', id: 11, field: 'name' }, 'SyntheticUpdatedPlace');
  draft = editDraft.setDraftField(draft, data, familyColor, 9);
  draft = editDraft.setDraftField(draft, data, personLastName, 'SyntheticOrderLast');
  draft = editDraft.setDraftField(draft, data, personFirstName, 'SyntheticOrderFirst');
  changeSet = editDraft.buildAtdbChangeSet(data, draft);
  assert.deepEqual(
    changeSet.changes.map((entityChange) => [
      entityChange.entityType,
      entityChange.id,
      entityChange.fields.map((fieldChange) => fieldChange.field),
    ]),
    [
      ['person', 1, ['firstName', 'lastName']],
      ['family', 20, ['color']],
      ['place', 11, ['name']],
    ],
    'stable change-set order mismatch',
  );
  safeLog('stable-order: ok');

  const invalidDraft = {
    changes: {
      unsupportedField: { entityType: 'person', id: 1, field: 'notes', value: 'SyntheticUnsupported' },
      invalidEntity: { entityType: 'event', id: 1, field: 'name', value: 'SyntheticUnsupported' },
      invalidValue: { entityType: 'family', id: 20, field: 'color', value: 'SyntheticUnsupported' },
      missingEntity: { entityType: 'place', id: 999, field: 'name', value: 'SyntheticUnsupported' },
    },
  };
  changeSet = editDraft.buildAtdbChangeSet(data, invalidDraft);
  assert.deepEqual(changeSet, { changes: [] }, 'runtime-invalid changes should be skipped');
  safeLog('runtime-invalid-skip: ok');

  safeLog('status: success');
} catch (error) {
  safeLog('status: failure');
  safeLog(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
