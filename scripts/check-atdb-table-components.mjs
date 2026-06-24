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
  const uiStyles = readProjectFile('components/uiStyles.ts');
  const globalsCss = readProjectFile('app/globals.css');
  assertContains(uiStyles, 'dialogPanelClassName', 'shared styles should expose dialog panel motion class');
  assertContains(uiStyles, 'statusSurfaceClassName', 'shared styles should expose status surface motion class');
  assertContains(uiStyles, 'focusRingClassName', 'shared styles should expose focus ring class');
  assertContains(globalsCss, '@media (prefers-reduced-motion: reduce)', 'global CSS should respect reduced motion');
  assertContains(globalsCss, '.gt-spinner', 'global CSS should disable spinner motion for reduced motion');
  safeLog('shared-interaction-styles: ok');

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
    'role="status"',
    'aria-live="polite"',
  ]) {
    assertContains(primitives, token, `primitive contract missing ${token}`);
  }
  safeLog('primitives-contract: ok');

  const dataTable = readProjectFile('components/DataTable.tsx');
  assertContains(dataTable, 'tableQueryResult: AtdbTableQueryResult', 'DataTable should use table query result contract');
  assertContains(dataTable, 'selectedIdSet?: ReadonlySet<number>', 'DataTable should accept precomputed selection lookup');
  assertContains(dataTable, 'allVisibleSelected?: boolean', 'DataTable should accept precomputed visible selection state');
  assertContains(dataTable, 'PersonTable', 'DataTable should route person table');
  assertContains(dataTable, 'FamilyTable', 'DataTable should route family table');
  assertContains(dataTable, 'EventTable', 'DataTable should route event table');
  assertContains(dataTable, 'PlaceTable', 'DataTable should route place table');
  assertNotContains(dataTable, 'renderPersonsTable', 'DataTable should not keep old person render function');
  assertNotContains(dataTable, 'renderFamiliesTable', 'DataTable should not keep old family render function');
  assertNotContains(dataTable, 'renderEventsTable', 'DataTable should not keep old event render function');
  assertNotContains(dataTable, 'renderPlacesTable', 'DataTable should not keep old place render function');
  safeLog('router-wrapper: ok');

  const appPage = readProjectFile('app/page.tsx');
  assertContains(appPage, "type ImportPhase = 'idle' | 'reading' | 'parsing' | 'ready' | 'error'", 'app should model import phases');
  assertContains(appPage, "type ExportPhase = 'idle' | 'preparing' | 'ready' | 'error'", 'app should model export phases');
  assertContains(appPage, 'queryAtdbTableRows(parsedData, editDraft, createAtdbTableQuery(activeEntity, renderedTableQuery))', 'app should query only active table entity with the rendered query snapshot');
  assertNotContains(appPage, 'type TableQueryResultByEntity', 'app should not keep all-entity table query result map');
  assertContains(appPage, 'const activeSelectedIdSet = useMemo(() => new Set(activeSelectedIds)', 'app should memoize active selection lookup');
  assertContains(appPage, 'const renderedIdSet = new Set(ids)', 'rendered row deselect should use Set lookup');
  assertContains(appPage, 'useDeferredValue(tableQueries)', 'app should defer table query rendering from a query map');
  assertContains(appPage, 'const renderedTableQuery = deferredTableQueries[activeEntity]', 'app should render a query from the active entity only');
  assertContains(appPage, 'disabled={!activeWritableEntity || isDownloading || isTableRefreshing}', 'bulk edit should be disabled while visible rows refresh');
  assertContains(appPage, 'useTransition()', 'app should use transition state for tab changes');
  assertContains(appPage, 'disabled={isImportBusy}', 'FileUploader should be disabled during import work');
  assertContains(appPage, 'exportStatusText', 'app should expose export pending status');
  assertContains(appPage, 'isPreviewPending={isBulkPreviewPending}', 'bulk dialog should receive preview pending state');
  assertContains(appPage, 'isApplyPending={isBulkApplyPending}', 'bulk dialog should receive apply pending state');
  safeLog('active-query-selection-path: ok');

  const scrollableDataTable = readProjectFile('components/ScrollableDataTable.tsx');
  assertContains(scrollableDataTable, 'selectedIdSet: ReadonlySet<number>', 'ScrollableDataTable should receive selectedIdSet');
  assertContains(scrollableDataTable, 'renderedTableQuery: AtdbTableQueryState', 'ScrollableDataTable should receive the rendered query snapshot');
  assertContains(scrollableDataTable, 'role="tablist"', 'ScrollableDataTable should expose tablist semantics');
  assertContains(scrollableDataTable, 'role="tabpanel"', 'ScrollableDataTable should expose tab panel semantics');
  assertContains(scrollableDataTable, 'aria-busy={isTableRefreshing}', 'ScrollableDataTable should expose pending table state');
  assertContains(scrollableDataTable, 'visibleSelectedCount = useMemo', 'visible selected count should be memoized once per render');
  assertContains(scrollableDataTable, 'allVisibleSelected', 'ScrollableDataTable should compute all visible selected once');
  assertContains(scrollableDataTable, 'isSelectionDisabled={isTableRefreshing}', 'selection controls should be disabled while rendered rows refresh');
  assertNotContains(scrollableDataTable, '.includes(id)).length', 'visible selected count should not use repeated includes lookup');
  safeLog('selection-lookup-contract: ok');

  assertContains(primitives, 'disabled: boolean', 'selection context should carry disabled state');
  assertContains(primitives, 'disabled={selection.disabled || rowIds.length === 0}', 'select-all should be disabled while rows refresh');
  assertContains(primitives, 'disabled={selection.disabled}', 'row selection should be disabled while rows refresh');

  const tableQueryToolbar = readProjectFile('components/TableQueryToolbar.tsx');
  assertContains(tableQueryToolbar, 'isPending?: boolean', 'toolbar should accept pending table state');
  assertContains(tableQueryToolbar, 'Обновляем таблицу', 'toolbar should render compact pending status');
  assertContains(tableQueryToolbar, 'role="status"', 'toolbar pending status should be announced');
  safeLog('pending-table-status: ok');

  const fileUploader = readProjectFile('components/FileUploader.tsx');
  assertContains(fileUploader, 'onFileReadStart?: (file: File) => void', 'FileUploader should expose read-start callback');
  assertContains(fileUploader, 'disabled?: boolean', 'FileUploader should accept disabled state');
  assertContains(fileUploader, 'aria-busy={disabled}', 'FileUploader should expose busy state');
  assertContains(fileUploader, 'inputRef.current?.click()', 'FileUploader should open input through ref');
  assertContains(fileUploader, 'UploadCloud', 'FileUploader should use lucide upload icon');
  assertNotContains(fileUploader, 'document.getElementById', 'FileUploader should not use document id lookup');
  assertNotContains(fileUploader, '<svg', 'FileUploader should not use manual upload SVG');
  safeLog('upload-interaction-contract: ok');

  const modal = readProjectFile('components/Modal.tsx');
  const bulkDialog = readProjectFile('components/BulkEditDialog.tsx');
  for (const [name, source] of [
    ['Modal', modal],
    ['BulkEditDialog', bulkDialog],
  ]) {
    assertContains(source, 'role="dialog"', `${name} should expose dialog role`);
    assertContains(source, 'aria-modal="true"', `${name} should expose modal semantics`);
    assertContains(source, 'aria-labelledby', `${name} should label the dialog`);
    assertContains(source, "event.key === 'Escape'", `${name} should close on Escape`);
    assertContains(source, 'previousActiveElementRef.current?.focus()', `${name} should restore focus`);
    assertContains(source, 'X className', `${name} close control should use lucide X`);
  }
  assertContains(bulkDialog, 'isPreviewPending: boolean', 'BulkEditDialog should accept preview pending state');
  assertContains(bulkDialog, 'isApplyPending: boolean', 'BulkEditDialog should accept apply pending state');
  assertContains(bulkDialog, 'preview && operation ? createAtdbBatchEditFingerprint', 'BulkEditDialog should not fingerprint without preview');
  assertContains(bulkDialog, 'Предпросмотр актуален', 'BulkEditDialog should show current preview state');
  assertContains(bulkDialog, "REASON_LABELS['stale-preview']", 'BulkEditDialog should show stale preview state');
  safeLog('dialog-pending-contract: ok');

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
