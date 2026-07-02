'use client';

import React, { useRef, useEffect, useId, useMemo } from 'react';
import DataTable from './DataTable';
import TableQueryToolbar from './TableQueryToolbar';
import type { ParsedAtdb } from '@/lib/types';
import type { AtdbDraftFieldKey, AtdbEditDraftState, AtdbSelectableEntity } from '@/lib/atdbEditDraft';
import {
  createEmptyAtdbTableQueryState,
  getWritableEntityForAtdbTableEntity,
  type AtdbTableEntity,
  type AtdbTableQueryResult,
  type AtdbTableQueryState,
} from '@/lib/atdbTableView';
import { cn } from '@/lib/utils';
import {
  secondaryButtonClassName,
  statusSurfaceClassName,
  surfaceTransitionClassName,
} from './uiStyles';

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
  isTableRefreshing: boolean;
  renderedTableQuery: AtdbTableQueryState;
  draft: AtdbEditDraftState;
  sourceData: ParsedAtdb;
  selectedRows: Record<AtdbSelectableEntity, number[]>;
  selectedIdSet: ReadonlySet<number>;
  onTableQueryChange: (entity: AtdbTableEntity, query: AtdbTableQueryState) => void;
  onRowSelectionChange: (entityType: AtdbSelectableEntity, id: number, selected: boolean) => void;
  onRenderedRowsSelectionChange: (entityType: AtdbSelectableEntity, ids: readonly number[], selected: boolean) => void;
  onClearSelection: (entityType: AtdbSelectableEntity) => void;
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
  isTableRefreshing,
  renderedTableQuery,
  draft,
  sourceData,
  selectedRows,
  selectedIdSet,
  onTableQueryChange,
  onRowSelectionChange,
  onRenderedRowsSelectionChange,
  onClearSelection,
  onDraftFieldChange,
  onDraftFieldReset,
}) => {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tablePanelId = useId();
  const activeWritableEntity = getWritableEntityForAtdbTableEntity(activeEntity);
  const selectedCount = activeWritableEntity ? selectedRows[activeWritableEntity].length : 0;
  const visibleSelectedCount = useMemo(
    () =>
      activeWritableEntity
        ? tableQueryResult.visibleIds.reduce(
            (count, id) => count + (selectedIdSet.has(id) ? 1 : 0),
            0,
          )
        : 0,
    [activeWritableEntity, selectedIdSet, tableQueryResult.visibleIds],
  );
  const allVisibleSelected =
    activeWritableEntity !== null
    && tableQueryResult.visibleIds.length > 0
    && visibleSelectedCount === tableQueryResult.visibleIds.length;
  const queryIsActive = renderedTableQuery.quickSearch.trim().length > 0 || Boolean(renderedTableQuery.filter);
  const getTabClassName = (entity: ActiveEntity) =>
    cn(
      surfaceTransitionClassName,
      'px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
      activeEntity === entity
        ? 'border-b-2 border-blue-600 text-blue-600'
        : 'text-gray-500 hover:text-gray-700',
    );

  // Reset scroll position when tab changes
  useEffect(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = 0;
    }
  }, [activeEntity]);

  return (
    <div className={cn(surfaceTransitionClassName, 'w-full flex flex-col flex-1 min-h-0')}> {/* Use flex-1 to fill available space */}
      {/* Tabs */}
      <div className="border-b border-gray-200 z-20">
        <nav className="flex gap-4 overflow-x-auto whitespace-nowrap" role="tablist" aria-label="Разделы данных ATDB">
          <button
            type="button"
            role="tab"
            aria-selected={activeEntity === 'persons'}
            aria-controls={tablePanelId}
            className={getTabClassName('persons')}
            onClick={() => onActiveEntityChange('persons')}
          >
            Персоны ({persons.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeEntity === 'families'}
            aria-controls={tablePanelId}
            className={getTabClassName('families')}
            onClick={() => onActiveEntityChange('families')}
          >
            Роды ({families.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeEntity === 'events'}
            aria-controls={tablePanelId}
            className={getTabClassName('events')}
            onClick={() => onActiveEntityChange('events')}
          >
            События ({events.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeEntity === 'places'}
            aria-controls={tablePanelId}
            className={getTabClassName('places')}
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
          isPending={isTableRefreshing}
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
              disabled={selectedCount === 0 || isTableRefreshing}
              onClick={() => onClearSelection(activeWritableEntity)}
              className={cn(secondaryButtonClassName, 'px-3 py-1 disabled:opacity-40')}
            >
              Сбросить выбор
            </button>
          </div>
        )}
        {activeEntity === 'events' && (
          <div className={cn(statusSurfaceClassName, 'border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600')} role="status" aria-live="polite">
            У событий можно редактировать только привязку места; остальные поля доступны для просмотра.
          </div>
        )}
        {/* Table content (scrollable), including header and body in one scrollable area */}
        <div
          ref={tableContainerRef}
          id={tablePanelId}
          role="tabpanel"
          aria-busy={isTableRefreshing}
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
            selectedIdSet={selectedIdSet}
            allVisibleSelected={allVisibleSelected}
            visibleSelectedCount={visibleSelectedCount}
            isSelectionDisabled={isTableRefreshing}
            isQueryActive={queryIsActive}
            sortConfig={renderedTableQuery.sort}
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
