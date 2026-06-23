import React from 'react';
import { getEventTypeName } from '../lib/utils';
import {
  EditableNumberCell,
  EditableSelectCell,
  EditableTextCell,
  type EditableSelectOption,
} from './EditableCell';
import type { Event, Family, ParsedAtdb, Person, Place } from '@/lib/types';
import {
  getDraftValue,
  isFieldDirty,
  type AtdbDraftFieldKey,
  type AtdbEditDraftState,
} from '@/lib/atdbEditDraft';
import {
  getWritableEntityForAtdbTableEntity,
  type AtdbTableEntity,
  type AtdbTableSortConfig,
} from '@/lib/atdbTableView';
import type { AtdbFieldName, AtdbWritableEntity } from '@/lib/sqlProcessor';

interface DataTableProps {
  activeEntity: AtdbTableEntity;
  persons: Person[];
  families: Family[];
  events: Event[];
  places: Place[];
  allPlaces?: Place[];
  draft?: AtdbEditDraftState;
  sourceData?: ParsedAtdb;
  selectedIds?: readonly number[];
  visibleIds: readonly number[];
  totalCount: number;
  isQueryActive: boolean;
  sortConfig: AtdbTableSortConfig | null;
  onSortChange: (sortConfig: AtdbTableSortConfig) => void;
  onClearQuery: () => void;
  onRowSelectionChange?: (entityType: AtdbWritableEntity, id: number, selected: boolean) => void;
  onRenderedRowsSelectionChange?: (entityType: AtdbWritableEntity, ids: readonly number[], selected: boolean) => void;
  onDraftFieldChange?: (key: AtdbDraftFieldKey, value: unknown) => void;
  onDraftFieldReset?: (key: AtdbDraftFieldKey) => void;
  onDraftEntityReset?: (entityType: AtdbDraftFieldKey['entityType'], id: number) => void;
}

function createDraftKey(entityType: AtdbWritableEntity, id: number, field: AtdbFieldName): AtdbDraftFieldKey {
  return {
    entityType,
    id,
    field,
  };
}

function formatPlaceLabel(place: Place, draft?: AtdbEditDraftState, sourceData?: ParsedAtdb): string {
  if (!draft || !sourceData) {
    return place.name || place.shortName || `ID ${place.id}`;
  }

  const name = getDraftValue(draft, sourceData, createDraftKey('place', place.id, 'name'));
  const shortName = getDraftValue(draft, sourceData, createDraftKey('place', place.id, 'shortName'));
  return formatOptionText(name) || formatOptionText(shortName) || `ID ${place.id}`;
}

function formatOptionText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

const DataTable: React.FC<DataTableProps> = ({
  activeEntity,
  persons,
  families,
  events,
  places,
  allPlaces = places,
  draft,
  sourceData,
  selectedIds = [],
  visibleIds,
  totalCount,
  isQueryActive,
  sortConfig,
  onSortChange,
  onClearQuery,
  onRowSelectionChange,
  onRenderedRowsSelectionChange,
  onDraftFieldChange,
  onDraftFieldReset,
}) => {
  const canEdit = Boolean(draft && sourceData && onDraftFieldChange && onDraftFieldReset);
  const selectableEntityType = getWritableEntityForAtdbTableEntity(activeEntity);
  const canSelectRows = Boolean(selectableEntityType && onRowSelectionChange && onRenderedRowsSelectionChange);
  const selectedIdSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const placeOptions = React.useMemo<EditableSelectOption[]>(
    () => [
      { value: '', label: 'Очистить' },
      ...allPlaces.map((place) => ({
        value: String(place.id),
        label: formatPlaceLabel(place, draft, sourceData),
      })),
    ],
    [allPlaces, draft, sourceData],
  );

  const getDraftAwareValue = React.useCallback((key: AtdbDraftFieldKey): unknown => {
    if (!draft || !sourceData) return undefined;
    return getDraftValue(draft, sourceData, key);
  }, [draft, sourceData]);

  const dirty = (key: AtdbDraftFieldKey): boolean => {
    return Boolean(draft && sourceData && isFieldDirty(draft, sourceData, key));
  };

  const resetField = (key: AtdbDraftFieldKey) => {
    onDraftFieldReset?.(key);
  };

  const updateField = (key: AtdbDraftFieldKey, value: unknown) => {
    onDraftFieldChange?.(key, value);
  };

  const formatDraftCellValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '-';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  };

  const renderTextEditor = (
    entityType: AtdbWritableEntity,
    id: number,
    field: AtdbFieldName,
    ariaLabel: string,
    fallback: unknown,
  ) => {
    const key = createDraftKey(entityType, id, field);
    if (!canEdit) {
      return formatDraftCellValue(fallback);
    }

    const value = getDraftAwareValue(key);
    return (
      <EditableTextCell
        value={typeof value === 'string' ? value : ''}
        dirty={dirty(key)}
        ariaLabel={ariaLabel}
        onChange={(nextValue) => updateField(key, nextValue)}
        onReset={() => resetField(key)}
      />
    );
  };

  const renderNumberEditor = (
    entityType: AtdbWritableEntity,
    id: number,
    field: AtdbFieldName,
    ariaLabel: string,
  ) => {
    const key = createDraftKey(entityType, id, field);
    const value = getDraftAwareValue(key);
    return (
      <EditableNumberCell
        value={typeof value === 'number' ? value : null}
        dirty={dirty(key)}
        ariaLabel={ariaLabel}
        onChange={(nextValue) => updateField(key, nextValue)}
        onReset={() => resetField(key)}
      />
    );
  };

  const renderGenderEditor = (person: Person) => {
    const key = createDraftKey('person', person.id, 'gender');
    const value = getDraftAwareValue(key);
    return (
      <EditableSelectCell
        value={value === null ? '' : String(value ?? person.gender)}
        options={[
          { value: '', label: 'Очистить' },
          { value: 'M', label: 'M' },
          { value: 'F', label: 'F' },
          { value: 'Unknown', label: 'Unknown' },
        ]}
        dirty={dirty(key)}
        ariaLabel="Пол"
        onChange={(nextValue) => updateField(key, nextValue === '' ? null : nextValue)}
        onReset={() => resetField(key)}
      />
    );
  };

  const renderPlaceLinkEditor = (person: Person, field: 'birthPlaceId' | 'deathPlaceId', label: string) => {
    const originalPlaceId = person[field];
    if (typeof originalPlaceId !== 'number') {
      return formatDraftCellValue(field === 'birthPlaceId' ? person.birthPlace : person.deathPlace);
    }

    if (allPlaces.length === 0) {
      return <span className="text-amber-700">Список мест недоступен</span>;
    }

    const key = createDraftKey('person', person.id, field);
    const value = getDraftAwareValue(key);
    return (
      <EditableSelectCell
        value={value === null ? '' : String(value ?? originalPlaceId)}
        options={placeOptions}
        dirty={dirty(key)}
        ariaLabel={label}
        onChange={(nextValue) => updateField(key, nextValue === '' ? null : Number.parseInt(nextValue, 10))}
        onReset={() => resetField(key)}
      />
    );
  };

  const handleSort = (key: string) => {
    const direction =
      sortConfig?.key === key && sortConfig.direction === 'ascending'
        ? 'descending'
        : 'ascending';

    onSortChange({ key, direction });
  };

  const getSortIndicator = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return '';
    return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
  };

  const getAriaSort = (key: string): React.AriaAttributes['aria-sort'] => {
    if (!sortConfig || sortConfig.key !== key) return 'none';
    return sortConfig.direction;
  };

  const nextSortDirectionLabel = (key: string): string => {
    if (sortConfig?.key === key && sortConfig.direction === 'ascending') {
      return 'по убыванию';
    }

    return 'по возрастанию';
  };

  const renderSortHeader = (key: string, label: string, className = 'py-2 px-4 border-b text-left') => (
    <th className={className} aria-sort={getAriaSort(key)}>
      <button
        type="button"
        onClick={() => handleSort(key)}
        className="flex w-full items-center gap-1 text-left font-semibold text-gray-800 transition hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
        aria-label={`${label}: сортировать ${nextSortDirectionLabel(key)}`}
      >
        <span>{label}</span>
        <span aria-hidden="true">{getSortIndicator(key)}</span>
      </button>
    </th>
  );

  const getStickyIdHeaderClassName = () =>
    `sticky ${canSelectRows ? 'left-12' : 'left-0'} z-30 border-b bg-gray-100 px-4 py-2 text-left`;

  const getStickyIdCellClassName = () =>
    `sticky ${canSelectRows ? 'left-12' : 'left-0'} z-10 border-b bg-white px-4 py-2`;

  const renderSelectionHeader = (entityType: AtdbWritableEntity, rowIds: readonly number[]) => {
    if (!canSelectRows || selectableEntityType !== entityType) {
      return null;
    }

    const allSelected = rowIds.length > 0 && rowIds.every((id) => selectedIdSet.has(id));
    return (
      <th className="sticky left-0 z-40 w-12 min-w-12 border-b bg-gray-100 px-3 py-2 text-center">
        <input
          type="checkbox"
          aria-label="Выбрать все видимые строки"
          checked={allSelected}
          disabled={rowIds.length === 0}
          onChange={(event) => onRenderedRowsSelectionChange?.(entityType, rowIds, event.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      </th>
    );
  };

  const renderSelectionCell = (entityType: AtdbWritableEntity, id: number) => {
    if (!canSelectRows || selectableEntityType !== entityType) {
      return null;
    }

    return (
      <td className="sticky left-0 z-20 w-12 min-w-12 border-b bg-white px-3 py-2 text-center">
        <input
          type="checkbox"
          aria-label={`Выбрать строку ID ${id}`}
          checked={selectedIdSet.has(id)}
          onChange={(event) => onRowSelectionChange?.(entityType, id, event.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      </td>
    );
  };

  const renderEmptyState = (emptyLabel: string) => {
    if (totalCount === 0) {
      return <p className="m-4 text-gray-500">{emptyLabel}</p>;
    }

    return (
      <div className="m-4 flex flex-wrap items-center gap-3 text-gray-600">
        <p>Нет строк по текущему поиску или фильтру.</p>
        {isQueryActive && (
          <button
            type="button"
            onClick={onClearQuery}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100"
          >
            Очистить
          </button>
        )}
      </div>
    );
  };

  const renderPersonsTable = () => {
    if (persons.length === 0) {
      return renderEmptyState('Нет доступных данных о персонах');
    }

    return (
      <table className="min-w-full rounded-lg border border-gray-200 bg-white shadow-sm">
        <thead className="sticky top-0 z-20 bg-gray-100">
          <tr className="bg-gray-100">
            {renderSelectionHeader('person', visibleIds)}
            {renderSortHeader('id', 'ID', getStickyIdHeaderClassName())}
            {renderSortHeader('lastName', 'Фамилия')}
            {renderSortHeader('firstName', 'Имя')}
            {renderSortHeader('patronymic', 'Отчество')}
            {renderSortHeader('gender', 'Пол')}
            {renderSortHeader('birthDate', 'Дата рождения')}
            {renderSortHeader('deathDate', 'Дата смерти')}
            {renderSortHeader('birthPlace', 'Место рождения')}
            {renderSortHeader('deathPlace', 'Место смерти')}
            {renderSortHeader('fatherId', 'ID отца')}
            {renderSortHeader('motherId', 'ID матери')}
            {renderSortHeader('notes', 'Примечания')}
            {renderSortHeader('occupation', 'Основное занятие')}
          </tr>
        </thead>
        <tbody>
          {persons.map((person) => (
            <tr key={person.id} className="hover:bg-gray-50">
              {renderSelectionCell('person', person.id)}
              <td className={getStickyIdCellClassName()}>{person.id}</td>
              <td className="border-b px-4 py-2">{renderTextEditor('person', person.id, 'lastName', 'Фамилия', person.lastName)}</td>
              <td className="border-b px-4 py-2">{renderTextEditor('person', person.id, 'firstName', 'Имя', person.firstName)}</td>
              <td className="border-b px-4 py-2">{renderTextEditor('person', person.id, 'patronymic', 'Отчество', person.patronymic)}</td>
              <td className="border-b px-4 py-2">{renderGenderEditor(person)}</td>
              <td className="border-b px-4 py-2">{person.birthDate || '-'}</td>
              <td className="border-b px-4 py-2">{person.deathDate || '-'}</td>
              <td className="border-b px-4 py-2">{renderPlaceLinkEditor(person, 'birthPlaceId', 'Место рождения')}</td>
              <td className="border-b px-4 py-2">{renderPlaceLinkEditor(person, 'deathPlaceId', 'Место смерти')}</td>
              <td className="border-b px-4 py-2">{person.fatherId || '-'}</td>
              <td className="border-b px-4 py-2">{person.motherId || '-'}</td>
              <td className="border-b px-4 py-2">{person.notes || '-'}</td>
              <td className="border-b px-4 py-2">{person.occupation || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderFamiliesTable = () => {
    if (families.length === 0) {
      return renderEmptyState('Нет доступных данных о родах');
    }

    return (
      <table className="min-w-full rounded-lg border border-gray-200 bg-white shadow-sm">
        <thead className="sticky top-0 z-20 bg-gray-100">
          <tr className="bg-gray-100">
            {renderSelectionHeader('family', visibleIds)}
            {renderSortHeader('id', 'ID', getStickyIdHeaderClassName())}
            {renderSortHeader('familyName', 'Название рода')}
            {renderSortHeader('husbandLastName', 'Мужская фамилия')}
            {renderSortHeader('wifeLastName', 'Женская фамилия')}
            {renderSortHeader('comment', 'Комментарий')}
            {renderSortHeader('color', 'Цвет')}
          </tr>
        </thead>
        <tbody>
          {families.map((family) => (
            <tr key={family.id} className="hover:bg-gray-50">
              {renderSelectionCell('family', family.id)}
              <td className={getStickyIdCellClassName()}>{family.id}</td>
              <td className="border-b px-4 py-2">{renderTextEditor('family', family.id, 'familyName', 'Название рода', family.familyName)}</td>
              <td className="border-b px-4 py-2">{renderTextEditor('family', family.id, 'husbandLastName', 'Мужская фамилия', family.husbandLastName)}</td>
              <td className="border-b px-4 py-2">{renderTextEditor('family', family.id, 'wifeLastName', 'Женская фамилия', family.wifeLastName)}</td>
              <td className="border-b px-4 py-2">{renderTextEditor('family', family.id, 'comment', 'Комментарий рода', family.comment)}</td>
              <td className="border-b px-4 py-2">{renderNumberEditor('family', family.id, 'color', 'Цвет рода')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderEventsTable = () => {
    if (events.length === 0) {
      return renderEmptyState('Нет доступных данных о событиях');
    }

    return (
      <table className="min-w-full rounded-lg border border-gray-200 bg-white shadow-sm">
        <thead className="sticky top-0 z-20 bg-gray-100">
          <tr className="bg-gray-100">
            {renderSortHeader('id', 'ID', 'sticky left-0 z-30 border-b bg-gray-100 px-4 py-2 text-left')}
            {renderSortHeader('personId', 'ID персоны')}
            {renderSortHeader('eventType', 'Тип события')}
            {renderSortHeader('date', 'Дата')}
            {renderSortHeader('place', 'Место')}
            {renderSortHeader('description', 'Описание')}
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="hover:bg-gray-50">
              <td className="sticky left-0 z-10 border-b bg-white px-4 py-2">{event.id}</td>
              <td className="border-b px-4 py-2">{event.personIds ? event.personIds.join(', ') : '-'}</td>
              <td className="border-b px-4 py-2">{getEventTypeName(event.eventType)}</td>
              <td className="border-b px-4 py-2">{event.date || '-'}</td>
              <td className="border-b px-4 py-2">{event.place || '-'}</td>
              <td className="border-b px-4 py-2">{event.description || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderPlacesTable = () => {
    if (places.length === 0) {
      return renderEmptyState('Нет доступных данных о местах');
    }

    return (
      <table className="min-w-full rounded-lg border border-gray-200 bg-white shadow-sm">
        <thead className="sticky top-0 z-20 bg-gray-100">
          <tr className="bg-gray-100">
            {renderSelectionHeader('place', visibleIds)}
            {renderSortHeader('id', 'ID', getStickyIdHeaderClassName())}
            {renderSortHeader('name', 'Название')}
            {renderSortHeader('shortName', 'Краткое название')}
            {renderSortHeader('comment', 'Комментарий')}
          </tr>
        </thead>
        <tbody>
          {places.map((place) => (
            <tr key={place.id} className="hover:bg-gray-50">
              {renderSelectionCell('place', place.id)}
              <td className={getStickyIdCellClassName()}>{place.id}</td>
              <td className="border-b px-4 py-2">{renderTextEditor('place', place.id, 'name', 'Название места', place.name)}</td>
              <td className="border-b px-4 py-2">{renderTextEditor('place', place.id, 'shortName', 'Краткое название места', place.shortName)}</td>
              <td className="border-b px-4 py-2">{renderTextEditor('place', place.id, 'comment', 'Комментарий места', place.comment)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  if (activeEntity === 'persons') return renderPersonsTable();
  if (activeEntity === 'families') return renderFamiliesTable();
  if (activeEntity === 'events') return renderEventsTable();
  if (activeEntity === 'places') return renderPlacesTable();

  return (
    <div className="w-full">
      <p className="text-gray-500">Нет доступных данных</p>
    </div>
  );
};

export default DataTable;
