'use client';

import React, { useRef, useEffect } from 'react';
import DataTable from './DataTable';
import TableQueryToolbar from './TableQueryToolbar';
import type { ParsedAtdb } from '@/lib/types';
import type { AtdbDraftFieldKey, AtdbEditDraftState } from '@/lib/atdbEditDraft';
import {
  createEmptyAtdbTableQueryState,
  getWritableEntityForAtdbTableEntity,
  type AtdbTableEntity,
  type AtdbTableQueryResult,
  type AtdbTableQueryState,
} from '@/lib/atdbTableView';
import type { AtdbWritableEntity } from '@/lib/sqlProcessor';

type ActiveEntity = AtdbTableEntity;

interface ScrollableDataTableProps {
  activeEntity: ActiveEntity;
  onActiveEntityChange: (activeEntity: ActiveEntity) => void;
  persons: ParsedAtdb['persons'];
  families: ParsedAtdb['families'];
  events: ParsedAtdb['events'];
  places: ParsedAtdb['places'];
  tableQuery: AtdbTableQueryState;
  tableQueryResult: AtdbTableQueryResult;
  draft: AtdbEditDraftState;
  sourceData: ParsedAtdb;
  selectedRows: Record<AtdbWritableEntity, number[]>;
  onTableQueryChange: (entity: AtdbTableEntity, query: AtdbTableQueryState) => void;
  onRowSelectionChange: (entityType: AtdbWritableEntity, id: number, selected: boolean) => void;
  onRenderedRowsSelectionChange: (entityType: AtdbWritableEntity, ids: readonly number[], selected: boolean) => void;
  onClearSelection: (entityType: AtdbWritableEntity) => void;
  onDraftFieldChange: (key: AtdbDraftFieldKey, value: unknown) => void;
  onDraftFieldReset: (key: AtdbDraftFieldKey) => void;
}

const ScrollableDataTable: React.FC<ScrollableDataTableProps> = ({
  activeEntity,
  onActiveEntityChange,
  persons,
  families,
  events,
  places,
  tableQuery,
  tableQueryResult,
  draft,
  sourceData,
  selectedRows,
  onTableQueryChange,
  onRowSelectionChange,
  onRenderedRowsSelectionChange,
  onClearSelection,
  onDraftFieldChange,
  onDraftFieldReset,
}) => {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const activeWritableEntity = getWritableEntityForAtdbTableEntity(activeEntity);
  const selectedCount = activeWritableEntity ? selectedRows[activeWritableEntity].length : 0;
  const visibleSelectedCount = activeWritableEntity
    ? tableQueryResult.visibleIds.filter((id) => selectedRows[activeWritableEntity].includes(id)).length
    : 0;
  const queryIsActive = tableQuery.quickSearch.trim().length > 0 || Boolean(tableQuery.filter);

  // Reset scroll position when tab changes
  useEffect(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = 0;
    }
  }, [activeEntity]);

  return (
    <div className="w-full flex flex-col flex-1 min-h-0"> {/* Use flex-1 to fill available space */}
      {/* Tabs */}
      <div className="border-b border-gray-200 z-20">
        <nav className="flex gap-4 overflow-x-auto whitespace-nowrap">
          <button
            className={`py-2 px-4 font-medium text-sm ${
              activeEntity === 'persons'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => onActiveEntityChange('persons')}
          >
            Персоны ({persons.length})
          </button>
          <button
            className={`py-2 px-4 font-medium text-sm ${
              activeEntity === 'families'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => onActiveEntityChange('families')}
          >
            Роды ({families.length})
          </button>
          <button
            className={`py-2 px-4 font-medium text-sm ${
              activeEntity === 'events'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => onActiveEntityChange('events')}
          >
            События ({events.length})
          </button>
          <button
            className={`py-2 px-4 font-medium text-sm ${
              activeEntity === 'places'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => onActiveEntityChange('places')}
          >
            Места ({places.length})
          </button>
        </nav>
      </div>

      <div className="flex-1 flex flex-col shadow-sm overflow-hidden">
        <TableQueryToolbar
          activeEntity={activeEntity}
          query={tableQuery}
          visibleCount={tableQueryResult.visibleCount}
          totalCount={tableQueryResult.totalCount}
          activeFilterCount={tableQueryResult.activeFilterCount}
          onQueryChange={(nextQuery) => onTableQueryChange(activeEntity, nextQuery)}
        />
        {activeWritableEntity && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700">
            <div className="flex flex-wrap items-center gap-3">
              <span>Выбрано всего: {selectedCount}</span>
              <span>Видимых выбрано: {visibleSelectedCount}</span>
            </div>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => onClearSelection(activeWritableEntity)}
              className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Сбросить выбор
            </button>
          </div>
        )}
        {activeEntity === 'events' && (
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
            События доступны только для просмотра.
          </div>
        )}
        {/* Table content (scrollable), including header and body in one scrollable area */}
        <div
          ref={tableContainerRef}
          className="flex-1 overflow-auto relative"
          style={{ maxHeight: 'calc(100vh - 250px)' }} // Adjust based on header and other elements height
        >
          <DataTable
            activeEntity={activeEntity}
            tableQueryResult={tableQueryResult}
            allPlaces={places}
            draft={draft}
            sourceData={sourceData}
            selectedIds={activeWritableEntity ? selectedRows[activeWritableEntity] : []}
            isQueryActive={queryIsActive}
            sortConfig={tableQuery.sort}
            onSortChange={(sortConfig) => onTableQueryChange(activeEntity, { ...tableQuery, sort: sortConfig })}
            onClearQuery={() => onTableQueryChange(activeEntity, createEmptyAtdbTableQueryState())}
            onRowSelectionChange={onRowSelectionChange}
            onRenderedRowsSelectionChange={onRenderedRowsSelectionChange}
            onDraftFieldChange={onDraftFieldChange}
            onDraftFieldReset={onDraftFieldReset}
          />
        </div>
      </div>
    </div>
  );
};

export default ScrollableDataTable;
