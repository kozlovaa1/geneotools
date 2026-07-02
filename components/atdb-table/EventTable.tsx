import React from 'react';
import { getEventTypeName } from '@/lib/utils';
import type { Event } from '@/lib/types';
import type { AtdbTableEditors } from './useAtdbTableEditors';
import {
  ATDB_TABLE_CELL_CLASS_NAME,
  ATDB_TABLE_ROW_CLASS_NAME,
  AtdbTableFrame,
  EmptyTableState,
  SortableHeaderCell,
  getColumnLabel,
  type AtdbTableRenderContext,
} from './AtdbTablePrimitives';

interface EventTableProps {
  rows: readonly Event[];
  context: AtdbTableRenderContext;
  editors: AtdbTableEditors;
}

export default function EventTable({ rows, context, editors }: EventTableProps) {
  if (rows.length === 0) {
    return <EmptyTableState emptyLabel="Нет доступных данных о событиях" context={context} />;
  }

  const label = (key: string, fallback: string) => getColumnLabel(context.columns, key, fallback);

  return (
    <AtdbTableFrame>
      <thead className="sticky top-0 z-20 bg-gray-100">
        <tr className="bg-gray-100">
          <SortableHeaderCell columnKey="id" label={label('id', 'ID')} context={context} className="sticky left-0 z-30 border-b bg-gray-100 px-4 py-2 text-left" />
          <SortableHeaderCell columnKey="personId" label={label('personId', 'ID персоны')} context={context} />
          <SortableHeaderCell columnKey="eventType" label={label('eventType', 'Тип события')} context={context} />
          <SortableHeaderCell columnKey="date" label={label('date', 'Дата')} context={context} />
          <SortableHeaderCell columnKey="place" label={label('place', 'Место')} context={context} />
          <SortableHeaderCell columnKey="description" label={label('description', 'Описание')} context={context} />
        </tr>
      </thead>
      <tbody>
        {rows.map((event) => (
          <tr key={event.id} className={ATDB_TABLE_ROW_CLASS_NAME}>
            <td className="sticky left-0 z-10 border-b bg-white px-4 py-2">{event.id}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{event.personIds ? event.personIds.join(', ') : '-'}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{getEventTypeName(event.eventType)}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{event.dateInfo?.display || event.date || '-'}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>
              {editors.renderPlaceLinkEditor(
                'event',
                event.id,
                'placeId',
                label('place', 'Место'),
                event.placeId,
                event.place,
              )}
            </td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{event.description || '-'}</td>
          </tr>
        ))}
      </tbody>
    </AtdbTableFrame>
  );
}
