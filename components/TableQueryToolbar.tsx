'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import {
  getAtdbTableFilterableColumns,
  type AtdbTableEntity,
  type AtdbTableFilterOperator,
  type AtdbTableQueryState,
} from '@/lib/atdbTableView';

interface TableQueryToolbarProps {
  activeEntity: AtdbTableEntity;
  query: AtdbTableQueryState;
  visibleCount: number;
  totalCount: number;
  activeFilterCount: number;
  onQueryChange: (query: AtdbTableQueryState) => void;
}

const OPERATOR_LABELS: Record<AtdbTableFilterOperator, string> = {
  contains: 'содержит',
  equals: 'равно',
  empty: 'пусто',
  'not-empty': 'не пусто',
};

export default function TableQueryToolbar({
  activeEntity,
  query,
  visibleCount,
  totalCount,
  activeFilterCount,
  onQueryChange,
}: TableQueryToolbarProps) {
  const filterableColumns = React.useMemo(() => getAtdbTableFilterableColumns(activeEntity), [activeEntity]);
  const filterField = query.filter?.field ?? '';
  const filterOperator = query.filter?.operator ?? 'contains';
  const filterValue = query.filter?.value ?? '';
  const operatorNeedsValue = filterOperator === 'contains' || filterOperator === 'equals';

  const updateQuickSearch = (quickSearch: string) => {
    onQueryChange({ ...query, quickSearch });
  };

  const updateFilter = (next: { field?: string; operator?: AtdbTableFilterOperator; value?: string }) => {
    const field = next.field ?? filterField;
    const operator = next.operator ?? filterOperator;
    const value = next.value ?? filterValue;

    onQueryChange({
      ...query,
      filter: field
        ? {
            field,
            operator,
            value,
          }
        : null,
    });
  };

  return (
    <div className="border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1 text-sm font-medium text-gray-700">
          <span className="sr-only">Быстрый поиск</span>
          <div className="mt-1 flex h-10 items-center rounded border border-gray-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
            <Search className="mr-2 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
            <input
              type="search"
              value={query.quickSearch}
              onChange={(event) => updateQuickSearch(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-gray-950 outline-none"
              aria-label="Быстрый поиск"
              placeholder="Поиск"
            />
            {query.quickSearch.length > 0 && (
              <button
                type="button"
                onClick={() => updateQuickSearch('')}
                className="ml-2 flex h-7 w-7 items-center justify-center rounded text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
                aria-label="Очистить поиск"
                title="Очистить поиск"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </label>

        <div className="text-sm text-gray-700">
          <span className="inline-flex h-10 items-center rounded border border-gray-200 bg-gray-50 px-3">
            Показано {visibleCount} из {totalCount}
          </span>
        </div>

        <label className="flex min-w-44 flex-col gap-1 text-sm font-medium text-gray-700">
          Поле
          <select
            value={filterField}
            onChange={(event) => updateFilter({ field: event.target.value })}
            className="h-10 rounded border border-gray-300 bg-white px-3 text-sm text-gray-950 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Без фильтра</option>
            {filterableColumns.map((column) => (
              <option key={column.key} value={column.key}>
                {column.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-36 flex-col gap-1 text-sm font-medium text-gray-700">
          Условие
          <select
            value={filterOperator}
            disabled={!filterField}
            onChange={(event) => updateFilter({ operator: event.target.value as AtdbTableFilterOperator })}
            className="h-10 rounded border border-gray-300 bg-white px-3 text-sm text-gray-950 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
          >
            {Object.entries(OPERATOR_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {operatorNeedsValue && (
          <label className="min-w-48 flex-1 text-sm font-medium text-gray-700">
            Значение
            <input
              type="text"
              value={filterValue}
              disabled={!filterField}
              onChange={(event) => updateFilter({ value: event.target.value })}
              className="mt-1 h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-950 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
              aria-label="Значение фильтра"
            />
          </label>
        )}

        <button
          type="button"
          onClick={() => onQueryChange({ ...query, filter: null })}
          disabled={!query.filter && activeFilterCount === 0}
          className="flex h-10 items-center gap-2 rounded border border-gray-300 bg-white px-3 text-sm text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Фильтр
        </button>
      </div>
    </div>
  );
}
