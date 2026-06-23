import React from 'react';
import type { Place } from '@/lib/types';
import type { AtdbTableEditors } from './useAtdbTableEditors';
import {
  ATDB_TABLE_CELL_CLASS_NAME,
  ATDB_TABLE_ROW_CLASS_NAME,
  AtdbTableFrame,
  EmptyTableState,
  SelectionCell,
  SelectionHeaderCell,
  SortableHeaderCell,
  getColumnLabel,
  getStickyIdCellClassName,
  getStickyIdHeaderClassName,
  hasSelectionColumn,
  type AtdbTableRenderContext,
} from './AtdbTablePrimitives';

interface PlaceTableProps {
  rows: readonly Place[];
  context: AtdbTableRenderContext;
  editors: AtdbTableEditors;
}

export default function PlaceTable({ rows, context, editors }: PlaceTableProps) {
  if (rows.length === 0) {
    return <EmptyTableState emptyLabel="Нет доступных данных о местах" context={context} />;
  }

  const hasSelection = hasSelectionColumn(context, 'place');
  const label = (key: string, fallback: string) => getColumnLabel(context.columns, key, fallback);

  return (
    <AtdbTableFrame>
      <thead className="sticky top-0 z-20 bg-gray-100">
        <tr className="bg-gray-100">
          <SelectionHeaderCell context={context} entityType="place" />
          <SortableHeaderCell columnKey="id" label={label('id', 'ID')} context={context} className={getStickyIdHeaderClassName(hasSelection)} />
          <SortableHeaderCell columnKey="name" label={label('name', 'Название')} context={context} />
          <SortableHeaderCell columnKey="shortName" label={label('shortName', 'Краткое название')} context={context} />
          <SortableHeaderCell columnKey="comment" label={label('comment', 'Комментарий')} context={context} />
        </tr>
      </thead>
      <tbody>
        {rows.map((place) => (
          <tr key={place.id} className={ATDB_TABLE_ROW_CLASS_NAME}>
            <SelectionCell context={context} entityType="place" id={place.id} />
            <td className={getStickyIdCellClassName(hasSelection)}>{place.id}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{editors.renderTextEditor('place', place.id, 'name', 'Название места', place.name)}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{editors.renderTextEditor('place', place.id, 'shortName', 'Краткое название места', place.shortName)}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{editors.renderTextEditor('place', place.id, 'comment', 'Комментарий места', place.comment)}</td>
          </tr>
        ))}
      </tbody>
    </AtdbTableFrame>
  );
}
