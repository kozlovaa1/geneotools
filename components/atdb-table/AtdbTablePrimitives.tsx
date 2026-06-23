import React from 'react';
import type {
  AtdbTableColumn,
  AtdbTableSortConfig,
} from '@/lib/atdbTableView';
import type { AtdbWritableEntity } from '@/lib/sqlProcessor';

export const ATDB_TABLE_CELL_CLASS_NAME = 'border-b px-4 py-2';
export const ATDB_TABLE_ROW_CLASS_NAME = 'hover:bg-gray-50';

export interface AtdbTableSelectionContext {
  entityType: AtdbWritableEntity;
  selectedIds: readonly number[];
  visibleIds: readonly number[];
  onRowSelectionChange: (entityType: AtdbWritableEntity, id: number, selected: boolean) => void;
  onRenderedRowsSelectionChange: (
    entityType: AtdbWritableEntity,
    ids: readonly number[],
    selected: boolean,
  ) => void;
}

export interface AtdbTableRenderContext {
  columns: readonly AtdbTableColumn[];
  visibleIds: readonly number[];
  totalCount: number;
  isQueryActive: boolean;
  sortConfig: AtdbTableSortConfig | null;
  onSortChange: (sortConfig: AtdbTableSortConfig) => void;
  onClearQuery: () => void;
  selection?: AtdbTableSelectionContext;
}

interface AtdbTableFrameProps {
  children: React.ReactNode;
}

interface SortableHeaderCellProps {
  columnKey: string;
  label: string;
  context: AtdbTableRenderContext;
  className?: string;
}

interface SelectionHeaderCellProps {
  context: AtdbTableRenderContext;
  entityType: AtdbWritableEntity;
}

interface SelectionCellProps extends SelectionHeaderCellProps {
  id: number;
}

interface EmptyTableStateProps {
  emptyLabel: string;
  context: AtdbTableRenderContext;
}

export function AtdbTableFrame({ children }: AtdbTableFrameProps) {
  return (
    <table className="min-w-full rounded-lg border border-gray-200 bg-white shadow-sm">
      {children}
    </table>
  );
}

export function SortableHeaderCell({
  columnKey,
  label,
  context,
  className = 'border-b px-4 py-2 text-left',
}: SortableHeaderCellProps) {
  const sortConfig = context.sortConfig;
  const direction =
    sortConfig?.key === columnKey && sortConfig.direction === 'ascending'
      ? 'descending'
      : 'ascending';
  const ariaSort = sortConfig?.key === columnKey ? sortConfig.direction : 'none';
  const indicator =
    sortConfig?.key === columnKey
      ? sortConfig.direction === 'ascending'
        ? ' ↑'
        : ' ↓'
      : '';

  return (
    <th className={className} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => context.onSortChange({ key: columnKey, direction })}
        className="flex w-full items-center gap-1 text-left font-semibold text-gray-800 transition hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
        aria-label={`${label}: сортировать ${direction === 'ascending' ? 'по возрастанию' : 'по убыванию'}`}
      >
        <span>{label}</span>
        <span aria-hidden="true">{indicator}</span>
      </button>
    </th>
  );
}

export function SelectionHeaderCell({ context, entityType }: SelectionHeaderCellProps) {
  const selection = getSelectionForEntity(context, entityType);
  if (!selection) return null;

  const selectedIdSet = new Set(selection.selectedIds);
  const rowIds = selection.visibleIds;
  const allSelected = rowIds.length > 0 && rowIds.every((id) => selectedIdSet.has(id));

  return (
    <th className="sticky left-0 z-40 w-12 min-w-12 border-b bg-gray-100 px-3 py-2 text-center">
      <input
        type="checkbox"
        aria-label="Выбрать все видимые строки"
        checked={allSelected}
        disabled={rowIds.length === 0}
        onChange={(event) => selection.onRenderedRowsSelectionChange(entityType, rowIds, event.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
    </th>
  );
}

export function SelectionCell({ context, entityType, id }: SelectionCellProps) {
  const selection = getSelectionForEntity(context, entityType);
  if (!selection) return null;

  const selectedIdSet = new Set(selection.selectedIds);
  return (
    <td className="sticky left-0 z-20 w-12 min-w-12 border-b bg-white px-3 py-2 text-center">
      <input
        type="checkbox"
        aria-label={`Выбрать строку ID ${id}`}
        checked={selectedIdSet.has(id)}
        onChange={(event) => selection.onRowSelectionChange(entityType, id, event.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
    </td>
  );
}

export function EmptyTableState({ emptyLabel, context }: EmptyTableStateProps) {
  if (context.totalCount === 0) {
    return <p className="m-4 text-gray-500">{emptyLabel}</p>;
  }

  return (
    <div className="m-4 flex flex-wrap items-center gap-3 text-gray-600">
      <p>Нет строк по текущему поиску или фильтру.</p>
      {context.isQueryActive && (
        <button
          type="button"
          onClick={context.onClearQuery}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100"
        >
          Очистить
        </button>
      )}
    </div>
  );
}

export function getColumnLabel(
  columns: readonly AtdbTableColumn[],
  key: string,
  fallback: string,
): string {
  return columns.find((column) => column.key === key)?.label ?? fallback;
}

export function hasSelectionColumn(context: AtdbTableRenderContext, entityType: AtdbWritableEntity): boolean {
  return context.selection?.entityType === entityType;
}

export function getStickyIdHeaderClassName(hasSelection: boolean): string {
  return `sticky ${hasSelection ? 'left-12' : 'left-0'} z-30 border-b bg-gray-100 px-4 py-2 text-left`;
}

export function getStickyIdCellClassName(hasSelection: boolean): string {
  return `sticky ${hasSelection ? 'left-12' : 'left-0'} z-10 border-b bg-white px-4 py-2`;
}

function getSelectionForEntity(
  context: AtdbTableRenderContext,
  entityType: AtdbWritableEntity,
): AtdbTableSelectionContext | null {
  return context.selection?.entityType === entityType ? context.selection : null;
}
