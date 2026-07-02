#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const projectRoot = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geneotools-table-view-'));
const requireFromScript = createRequire(import.meta.url);

function safeLog(message) {
  console.log(`[safe-atdb-table-view] ${message}`);
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
        lastName: 'SyntheticFamily10',
        birthLastName: 'SyntheticBirthFamily10',
        patronymic: 'SyntheticMiddle',
        gender: 'M',
        birthDate: '1901',
        deathDate: '',
        birthPlaceId: 100,
        deathPlaceId: 101,
        notes: 'SyntheticNoteOne',
        occupation: 'SyntheticArchivist',
      },
      {
        id: 2,
        firstName: 'SyntheticBeta',
        lastName: '',
        patronymic: '',
        gender: 'Unknown',
        birthDate: '1902',
        birthPlaceId: 102,
        notes: '',
        occupation: 'SyntheticBuilder',
      },
      {
        id: 3,
        firstName: 'SyntheticGamma',
        lastName: 'SyntheticFamily2',
        birthLastName: 'SyntheticBirthFamily2',
        gender: 'F',
        birthDate: '1903',
        birthPlaceId: 101,
        deathPlaceId: 102,
        notes: 'SyntheticDeltaMarker',
        occupation: 'SyntheticCurator',
      },
    ],
    families: [
      {
        id: 20,
        familyName: 'SyntheticLineageAlpha',
        husbandLastName: '',
        wifeLastName: 'SyntheticBranch',
        comment: '',
        color: 10,
        childrenIds: [],
      },
      {
        id: 21,
        familyName: 'SyntheticLineageBeta',
        husbandLastName: 'SyntheticRoot',
        wifeLastName: '',
        comment: 'SyntheticFamilyComment',
        color: 2,
        childrenIds: [],
      },
    ],
    events: [
      {
        id: 30,
        personIds: [2, 1],
        eventType: 'EventType1',
        date: '1900',
        place: 'SyntheticTown',
        placeId: 100,
        description: 'SyntheticStart',
      },
      {
        id: 31,
        personIds: [1],
        eventType: 'EventType2',
        date: '1905',
        place: 'SyntheticVillage',
        placeId: 101,
        description: '',
      },
      {
        id: 32,
        personIds: [],
        eventType: 'SyntheticCustomEvent',
        date: '',
        place: '',
        description: 'SyntheticOpenEvent',
      },
    ],
    places: [
      {
        id: 100,
        name: 'SyntheticTown',
        shortName: 'SyntheticTownShort',
        comment: '',
      },
      {
        id: 101,
        name: 'SyntheticVillage',
        shortName: 'SyntheticVillageShort',
        comment: 'SyntheticVillageComment',
        parentId: 100,
      },
      {
        id: 102,
        name: '',
        shortName: 'SyntheticHarbor',
        comment: 'SyntheticHarborComment',
        parentId: 101,
      },
      {
        id: 103,
        name: 'SyntheticAnchor',
        shortName: '',
        comment: '',
      },
    ],
    metadata: {},
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ids(result) {
  return result.visibleIds;
}

function query(tableView, data, draft, entity, overrides = {}) {
  return tableView.queryAtdbTableRows(data, draft, {
    entity,
    ...overrides,
  });
}

try {
  safeLog('status: start');
  fs.symlinkSync(path.join(projectRoot, 'node_modules'), path.join(tempDir, 'node_modules'), 'dir');
  compileTree(path.join(projectRoot, 'lib'), path.join(tempDir, 'lib'));

  const tableView = requireFromScript(path.join(tempDir, 'lib/atdbTableView.js'));
  const editDraft = requireFromScript(path.join(tempDir, 'lib/atdbEditDraft.js'));
  const tableViewSource = fs.readFileSync(path.join(projectRoot, 'lib/atdbTableView.ts'), 'utf8');
  const data = syntheticParsedData();
  const original = clone(data);
  let draft = editDraft.createEmptyAtdbEditDraft();

  assert.equal(tableView.getWritableEntityForAtdbTableEntity('persons'), 'person', 'person writable mapping mismatch');
  assert.equal(tableView.getWritableEntityForAtdbTableEntity('families'), 'family', 'family writable mapping mismatch');
  assert.equal(tableView.getWritableEntityForAtdbTableEntity('events'), null, 'event writable mapping mismatch');
  assert.equal(tableView.getWritableEntityForAtdbTableEntity('places'), 'place', 'place writable mapping mismatch');
  safeLog('entity-contract: ok');

  assert.ok(
    tableViewSource.includes('function createAtdbTableQueryContext'),
    'table query should create a per-query context',
  );
  assert.ok(
    tableViewSource.includes('cellValueCache: new Map()'),
    'table query should keep a per-query cell value cache',
  );
  assert.ok(
    tableViewSource.includes('formatAtdbPlaceLabel(data, placeId'),
    'draft-aware place labels should use shared place label helper',
  );
  safeLog('query-cache-contract: ok');

  assert.deepEqual(ids(query(tableView, data, draft, 'persons')), [1, 2, 3], 'empty person query order mismatch');
  assert.deepEqual(ids(query(tableView, data, draft, 'families')), [20, 21], 'empty family query order mismatch');
  safeLog('empty-query-order: ok');

  assert.deepEqual(ids(query(tableView, data, draft, 'persons', { quickSearch: 'alpha' })), [1], 'person quick search mismatch');
  assert.deepEqual(ids(query(tableView, data, draft, 'families', { quickSearch: 'root' })), [21], 'family quick search mismatch');
  assert.deepEqual(ids(query(tableView, data, draft, 'events', { quickSearch: 'syntheticstart' })), [30], 'event quick search mismatch');
  assert.deepEqual(ids(query(tableView, data, draft, 'places', { quickSearch: 'harbor' })), [102], 'place quick search mismatch');
  assert.deepEqual(ids(query(tableView, data, draft, 'persons', { quickSearch: 'delta' })), [3], 'multi-column person search mismatch');
  assert.deepEqual(ids(query(tableView, data, draft, 'persons', { quickSearch: 'birthfamily2' })), [3], 'birth last name search mismatch');
  safeLog('quick-search: ok');

  for (const [operator, value, expected] of [
    ['contains', 'family', [1, 3]],
    ['equals', 'SyntheticFamily10', [1]],
    ['empty', undefined, [2]],
    ['not-empty', undefined, [1, 3]],
  ]) {
    const result = query(tableView, data, draft, 'persons', {
      filter: { field: 'lastName', operator, value },
    });
    assert.deepEqual(ids(result), expected, `person filter ${operator} mismatch`);
    assert.equal(result.activeFilterCount, 1, `person filter ${operator} count mismatch`);
  }
  safeLog('field-filters: ok');

  assert.deepEqual(
    ids(query(tableView, data, draft, 'events', { filter: { field: 'personId', operator: 'equals', value: '2' } })),
    [30],
    'event filter without writable entity mismatch',
  );
  assert.deepEqual(
    ids(query(tableView, data, draft, 'events', { filter: { field: 'eventType', operator: 'contains', value: 'Рождение' } })),
    [30],
    'event type display filter mismatch',
  );
  safeLog('event-virtual-filter: ok');

  assert.deepEqual(
    ids(query(tableView, data, draft, 'persons', { filter: { field: 'birthPlace', operator: 'equals', value: 'SyntheticTown' } })),
    [1],
    'birth place display filter mismatch',
  );
  assert.deepEqual(
    ids(query(tableView, data, draft, 'persons', { quickSearch: 'SyntheticHarbor' })),
    [2, 3],
    'place display quick search mismatch',
  );
  safeLog('person-place-display: ok');

  draft = editDraft.setDraftField(draft, data, { entityType: 'person', id: 2, field: 'lastName' }, 'SyntheticDraftFamily');
  assert.deepEqual(ids(query(tableView, data, draft, 'persons', { quickSearch: 'draftfamily' })), [2], 'draft-aware search mismatch');
  assert.deepEqual(
    ids(query(tableView, data, draft, 'persons', { sort: { key: 'lastName', direction: 'ascending' } })),
    [2, 3, 1],
    'draft-aware string sort mismatch',
  );
  safeLog('draft-aware-search-sort: ok');

  assert.deepEqual(
    ids(query(tableView, data, draft, 'persons', { sort: { key: 'lastName', direction: 'descending' } })),
    [1, 3, 2],
    'descending string sort mismatch',
  );
  assert.deepEqual(
    ids(query(tableView, data, draft, 'families', { sort: { key: 'color', direction: 'ascending' } })),
    [21, 20],
    'numeric sort mismatch',
  );
  safeLog('sorting: ok');

  assert.deepEqual(
    ids(query(tableView, data, draft, 'persons', {
      quickSearch: 'synthetic',
      filter: { field: 'lastName', operator: 'not-empty' },
      sort: { key: 'unknown-field', direction: 'ascending' },
    })),
    [1, 2, 3],
    'invalid sort should preserve filtered order',
  );
  const invalidFilterResult = query(tableView, data, draft, 'persons', {
    quickSearch: 'gamma',
    filter: { field: 'unknown-field', operator: 'equals', value: 'SyntheticFamily2' },
  });
  assert.deepEqual(ids(invalidFilterResult), [3], 'invalid filter should preserve quick search result');
  assert.equal(invalidFilterResult.activeFilterCount, 0, 'invalid filter should not activate field filter');
  safeLog('invalid-query-inputs: ok');

  draft = editDraft.setDraftField(draft, data, { entityType: 'person', id: 3, field: 'birthPlaceId' }, 100);
  assert.deepEqual(
    ids(query(tableView, data, draft, 'persons', { filter: { field: 'birthPlace', operator: 'contains', value: 'SyntheticTown' } })),
    [1, 2, 3],
    'draft-aware birth place link mismatch',
  );
  draft = editDraft.setDraftField(draft, data, { entityType: 'person', id: 1, field: 'deathPlaceId' }, 102);
  assert.deepEqual(
    ids(query(tableView, data, draft, 'persons', { filter: { field: 'deathPlace', operator: 'contains', value: 'SyntheticHarbor' } })),
    [1, 3],
    'draft-aware death place link mismatch',
  );
  safeLog('draft-place-links: ok');

  draft = editDraft.setDraftField(draft, data, { entityType: 'place', id: 100, field: 'name' }, 'SyntheticRenamedTown');
  assert.deepEqual(
    ids(query(tableView, data, draft, 'persons', { quickSearch: 'renamedtown' })),
    [1, 2, 3],
    'draft-aware linked place name mismatch',
  );
  draft = editDraft.setDraftField(draft, data, { entityType: 'place', id: 102, field: 'shortName' }, 'SyntheticRenamedHarbor');
  assert.deepEqual(
    ids(query(tableView, data, draft, 'persons', { quickSearch: 'renamedharbor' })),
    [1, 2, 3],
    'draft-aware linked place short name mismatch',
  );
  safeLog('draft-linked-place-labels: ok');

  draft = editDraft.setDraftField(draft, data, { entityType: 'person', id: 1, field: 'birthDate' }, '1888-01-02');
  assert.deepEqual(
    ids(query(tableView, data, draft, 'persons', { filter: { field: 'birthDate', operator: 'equals', value: '1888-01-02' } })),
    [1],
    'draft-aware birth date mismatch',
  );
  draft = editDraft.setDraftField(draft, data, { entityType: 'event', id: 31, field: 'placeId' }, 102);
  assert.deepEqual(
    ids(query(tableView, data, draft, 'events', { quickSearch: 'renamedharbor' })),
    [31],
    'draft-aware event place mismatch',
  );
  draft = editDraft.setDraftField(draft, data, { entityType: 'place', id: 101, field: 'parentId' }, 103);
  assert.deepEqual(
    ids(query(tableView, data, draft, 'places', { filter: { field: 'parentPlace', operator: 'equals', value: 'SyntheticAnchor' } })),
    [101],
    'draft-aware place parent mismatch',
  );
  safeLog('new-draft-fields: ok');

  assert.deepEqual(
    ids(query(tableView, data, draft, 'events', { sort: { key: 'personId', direction: 'ascending' } })),
    [31, 30, 32],
    'event personId sort mismatch',
  );
  assert.deepEqual(
    ids(query(tableView, data, draft, 'events', { quickSearch: 'Рождение' })),
    [30],
    'event type display search mismatch',
  );
  safeLog('event-display-sort-search: ok');

  assert.deepEqual(data, original, 'query helper mutated source data');
  safeLog('immutability: ok');
  safeLog('status: success');
} catch (error) {
  safeLog('status: failure');
  safeLog(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
