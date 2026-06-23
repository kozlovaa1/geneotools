import React from 'react';
import type { Family } from '@/lib/types';
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

interface FamilyTableProps {
  rows: readonly Family[];
  context: AtdbTableRenderContext;
  editors: AtdbTableEditors;
}

export default function FamilyTable({ rows, context, editors }: FamilyTableProps) {
  if (rows.length === 0) {
    return <EmptyTableState emptyLabel="Нет доступных данных о родах" context={context} />;
  }

  const hasSelection = hasSelectionColumn(context, 'family');
  const label = (key: string, fallback: string) => getColumnLabel(context.columns, key, fallback);

  return (
    <AtdbTableFrame>
      <thead className="sticky top-0 z-20 bg-gray-100">
        <tr className="bg-gray-100">
          <SelectionHeaderCell context={context} entityType="family" />
          <SortableHeaderCell columnKey="id" label={label('id', 'ID')} context={context} className={getStickyIdHeaderClassName(hasSelection)} />
          <SortableHeaderCell columnKey="familyName" label={label('familyName', 'Название рода')} context={context} />
          <SortableHeaderCell columnKey="husbandLastName" label={label('husbandLastName', 'Мужская фамилия')} context={context} />
          <SortableHeaderCell columnKey="wifeLastName" label={label('wifeLastName', 'Женская фамилия')} context={context} />
          <SortableHeaderCell columnKey="comment" label={label('comment', 'Комментарий')} context={context} />
          <SortableHeaderCell columnKey="color" label={label('color', 'Цвет')} context={context} />
        </tr>
      </thead>
      <tbody>
        {rows.map((family) => (
          <tr key={family.id} className={ATDB_TABLE_ROW_CLASS_NAME}>
            <SelectionCell context={context} entityType="family" id={family.id} />
            <td className={getStickyIdCellClassName(hasSelection)}>{family.id}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{editors.renderTextEditor('family', family.id, 'familyName', label('familyName', 'Название рода'), family.familyName)}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{editors.renderTextEditor('family', family.id, 'husbandLastName', label('husbandLastName', 'Мужская фамилия'), family.husbandLastName)}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{editors.renderTextEditor('family', family.id, 'wifeLastName', label('wifeLastName', 'Женская фамилия'), family.wifeLastName)}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{editors.renderTextEditor('family', family.id, 'comment', 'Комментарий рода', family.comment)}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{editors.renderNumberEditor('family', family.id, 'color', 'Цвет рода', family.color)}</td>
          </tr>
        ))}
      </tbody>
    </AtdbTableFrame>
  );
}
