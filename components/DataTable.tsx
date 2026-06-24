import React from 'react';
import FamilyTable from './atdb-table/FamilyTable';
import EventTable from './atdb-table/EventTable';
import PersonTable from './atdb-table/PersonTable';
import PlaceTable from './atdb-table/PlaceTable';
import {
  useAtdbTableEditors,
} from './atdb-table/useAtdbTableEditors';
import type { Event, Family, ParsedAtdb, Person, Place } from '@/lib/types';
import type {
  AtdbDraftFieldKey,
  AtdbEditDraftState,
} from '@/lib/atdbEditDraft';
import {
  getWritableEntityForAtdbTableEntity,
  type AtdbTableEntity,
  type AtdbTableQueryResult,
  type AtdbTableRow,
  type AtdbTableSortConfig,
} from '@/lib/atdbTableView';
import type { AtdbWritableEntity } from '@/lib/sqlProcessor';
import type {
  AtdbTableRenderContext,
  AtdbTableSelectionContext,
} from './atdb-table/AtdbTablePrimitives';

interface DataTableProps {
  activeEntity: AtdbTableEntity;
  tableQueryResult: AtdbTableQueryResult;
  allPlaces: readonly Place[];
  draft?: AtdbEditDraftState;
  sourceData?: ParsedAtdb;
  selectedIds?: readonly number[];
  selectedIdSet?: ReadonlySet<number>;
  allVisibleSelected?: boolean;
  visibleSelectedCount?: number;
  isSelectionDisabled?: boolean;
  isQueryActive: boolean;
  sortConfig: AtdbTableSortConfig | null;
  onSortChange: (sortConfig: AtdbTableSortConfig) => void;
  onClearQuery: () => void;
  onRowSelectionChange?: (entityType: AtdbWritableEntity, id: number, selected: boolean) => void;
  onRenderedRowsSelectionChange?: (entityType: AtdbWritableEntity, ids: readonly number[], selected: boolean) => void;
  onDraftFieldChange?: (key: AtdbDraftFieldKey, value: unknown) => void;
  onDraftFieldReset?: (key: AtdbDraftFieldKey) => void;
}

const DataTable: React.FC<DataTableProps> = ({
  activeEntity,
  tableQueryResult,
  allPlaces,
  draft,
  sourceData,
  selectedIds = [],
  selectedIdSet,
  allVisibleSelected = false,
  visibleSelectedCount = 0,
  isSelectionDisabled = false,
  isQueryActive,
  sortConfig,
  onSortChange,
  onClearQuery,
  onRowSelectionChange,
  onRenderedRowsSelectionChange,
  onDraftFieldChange,
  onDraftFieldReset,
}) => {
  const selectableEntityType = getWritableEntityForAtdbTableEntity(activeEntity);
  const selection = createSelectionContext({
    selectableEntityType,
    selectedIds,
    selectedIdSet,
    visibleIds: tableQueryResult.visibleIds,
    allVisibleSelected,
    visibleSelectedCount,
    disabled: isSelectionDisabled,
    onRowSelectionChange,
    onRenderedRowsSelectionChange,
  });
  const context: AtdbTableRenderContext = {
    columns: tableQueryResult.columns,
    visibleIds: tableQueryResult.visibleIds,
    totalCount: tableQueryResult.totalCount,
    isQueryActive,
    sortConfig,
    onSortChange,
    onClearQuery,
    selection,
  };
  const editors = useAtdbTableEditors({
    allPlaces,
    draft,
    sourceData,
    onDraftFieldChange,
    onDraftFieldReset,
  });

  if (activeEntity === 'persons') {
    return <PersonTable rows={narrowRows<Person>(tableQueryResult.rows)} context={context} editors={editors} />;
  }

  if (activeEntity === 'families') {
    return <FamilyTable rows={narrowRows<Family>(tableQueryResult.rows)} context={context} editors={editors} />;
  }

  if (activeEntity === 'events') {
    return <EventTable rows={narrowRows<Event>(tableQueryResult.rows)} context={context} />;
  }

  if (activeEntity === 'places') {
    return <PlaceTable rows={narrowRows<Place>(tableQueryResult.rows)} context={context} editors={editors} />;
  }

  return (
    <div className="w-full">
      <p className="text-gray-500">Нет доступных данных</p>
    </div>
  );
};

function narrowRows<Row extends AtdbTableRow>(rows: AtdbTableRow[]): Row[] {
  return rows as Row[];
}

function createSelectionContext({
  selectableEntityType,
  selectedIds,
  selectedIdSet,
  visibleIds,
  allVisibleSelected,
  visibleSelectedCount,
  disabled,
  onRowSelectionChange,
  onRenderedRowsSelectionChange,
}: {
  selectableEntityType: AtdbWritableEntity | null;
  selectedIds: readonly number[];
  selectedIdSet?: ReadonlySet<number>;
  visibleIds: readonly number[];
  allVisibleSelected: boolean;
  visibleSelectedCount: number;
  disabled: boolean;
  onRowSelectionChange?: (entityType: AtdbWritableEntity, id: number, selected: boolean) => void;
  onRenderedRowsSelectionChange?: (
    entityType: AtdbWritableEntity,
    ids: readonly number[],
    selected: boolean,
  ) => void;
}): AtdbTableSelectionContext | undefined {
  if (!selectableEntityType || !onRowSelectionChange || !onRenderedRowsSelectionChange) {
    return undefined;
  }

  return {
    entityType: selectableEntityType,
    selectedIds,
    selectedIdSet: selectedIdSet ?? new Set(selectedIds),
    visibleIds,
    allVisibleSelected,
    visibleSelectedCount,
    disabled,
    onRowSelectionChange,
    onRenderedRowsSelectionChange,
  };
}

export default DataTable;
