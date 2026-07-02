import React from 'react';
import type { Person } from '@/lib/types';
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

interface PersonTableProps {
  rows: readonly Person[];
  context: AtdbTableRenderContext;
  editors: AtdbTableEditors;
}

export default function PersonTable({ rows, context, editors }: PersonTableProps) {
  if (rows.length === 0) {
    return <EmptyTableState emptyLabel="Нет доступных данных о персонах" context={context} />;
  }

  const hasSelection = hasSelectionColumn(context, 'person');
  const label = (key: string, fallback: string) => getColumnLabel(context.columns, key, fallback);

  return (
    <AtdbTableFrame>
      <thead className="sticky top-0 z-20 bg-gray-100">
        <tr className="bg-gray-100">
          <SelectionHeaderCell context={context} entityType="person" />
          <SortableHeaderCell columnKey="id" label={label('id', 'ID')} context={context} className={getStickyIdHeaderClassName(hasSelection)} />
          <SortableHeaderCell columnKey="lastName" label={label('lastName', 'Фамилия')} context={context} />
          <SortableHeaderCell columnKey="birthLastName" label={label('birthLastName', 'Фамилия при рождении')} context={context} />
          <SortableHeaderCell columnKey="firstName" label={label('firstName', 'Имя')} context={context} />
          <SortableHeaderCell columnKey="patronymic" label={label('patronymic', 'Отчество')} context={context} />
          <SortableHeaderCell columnKey="gender" label={label('gender', 'Пол')} context={context} />
          <SortableHeaderCell columnKey="birthDate" label={label('birthDate', 'Дата рождения')} context={context} />
          <SortableHeaderCell columnKey="deathDate" label={label('deathDate', 'Дата смерти')} context={context} />
          <SortableHeaderCell columnKey="birthPlace" label={label('birthPlace', 'Место рождения')} context={context} />
          <SortableHeaderCell columnKey="deathPlace" label={label('deathPlace', 'Место смерти')} context={context} />
          <SortableHeaderCell columnKey="fatherId" label={label('fatherId', 'ID отца')} context={context} />
          <SortableHeaderCell columnKey="motherId" label={label('motherId', 'ID матери')} context={context} />
          <SortableHeaderCell columnKey="notes" label={label('notes', 'Примечания')} context={context} />
          <SortableHeaderCell columnKey="occupation" label={label('occupation', 'Основное занятие')} context={context} />
        </tr>
      </thead>
      <tbody>
        {rows.map((person) => (
          <tr key={person.id} className={ATDB_TABLE_ROW_CLASS_NAME}>
            <SelectionCell context={context} entityType="person" id={person.id} />
            <td className={getStickyIdCellClassName(hasSelection)}>{person.id}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{editors.renderTextEditor('person', person.id, 'lastName', label('lastName', 'Фамилия'), person.lastName)}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{editors.renderTextEditor('person', person.id, 'birthLastName', label('birthLastName', 'Фамилия при рождении'), person.birthLastName)}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{editors.renderTextEditor('person', person.id, 'firstName', label('firstName', 'Имя'), person.firstName)}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{editors.renderTextEditor('person', person.id, 'patronymic', label('patronymic', 'Отчество'), person.patronymic)}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{editors.renderGenderEditor(person)}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>
              {editors.renderDateEditor(
                'person',
                person.id,
                'birthDate',
                label('birthDate', 'Дата рождения'),
                person.birthDateInfo?.display || person.birthDate,
                Boolean(person.birthEventId) && (person.birthDateInfo?.isSimple ?? true),
              )}
            </td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>
              {editors.renderDateEditor(
                'person',
                person.id,
                'deathDate',
                label('deathDate', 'Дата смерти'),
                person.deathDateInfo?.display || person.deathDate,
                Boolean(person.deathEventId) && (person.deathDateInfo?.isSimple ?? true),
              )}
            </td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>
              {editors.renderPlaceLinkEditor(
                'person',
                person.id,
                'birthPlaceId',
                label('birthPlace', 'Место рождения'),
                person.birthPlaceId,
                person.birthPlace,
                { editable: Boolean(person.birthEventId) },
              )}
            </td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>
              {editors.renderPlaceLinkEditor(
                'person',
                person.id,
                'deathPlaceId',
                label('deathPlace', 'Место смерти'),
                person.deathPlaceId,
                person.deathPlace,
                { editable: Boolean(person.deathEventId) },
              )}
            </td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{person.fatherId || '-'}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{person.motherId || '-'}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{person.notes || '-'}</td>
            <td className={ATDB_TABLE_CELL_CLASS_NAME}>{person.occupation || '-'}</td>
          </tr>
        ))}
      </tbody>
    </AtdbTableFrame>
  );
}
