#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

function safeLog(message) {
  console.log(`[safe-atdb-table-components] ${message}`);
}

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function assertContains(source, token, message) {
  assert.ok(source.includes(token), message);
}

function assertNotContains(source, token, message) {
  assert.ok(!source.includes(token), message);
}

try {
  safeLog('status: start');

  const packageJson = JSON.parse(readProjectFile('package.json'));
  assert.equal(
    packageJson.scripts?.['test:atdb:table-components'],
    'node scripts/check-atdb-table-components.mjs',
    'table component npm script mismatch',
  );
  safeLog('npm-script: ok');

  const primitives = readProjectFile('components/atdb-table/AtdbTablePrimitives.tsx');
  for (const token of [
    'export function AtdbTableFrame',
    'export function SortableHeaderCell',
    'aria-sort',
    'type="button"',
    'export function SelectionHeaderCell',
    'Выбрать все видимые строки',
    'export function SelectionCell',
    'Нет строк по текущему поиску или фильтру',
    'getStickyIdHeaderClassName',
    'getStickyIdCellClassName',
  ]) {
    assertContains(primitives, token, `primitive contract missing ${token}`);
  }
  safeLog('primitives-contract: ok');

  const dataTable = readProjectFile('components/DataTable.tsx');
  assertContains(dataTable, 'tableQueryResult: AtdbTableQueryResult', 'DataTable should use table query result contract');
  assertContains(dataTable, 'PersonTable', 'DataTable should route person table');
  assertContains(dataTable, 'FamilyTable', 'DataTable should route family table');
  assertContains(dataTable, 'EventTable', 'DataTable should route event table');
  assertContains(dataTable, 'PlaceTable', 'DataTable should route place table');
  assertNotContains(dataTable, 'renderPersonsTable', 'DataTable should not keep old person render function');
  assertNotContains(dataTable, 'renderFamiliesTable', 'DataTable should not keep old family render function');
  assertNotContains(dataTable, 'renderEventsTable', 'DataTable should not keep old event render function');
  assertNotContains(dataTable, 'renderPlacesTable', 'DataTable should not keep old place render function');
  safeLog('router-wrapper: ok');

  const personTable = readProjectFile('components/atdb-table/PersonTable.tsx');
  const familyTable = readProjectFile('components/atdb-table/FamilyTable.tsx');
  const eventTable = readProjectFile('components/atdb-table/EventTable.tsx');
  const placeTable = readProjectFile('components/atdb-table/PlaceTable.tsx');

  for (const [name, source] of [
    ['PersonTable', personTable],
    ['FamilyTable', familyTable],
    ['PlaceTable', placeTable],
  ]) {
    assertContains(source, 'SelectionHeaderCell', `${name} should expose selection header`);
    assertContains(source, 'SelectionCell', `${name} should expose selection cells`);
    assertContains(source, 'SortableHeaderCell', `${name} should use sortable headers`);
    assertContains(source, 'EmptyTableState', `${name} should use shared empty state`);
  }
  assertNotContains(eventTable, 'SelectionHeaderCell', 'EventTable should stay read-only without selection header');
  assertNotContains(eventTable, 'SelectionCell', 'EventTable should stay read-only without selection cells');
  assertNotContains(eventTable, 'Editable', 'EventTable should stay read-only without editable controls');
  assertContains(eventTable, 'getEventTypeName', 'EventTable should preserve event type display formatting');
  safeLog('entity-tables: ok');

  const editableCell = readProjectFile('components/EditableCell.tsx');
  const tableEditors = readProjectFile('components/atdb-table/useAtdbTableEditors.tsx');
  const integerHelper = readProjectFile('lib/atdbIntegerInput.ts');
  const batchEdit = readProjectFile('lib/atdbBatchEdit.ts');

  assertContains(editableCell, 'parseAtdbIntegerInput', 'EditableNumberCell should use shared integer parser');
  assertContains(tableEditors, 'parseAtdbIntegerInput', 'place-link editor should use shared integer parser');
  assertContains(batchEdit, 'return parseAtdbIntegerInput(value)', 'batch parser wrapper should delegate to shared helper');
  assertContains(integerHelper, 'Number.isSafeInteger', 'shared integer parser should reject unsafe integers');

  for (const [relativePath, source] of [
    ['components/DataTable.tsx', dataTable],
    ['components/EditableCell.tsx', editableCell],
    ['components/atdb-table/useAtdbTableEditors.tsx', tableEditors],
    ['components/atdb-table/PersonTable.tsx', personTable],
    ['components/atdb-table/FamilyTable.tsx', familyTable],
    ['components/atdb-table/EventTable.tsx', eventTable],
    ['components/atdb-table/PlaceTable.tsx', placeTable],
  ]) {
    assertNotContains(source, 'Number.parseInt', `${relativePath} should not use prefix integer parsing`);
  }
  safeLog('strict-integer-editor-path: ok');

  safeLog('status: success');
} catch (error) {
  safeLog('status: failure');
  safeLog(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
