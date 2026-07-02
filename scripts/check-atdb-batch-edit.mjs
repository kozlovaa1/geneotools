#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const projectRoot = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geneotools-batch-edit-'));
const requireFromScript = createRequire(import.meta.url);

function safeLog(message) {
  console.log(`[safe-atdb-batch-edit] ${message}`);
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
        firstName: 'SyntheticAlpha',
        lastName: 'SyntheticFamily',
        birthLastName: 'SyntheticBirthFamily',
        birthDate: '1901-02-03',
        patronymic: '',
        gender: 'M',
        birthPlaceId: 10,
        deathPlaceId: 11,
      },
      {
        id: 2,
        firstName: 'SyntheticBeta',
        lastName: '',
        gender: 'Unknown',
      },
      {
        id: 3,
        firstName: 'SyntheticGamma',
        lastName: 'SyntheticOld',
        gender: 'F',
        birthPlaceId: 10,
      },
    ],
    families: [
      {
        id: 20,
        familyName: 'SyntheticRoot',
        husbandLastName: 'SyntheticOldman',
        wifeLastName: 'SyntheticOldwoman',
        comment: '',
        color: 3,
        childrenIds: [],
      },
    ],
    events: [],
    places: [
      {
        id: 10,
        name: 'SyntheticTown',
        shortName: '',
      },
      {
        id: 11,
        name: 'SyntheticVillage',
      },
      {
        id: 12,
        name: 'SyntheticHarbor',
        parentId: 10,
      },
    ],
    metadata: {},
  };
}

function countFields(changeSet) {
  return changeSet.changes.reduce((total, entityChange) => total + entityChange.fields.length, 0);
}

function fieldValues(changeSet, entityType, id) {
  return new Map(
    (changeSet.changes.find((entityChange) => entityChange.entityType === entityType && entityChange.id === id)?.fields ?? [])
      .map((fieldChange) => [fieldChange.field, fieldChange.value]),
  );
}

function affectedIds(preview) {
  return preview.rows.filter((row) => row.status === 'affected').map((row) => row.id);
}

function previewReasonCount(preview, reason) {
  return preview.reasonCounts[reason] ?? 0;
}

try {
  safeLog('status: start');
  fs.symlinkSync(path.join(projectRoot, 'node_modules'), path.join(tempDir, 'node_modules'), 'dir');
  compileTree(path.join(projectRoot, 'lib'), path.join(tempDir, 'lib'));

  const batchEdit = requireFromScript(path.join(tempDir, 'lib/atdbBatchEdit.js'));
  const editDraft = requireFromScript(path.join(tempDir, 'lib/atdbEditDraft.js'));
  const integerInput = requireFromScript(path.join(tempDir, 'lib/atdbIntegerInput.js'));
  const data = syntheticParsedData();
  const batchFields = batchEdit.getAtdbBatchEditableFields();
  assert.ok(
    batchFields.some((field) => field.entityType === 'person' && field.field === 'birthLastName'),
    'birthLastName should be bulk-editable text',
  );
  assert.equal(
    batchFields.some((field) => field.field === 'birthDate' || field.field === 'deathDate'),
    false,
    'date fields should stay out of bulk edit',
  );
  assert.equal(
    batchFields.some((field) => field.entityType === 'place' && field.field === 'parentId'),
    false,
    'place parent should stay out of bulk edit',
  );
  assert.equal(batchEdit.getAtdbBatchEditableFields('event').length, 0, 'events should stay out of bulk edit');
  safeLog('bulk-field-split: ok');

  for (const parseIntegerInput of [integerInput.parseAtdbIntegerInput, batchEdit.parseAtdbBatchIntegerInput]) {
    assert.equal(parseIntegerInput('12'), 12, 'integer input parse mismatch');
    assert.equal(parseIntegerInput(' 12 '), 12, 'trimmed integer input parse mismatch');
    assert.equal(parseIntegerInput('12abc'), undefined, 'partial integer input should be rejected');
    assert.equal(parseIntegerInput('1e2'), undefined, 'exponential integer input should be rejected');
    assert.equal(parseIntegerInput('12.9'), undefined, 'decimal integer input should be rejected');
    assert.equal(parseIntegerInput(String(Number.MAX_SAFE_INTEGER + 1)), undefined, 'unsafe integer input should be rejected');
  }
  safeLog('strict-integer-input: ok');

  let draft = editDraft.createEmptyAtdbEditDraft();
  let preview = batchEdit.previewAtdbBatchEdit(data, draft, {
    entityType: 'person',
    field: 'firstName',
    action: 'fill',
    value: 'SyntheticBatch',
    scope: { type: 'selected', ids: [2, 1, 1] },
  });
  assert.deepEqual(affectedIds(preview), [2, 1], 'selected fill order or dedupe mismatch');
  assert.equal(preview.counts.affected, 2, 'selected fill affected count mismatch');
  draft = batchEdit.applyAtdbBatchEdit(data, draft, preview).draft;
  let changeSet = editDraft.buildAtdbChangeSet(data, draft);
  assert.equal(countFields(changeSet), 2, 'selected fill change count mismatch');
  safeLog('selected-fill-text: ok');

  draft = editDraft.createEmptyAtdbEditDraft();
  preview = batchEdit.previewAtdbBatchEdit(data, draft, {
    entityType: 'person',
    field: 'lastName',
    action: 'clear',
    scope: { type: 'selected', ids: [1] },
  });
  draft = batchEdit.applyAtdbBatchEdit(data, draft, preview).draft;
  preview = batchEdit.previewAtdbBatchEdit(data, draft, {
    entityType: 'place',
    field: 'shortName',
    action: 'fill',
    value: '',
    scope: { type: 'selected', ids: [11] },
  });
  draft = batchEdit.applyAtdbBatchEdit(data, draft, preview).draft;
  changeSet = editDraft.buildAtdbChangeSet(data, draft);
  assert.equal(fieldValues(changeSet, 'person', 1).get('lastName'), null, 'clear did not produce null');
  assert.equal(fieldValues(changeSet, 'place', 11).get('shortName'), '', 'empty string was not preserved');
  safeLog('clear-vs-empty-string: ok');

  draft = editDraft.createEmptyAtdbEditDraft();
  for (const operation of [
    { entityType: 'person', field: 'gender', action: 'fill', value: 'F', scope: { type: 'selected', ids: [2] } },
    { entityType: 'family', field: 'color', action: 'fill', value: 7, scope: { type: 'selected', ids: [20] } },
    { entityType: 'person', field: 'birthPlaceId', action: 'fill', value: 12, scope: { type: 'selected', ids: [1] } },
    { entityType: 'person', field: 'deathPlaceId', action: 'clear', scope: { type: 'selected', ids: [1] } },
  ]) {
    preview = batchEdit.previewAtdbBatchEdit(data, draft, operation);
    assert.equal(preview.counts.affected, 1, 'scalar fill affected count mismatch');
    draft = batchEdit.applyAtdbBatchEdit(data, draft, preview).draft;
  }
  changeSet = editDraft.buildAtdbChangeSet(data, draft);
  assert.equal(fieldValues(changeSet, 'person', 2).get('gender'), 'F', 'gender fill mismatch');
  assert.equal(fieldValues(changeSet, 'family', 20).get('color'), 7, 'color fill mismatch');
  assert.equal(fieldValues(changeSet, 'person', 1).get('birthPlaceId'), 12, 'birth place fill mismatch');
  assert.equal(fieldValues(changeSet, 'person', 1).get('deathPlaceId'), null, 'death place clear mismatch');
  safeLog('scalar-and-place-link-fill: ok');

  draft = editDraft.createEmptyAtdbEditDraft();
  preview = batchEdit.previewAtdbBatchEdit(data, draft, {
    entityType: 'person',
    field: 'firstName',
    action: 'replace',
    searchText: 'synthetic',
    replacementText: 'Batch',
    caseSensitive: false,
    scope: { type: 'all' },
  });
  assert.equal(preview.counts.affected, 3, 'string replace affected count mismatch');
  preview = batchEdit.previewAtdbBatchEdit(data, draft, {
    entityType: 'person',
    field: 'firstName',
    action: 'replace',
    searchText: 'missing-token',
    replacementText: 'Batch',
    scope: { type: 'all' },
  });
  assert.equal(preview.counts.noop, 3, 'string replace no-op count mismatch');
  preview = batchEdit.previewAtdbBatchEdit(data, draft, {
    entityType: 'person',
    field: 'gender',
    action: 'replace',
    searchText: 'M',
    replacementText: 'F',
    scope: { type: 'all' },
  });
  assert.equal(preview.valid, false, 'non-string replace should be invalid');
  assert.equal(preview.validation.code, 'replace-not-supported', 'non-string replace reason mismatch');
  safeLog('string-replace: ok');

  draft = editDraft.createEmptyAtdbEditDraft();
  for (const [operator, value, expected] of [
    ['contains', 'old', [3]],
    ['equals', 'SyntheticFamily', [1]],
    ['empty', '', [2]],
    ['not-empty', '', [1, 3]],
  ]) {
    preview = batchEdit.previewAtdbBatchEdit(data, draft, {
      entityType: 'person',
      field: 'patronymic',
      action: 'fill',
      value: 'SyntheticPredicate',
      scope: {
        type: 'predicate',
        predicate: { field: 'lastName', operator, value, caseSensitive: false },
      },
    });
    assert.deepEqual(affectedIds(preview), expected, `predicate ${operator} result mismatch`);
  }
  safeLog('predicate-operators: ok');

  draft = editDraft.setDraftField(draft, data, { entityType: 'person', id: 1, field: 'firstName' }, 'SyntheticDirtyTarget');
  preview = batchEdit.previewAtdbBatchEdit(data, draft, {
    entityType: 'person',
    field: 'lastName',
    action: 'fill',
    value: 'SyntheticFromDirtyPredicate',
    scope: {
      type: 'predicate',
      predicate: { field: 'firstName', operator: 'equals', value: 'SyntheticDirtyTarget' },
    },
  });
  assert.deepEqual(affectedIds(preview), [1], 'dirty predicate baseline mismatch');
  assert.equal(preview.rows.find((row) => row.id === 1)?.overwritesDirty, false, 'predicate target should not be dirty');
  safeLog('dirty-predicate-baseline: ok');

  draft = editDraft.setDraftField(draft, data, { entityType: 'person', id: 3, field: 'firstName' }, 'SyntheticManualOld');
  preview = batchEdit.previewAtdbBatchEdit(data, draft, {
    entityType: 'person',
    field: 'firstName',
    action: 'replace',
    searchText: 'Manual',
    replacementText: 'Batch',
    scope: { type: 'selected', ids: [3] },
  });
  assert.equal(preview.counts.affected, 1, 'existing draft baseline replace mismatch');
  assert.equal(preview.rows[0].overwritesDirty, true, 'dirty overwrite flag mismatch');
  safeLog('existing-draft-baseline: ok');

  draft = editDraft.createEmptyAtdbEditDraft();
  for (const operation of [
    { entityType: 'event', field: 'description', action: 'fill', value: 'SyntheticInvalid', scope: { type: 'all' } },
    { entityType: 'person', field: 'notes', action: 'fill', value: 'SyntheticInvalid', scope: { type: 'all' } },
    { entityType: 'family', field: 'color', action: 'fill', value: 'SyntheticInvalid', scope: { type: 'all' } },
  ]) {
    preview = batchEdit.previewAtdbBatchEdit(data, draft, operation);
    const result = batchEdit.applyAtdbBatchEdit(data, draft, preview);
    assert.equal(preview.valid, false, 'invalid operation should not be valid');
    assert.equal(countFields(editDraft.buildAtdbChangeSet(data, result.draft)), 0, 'invalid operation mutated draft');
  }
  safeLog('runtime-invalid-skip: ok');

  draft = editDraft.createEmptyAtdbEditDraft();
  for (const operation of [
    { entityType: 'person', field: 'firstName', action: 'fill', scope: { type: 'all' } },
    { entityType: 'person', field: 'firstName', action: 'fill', value: null, scope: { type: 'all' } },
    { entityType: 'family', field: 'color', action: 'fill', scope: { type: 'all' } },
  ]) {
    preview = batchEdit.previewAtdbBatchEdit(data, draft, operation);
    const result = batchEdit.applyAtdbBatchEdit(data, draft, preview);
    assert.equal(preview.valid, false, 'fill without explicit value should not be valid');
    assert.equal(preview.validation.code, 'invalid-value', 'fill without explicit value reason mismatch');
    assert.equal(countFields(editDraft.buildAtdbChangeSet(data, result.draft)), 0, 'invalid fill operation mutated draft');
  }
  safeLog('missing-fill-value-skip: ok');

  draft = editDraft.createEmptyAtdbEditDraft();
  preview = batchEdit.previewAtdbBatchEdit(data, draft, {
    entityType: 'person',
    field: 'birthPlaceId',
    action: 'fill',
    value: 999,
    scope: { type: 'selected', ids: [1, 2] },
  });
  assert.equal(previewReasonCount(preview, 'place-not-found'), 1, 'missing place reason mismatch');
  assert.equal(previewReasonCount(preview, 'not-editable-link'), 1, 'not editable link reason mismatch');
  assert.equal(preview.counts.affected, 0, 'invalid place link should not be affected');
  safeLog('place-link-skip-reasons: ok');

  draft = editDraft.createEmptyAtdbEditDraft();
  preview = batchEdit.previewAtdbBatchEdit(data, draft, {
    entityType: 'person',
    field: 'lastName',
    action: 'fill',
    value: 'SyntheticStale',
    scope: { type: 'selected', ids: [1] },
  });
  const changedDraft = editDraft.setDraftField(draft, data, { entityType: 'person', id: 1, field: 'lastName' }, 'SyntheticManual');
  const staleResult = batchEdit.applyAtdbBatchEdit(data, changedDraft, preview);
  assert.equal(staleResult.stale, true, 'stale preview was not blocked');
  assert.equal(fieldValues(editDraft.buildAtdbChangeSet(data, staleResult.draft), 'person', 1).get('lastName'), 'SyntheticManual', 'stale apply mutated draft');
  safeLog('stale-preview-block: ok');

  preview = batchEdit.previewAtdbBatchEdit(data, editDraft.createEmptyAtdbEditDraft(), {
    entityType: 'person',
    field: 'lastName',
    action: 'fill',
    value: 'SyntheticOrdered',
    scope: { type: 'selected', ids: [3, 1, 3, 2] },
  });
  assert.deepEqual(affectedIds(preview), [3, 1, 2], 'stable selected order mismatch');
  safeLog('stable-order: ok');

  safeLog('status: success');
} catch (error) {
  safeLog('status: failure');
  safeLog(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
