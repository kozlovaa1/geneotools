import React, { useState } from 'react';
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
import type { AtdbFieldName, AtdbWritableEntity } from '@/lib/sqlProcessor';

type ActiveEntity = 'persons' | 'families' | 'events' | 'places';

function formatPlaceLabel(place: Place): string {
  return place.name || place.shortName || `ID ${place.id}`;
}

function createDraftKey(entityType: AtdbWritableEntity, id: number, field: AtdbFieldName): AtdbDraftFieldKey {
  return {
    entityType,
    id,
    field,
  };
}

interface SortConfig {
  key: string;
  direction: 'ascending' | 'descending';
}

interface DataTableProps {
  activeEntity: ActiveEntity;
  persons: Person[];
  families: Family[];
  events: Event[];
  places: Place[];
  allPlaces?: Place[];
  draft?: AtdbEditDraftState;
  sourceData?: ParsedAtdb;
  selectedIds?: readonly number[];
  onRowSelectionChange?: (entityType: AtdbWritableEntity, id: number, selected: boolean) => void;
  onRenderedRowsSelectionChange?: (entityType: AtdbWritableEntity, ids: readonly number[], selected: boolean) => void;
  onDraftFieldChange?: (key: AtdbDraftFieldKey, value: unknown) => void;
  onDraftFieldReset?: (key: AtdbDraftFieldKey) => void;
  onDraftEntityReset?: (entityType: AtdbDraftFieldKey['entityType'], id: number) => void;
  renderOnlyHeader?: boolean;
  renderOnlyContent?: boolean;
}

function writableEntityFromActive(activeEntity: ActiveEntity): AtdbWritableEntity | null {
  if (activeEntity === 'persons') return 'person';
  if (activeEntity === 'families') return 'family';
  if (activeEntity === 'places') return 'place';
  return null;
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
  onRowSelectionChange,
  onRenderedRowsSelectionChange,
  onDraftFieldChange,
  onDraftFieldReset,
  renderOnlyHeader = false,
  renderOnlyContent = false,
}) => {
  const [personSortConfig, setPersonSortConfig] = useState<SortConfig | null>(null);
  const [familySortConfig, setFamilySortConfig] = useState<SortConfig | null>(null);
  const [eventSortConfig, setEventSortConfig] = useState<SortConfig | null>(null);
  const [placeSortConfig, setPlaceSortConfig] = useState<SortConfig | null>(null);

  const canEdit = Boolean(draft && sourceData && onDraftFieldChange && onDraftFieldReset);
  const selectableEntityType = writableEntityFromActive(activeEntity);
  const canSelectRows = Boolean(selectableEntityType && onRowSelectionChange && onRenderedRowsSelectionChange);
  const selectedIdSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const placeLabelById = React.useMemo(
    () => new Map(allPlaces.map((place) => [place.id, formatPlaceLabel(place)])),
    [allPlaces],
  );
  const placeOptions = React.useMemo<EditableSelectOption[]>(
    () => [
      { value: '', label: 'Очистить' },
      ...allPlaces.map((place) => ({
        value: String(place.id),
        label: formatPlaceLabel(place),
      })),
    ],
    [allPlaces],
  );

  const getValue = React.useCallback(
    (record: object, key: string): unknown => (record as Record<string, unknown>)[key],
    [],
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

  const formatPlaceValue = React.useCallback((value: unknown, fallback: string | undefined): string => {
    if (typeof value === 'number') return placeLabelById.get(value) ?? `ID ${value}`;
    if (value === null) return '-';
    return fallback || '-';
  }, [placeLabelById]);

  const renderTextEditor = (
    entityType: AtdbWritableEntity,
    id: number,
    field: AtdbFieldName,
    ariaLabel: string,
  ) => {
    const key = createDraftKey(entityType, id, field);
    if (!canEdit) {
      return formatDraftCellValue(getValue({ [field]: undefined }, field));
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

  const getPersonSortValue = React.useCallback((person: Person, key: string): unknown => {
    if (key === 'birthPlace') {
      const value = getDraftAwareValue(createDraftKey('person', person.id, 'birthPlaceId'));
      return formatPlaceValue(value, person.birthPlace);
    }

    if (key === 'deathPlace') {
      const value = getDraftAwareValue(createDraftKey('person', person.id, 'deathPlaceId'));
      return formatPlaceValue(value, person.deathPlace);
    }

    if (['lastName', 'firstName', 'patronymic', 'gender'].includes(key)) {
      return draft && sourceData ? getDraftAwareValue(createDraftKey('person', person.id, key as AtdbFieldName)) : getValue(person, key);
    }

    return getValue(person, key);
  }, [draft, formatPlaceValue, getDraftAwareValue, getValue, sourceData]);

  const getFamilySortValue = React.useCallback((family: Family, key: string): unknown => {
    if (['familyName', 'husbandLastName', 'wifeLastName', 'comment', 'color'].includes(key)) {
      return draft && sourceData ? getDraftAwareValue(createDraftKey('family', family.id, key as AtdbFieldName)) : getValue(family, key);
    }

    return getValue(family, key);
  }, [draft, getDraftAwareValue, getValue, sourceData]);

  const getPlaceSortValue = React.useCallback((place: Place, key: string): unknown => {
    if (['name', 'shortName', 'comment'].includes(key)) {
      return draft && sourceData ? getDraftAwareValue(createDraftKey('place', place.id, key as AtdbFieldName)) : getValue(place, key);
    }

    return getValue(place, key);
  }, [draft, getDraftAwareValue, getValue, sourceData]);

  const handlePersonSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (personSortConfig && personSortConfig.key === key && personSortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setPersonSortConfig({ key, direction });
  };

  const handleFamilySort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (familySortConfig && familySortConfig.key === key && familySortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setFamilySortConfig({ key, direction });
  };

  const handleEventSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (eventSortConfig && eventSortConfig.key === key && eventSortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setEventSortConfig({ key, direction });
  };

  const handlePlaceSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (placeSortConfig && placeSortConfig.key === key && placeSortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setPlaceSortConfig({ key, direction });
  };

  const sortedPersons = React.useMemo(() => {
    if (!personSortConfig) return persons;

    return [...persons].sort((a, b) => {
      let valA = getPersonSortValue(a, personSortConfig.key);
      let valB = getPersonSortValue(b, personSortConfig.key);

      if (valA === undefined && valB === undefined) return 0;
      if (valA === undefined) return personSortConfig.direction === 'ascending' ? 1 : -1;
      if (valB === undefined) return personSortConfig.direction === 'ascending' ? -1 : 1;

      // Handle arrays (like spouseIds)
      if (Array.isArray(valA) && Array.isArray(valB)) {
        valA = (valA as number[]).join(',');
        valB = (valB as number[]).join(',');
      }

      // Compare as strings for consistent sorting
      const strA = String(valA);
      const strB = String(valB);

      if (personSortConfig.direction === 'ascending') {
        return strA.localeCompare(strB, undefined, { numeric: true });
      } else {
        return strB.localeCompare(strA, undefined, { numeric: true });
      }
    });
  }, [persons, personSortConfig, getPersonSortValue]);

  const sortedFamilies = React.useMemo(() => {
    if (!familySortConfig) return families;

    return [...families].sort((a, b) => {
      let valA = getFamilySortValue(a, familySortConfig.key);
      let valB = getFamilySortValue(b, familySortConfig.key);

      if (valA === undefined && valB === undefined) return 0;
      if (valA === undefined) return familySortConfig.direction === 'ascending' ? 1 : -1;
      if (valB === undefined) return familySortConfig.direction === 'ascending' ? -1 : 1;

      // Handle arrays (like childrenIds)
      if (Array.isArray(valA) && Array.isArray(valB)) {
        valA = (valA as number[]).join(',');
        valB = (valB as number[]).join(',');
      }

      // Compare as strings for consistent sorting
      const strA = String(valA);
      const strB = String(valB);

      if (familySortConfig.direction === 'ascending') {
        return strA.localeCompare(strB, undefined, { numeric: true });
      } else {
        return strB.localeCompare(strA, undefined, { numeric: true });
      }
    });
  }, [families, familySortConfig, getFamilySortValue]);

  const sortedEvents = React.useMemo(() => {
    if (!eventSortConfig) return events;

    return [...events].sort((a, b) => {
      // Get values, handling 'personId' specially as the first element of personIds
      let valA, valB;
      if (eventSortConfig.key === 'personId') {
        valA = a.personIds && a.personIds.length > 0 ? a.personIds[0] : undefined;
        valB = b.personIds && b.personIds.length > 0 ? b.personIds[0] : undefined;
      } else {
        valA = getValue(a, eventSortConfig.key);
        valB = getValue(b, eventSortConfig.key);
      }

      if (valA === undefined && valB === undefined) return 0;
      if (valA === undefined) return eventSortConfig.direction === 'ascending' ? 1 : -1;
      if (valB === undefined) return eventSortConfig.direction === 'ascending' ? -1 : 1;

      // Compare as strings for consistent sorting
      const strA = String(valA);
      const strB = String(valB);

      if (eventSortConfig.direction === 'ascending') {
        return strA.localeCompare(strB, undefined, { numeric: true });
      } else {
        return strB.localeCompare(strA, undefined, { numeric: true });
      }
    });
  }, [events, eventSortConfig, getValue]);

  const sortedPlaces = React.useMemo(() => {
    if (!placeSortConfig) return places;

    return [...places].sort((a, b) => {
      const valA = getPlaceSortValue(a, placeSortConfig.key);
      const valB = getPlaceSortValue(b, placeSortConfig.key);

      if (valA === undefined && valB === undefined) return 0;
      if (valA === undefined) return placeSortConfig.direction === 'ascending' ? 1 : -1;
      if (valB === undefined) return placeSortConfig.direction === 'ascending' ? -1 : 1;

      // Compare as strings for consistent sorting
      const strA = String(valA);
      const strB = String(valB);

      if (placeSortConfig.direction === 'ascending') {
        return strA.localeCompare(strB, undefined, { numeric: true });
      } else {
        return strB.localeCompare(strA, undefined, { numeric: true });
      }
    });
  }, [places, placeSortConfig, getPlaceSortValue]);

  const getSortIndicator = (key: string, sortConfig: SortConfig | null) => {
    if (!sortConfig || sortConfig.key !== key) return '';
    return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
  };

  const getStickyIdHeaderClassName = () =>
    `py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200 sticky ${
      canSelectRows ? 'left-12' : 'left-0'
    } bg-gray-100 z-30`;

  const getStickyIdCellClassName = () =>
    `py-2 px-4 border-b sticky ${canSelectRows ? 'left-12' : 'left-0'} bg-white z-10`;

  const renderSelectionHeader = (entityType: AtdbWritableEntity, rowIds: readonly number[]) => {
    if (!canSelectRows || selectableEntityType !== entityType) {
      return null;
    }

    const allSelected = rowIds.length > 0 && rowIds.every((id) => selectedIdSet.has(id));
    return (
      <th className="sticky left-0 z-40 w-12 min-w-12 border-b bg-gray-100 px-3 py-2 text-center">
        <input
          type="checkbox"
          aria-label="Выбрать все строки"
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

  const renderPersonsTable = (showContent: boolean) => {
    if (showContent && sortedPersons.length === 0) {
      return <p className="text-gray-500">Нет доступных данных о персонах</p>;
    }

    return (
      <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
        <thead className="sticky top-0 z-20 bg-gray-100">
          <tr className="bg-gray-100">
            {renderSelectionHeader('person', sortedPersons.map((person) => person.id))}
            <th
              className={getStickyIdHeaderClassName()}
              onClick={() => handlePersonSort('id')}
            >
              ID{getSortIndicator('id', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('lastName')}
            >
              Фамилия{getSortIndicator('lastName', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('firstName')}
            >
              Имя{getSortIndicator('firstName', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('patronymic')}
            >
              Отчество{getSortIndicator('patronymic', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('gender')}
            >
              Пол{getSortIndicator('gender', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('birthDate')}
            >
              Дата рождения{getSortIndicator('birthDate', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('deathDate')}
            >
              Дата смерти{getSortIndicator('deathDate', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('birthPlace')}
            >
              Место рождения{getSortIndicator('birthPlace', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('deathPlace')}
            >
              Место смерти{getSortIndicator('deathPlace', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('fatherId')}
            >
              ID отца{getSortIndicator('fatherId', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('motherId')}
            >
              ID матери{getSortIndicator('motherId', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('notes')}
            >
              Примечания{getSortIndicator('notes', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('occupation')}
            >
              Основное занятие{getSortIndicator('occupation', personSortConfig)}
            </th>
          </tr>
        </thead>
        {showContent && (
          <tbody>
            {sortedPersons.map((person) => (
              <tr key={person.id} className="hover:bg-gray-50">
                {renderSelectionCell('person', person.id)}
                <td className={getStickyIdCellClassName()}>{person.id}</td>
                <td className="py-2 px-4 border-b">{renderTextEditor('person', person.id, 'lastName', 'Фамилия')}</td>
                <td className="py-2 px-4 border-b">{renderTextEditor('person', person.id, 'firstName', 'Имя')}</td>
                <td className="py-2 px-4 border-b">{renderTextEditor('person', person.id, 'patronymic', 'Отчество')}</td>
                <td className="py-2 px-4 border-b">{renderGenderEditor(person)}</td>
                <td className="py-2 px-4 border-b">{person.birthDate || '-'}</td>
                <td className="py-2 px-4 border-b">{person.deathDate || '-'}</td>
                <td className="py-2 px-4 border-b">{renderPlaceLinkEditor(person, 'birthPlaceId', 'Место рождения')}</td>
                <td className="py-2 px-4 border-b">{renderPlaceLinkEditor(person, 'deathPlaceId', 'Место смерти')}</td>
                <td className="py-2 px-4 border-b">{person.fatherId || '-'}</td>
                <td className="py-2 px-4 border-b">{person.motherId || '-'}</td>
                <td className="py-2 px-4 border-b">{person.notes || '-'}</td>
                <td className="py-2 px-4 border-b">{person.occupation || '-'}</td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
    );
  };

  const renderFamiliesTable = (showContent: boolean) => {
    if (showContent && sortedFamilies.length === 0) {
      return <p className="text-gray-500">Нет доступных данных о родах</p>;
    }

    // Only show header when renderOnlyHeader is true
    if (renderOnlyHeader) {
      return (
        <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
          <thead className="sticky top-0 z-20 bg-gray-100">
            <tr className="bg-gray-100">
              {renderSelectionHeader('family', sortedFamilies.map((family) => family.id))}
              <th
                className={getStickyIdHeaderClassName()}
                onClick={() => handleFamilySort('id')}
              >
                ID{getSortIndicator('id', familySortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleFamilySort('familyName')}
              >
                Название рода{getSortIndicator('familyName', familySortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleFamilySort('husbandLastName')}
              >
                Мужская фамилия{getSortIndicator('husbandLastName', familySortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleFamilySort('wifeLastName')}
              >
                Женская фамилия{getSortIndicator('wifeLastName', familySortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleFamilySort('comment')}
              >
                Комментарий{getSortIndicator('comment', familySortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleFamilySort('color')}
              >
                Цвет{getSortIndicator('color', familySortConfig)}
              </th>
            </tr>
          </thead>
        </table>
      );
    }

    // Only show content when renderOnlyContent is true
    if (renderOnlyContent) {
      return (
        <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
          <tbody>
            {sortedFamilies.map((family) => (
              <tr key={family.id} className="hover:bg-gray-50">
                {renderSelectionCell('family', family.id)}
                <td className={getStickyIdCellClassName()}>{family.id}</td>
                <td className="py-2 px-4 border-b">{family.familyName || '-'}</td>
                <td className="py-2 px-4 border-b">{family.husbandLastName || '-'}</td>
                <td className="py-2 px-4 border-b">{family.wifeLastName || '-'}</td>
                <td className="py-2 px-4 border-b">{family.comment || '-'}</td>
                <td className="py-2 px-4 border-b">{family.color ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    // Default behavior (for backward compatibility)
    return (
      <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
        <thead className="sticky top-0 z-20 bg-gray-100">
          <tr className="bg-gray-100">
            {renderSelectionHeader('family', sortedFamilies.map((family) => family.id))}
            <th
              className={getStickyIdHeaderClassName()}
              onClick={() => handleFamilySort('id')}
            >
              ID{getSortIndicator('id', familySortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handleFamilySort('familyName')}
            >
              Название рода{getSortIndicator('familyName', familySortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handleFamilySort('husbandLastName')}
            >
              Мужская фамилия{getSortIndicator('husbandLastName', familySortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handleFamilySort('wifeLastName')}
            >
              Женская фамилия{getSortIndicator('wifeLastName', familySortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handleFamilySort('comment')}
            >
              Комментарий{getSortIndicator('comment', familySortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handleFamilySort('color')}
            >
              Цвет{getSortIndicator('color', familySortConfig)}
            </th>
          </tr>
        </thead>
        {showContent && (
          <tbody>
            {sortedFamilies.map((family) => (
              <tr key={family.id} className="hover:bg-gray-50">
                {renderSelectionCell('family', family.id)}
                <td className={getStickyIdCellClassName()}>{family.id}</td>
                <td className="py-2 px-4 border-b">{renderTextEditor('family', family.id, 'familyName', 'Название рода')}</td>
                <td className="py-2 px-4 border-b">{renderTextEditor('family', family.id, 'husbandLastName', 'Мужская фамилия')}</td>
                <td className="py-2 px-4 border-b">{renderTextEditor('family', family.id, 'wifeLastName', 'Женская фамилия')}</td>
                <td className="py-2 px-4 border-b">{renderTextEditor('family', family.id, 'comment', 'Комментарий рода')}</td>
                <td className="py-2 px-4 border-b">{renderNumberEditor('family', family.id, 'color', 'Цвет рода')}</td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
    );
  };

  const renderEventsTable = (showContent: boolean) => {
    if (showContent && sortedEvents.length === 0) {
      return <p className="text-gray-500">Нет доступных данных о событиях</p>;
    }

    // Only show header when renderOnlyHeader is true
    if (renderOnlyHeader) {
      return (
        <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
          <thead className="sticky top-0 z-20 bg-gray-100">
            <tr className="bg-gray-100">
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200 sticky left-0 bg-gray-100 z-30"
                onClick={() => handleEventSort('id')}
              >
                ID{getSortIndicator('id', eventSortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleEventSort('personId')}
              >
                ID персоны{getSortIndicator('personId', eventSortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleEventSort('eventType')}
              >
                Тип события{getSortIndicator('eventType', eventSortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleEventSort('date')}
              >
                Дата{getSortIndicator('date', eventSortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleEventSort('place')}
              >
                Место{getSortIndicator('place', eventSortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleEventSort('description')}
              >
                Описание{getSortIndicator('description', eventSortConfig)}
              </th>
            </tr>
          </thead>
        </table>
      );
    }

    // Only show content when renderOnlyContent is true
    if (renderOnlyContent) {
      return (
        <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
          <tbody>
            {sortedEvents.map((event) => (
              <tr key={event.id} className="hover:bg-gray-50">
                <td className="py-2 px-4 border-b sticky left-0 bg-white z-10">{event.id}</td>
                <td className="py-2 px-4 border-b">{event.personIds ? event.personIds.join(', ') : '-'}</td>
                <td className="py-2 px-4 border-b">{getEventTypeName(event.eventType)}</td>
                <td className="py-2 px-4 border-b">{event.date || '-'}</td>
                <td className="py-2 px-4 border-b">{event.place || '-'}</td>
                <td className="py-2 px-4 border-b">{event.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    // Default behavior (for backward compatibility)
    return (
      <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
        <thead className="sticky top-0 z-20 bg-gray-100">
          <tr className="bg-gray-100">
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200 sticky left-0 bg-gray-100 z-30"
              onClick={() => handleEventSort('id')}
            >
              ID{getSortIndicator('id', eventSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handleEventSort('personId')}
            >
              ID персоны{getSortIndicator('personId', eventSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handleEventSort('eventType')}
            >
              Тип события{getSortIndicator('eventType', eventSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handleEventSort('date')}
            >
              Дата{getSortIndicator('date', eventSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handleEventSort('place')}
            >
              Место{getSortIndicator('place', eventSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handleEventSort('description')}
            >
              Описание{getSortIndicator('description', eventSortConfig)}
            </th>
          </tr>
        </thead>
        {showContent && (
          <tbody>
            {sortedEvents.map((event) => (
              <tr key={event.id} className="hover:bg-gray-50">
                <td className="py-2 px-4 border-b sticky left-0 bg-white z-10">{event.id}</td>
                <td className="py-2 px-4 border-b">{event.personIds ? event.personIds.join(', ') : '-'}</td>
                <td className="py-2 px-4 border-b">{getEventTypeName(event.eventType)}</td>
                <td className="py-2 px-4 border-b">{event.date || '-'}</td>
                <td className="py-2 px-4 border-b">{event.place || '-'}</td>
                <td className="py-2 px-4 border-b">{event.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
    );
  };

  const renderPlacesTable = (showContent: boolean) => {
    if (showContent && sortedPlaces.length === 0) {
      return <p className="text-gray-500">Нет доступных данных о местах</p>;
    }

    // Only show header when renderOnlyHeader is true
    if (renderOnlyHeader) {
      return (
        <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
          <thead className="sticky top-0 z-20 bg-gray-100">
            <tr className="bg-gray-100">
              {renderSelectionHeader('place', sortedPlaces.map((place) => place.id))}
              <th
                className={getStickyIdHeaderClassName()}
                onClick={() => handlePlaceSort('id')}
              >
                ID{getSortIndicator('id', placeSortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handlePlaceSort('name')}
              >
                Название{getSortIndicator('name', placeSortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handlePlaceSort('shortName')}
              >
                Краткое название{getSortIndicator('shortName', placeSortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handlePlaceSort('comment')}
              >
                Комментарий{getSortIndicator('comment', placeSortConfig)}
              </th>
            </tr>
          </thead>
        </table>
      );
    }

    // Only show content when renderOnlyContent is true
    if (renderOnlyContent) {
      return (
        <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
          <tbody>
            {sortedPlaces.map((place) => (
              <tr key={place.id} className="hover:bg-gray-50">
                {renderSelectionCell('place', place.id)}
                <td className={getStickyIdCellClassName()}>{place.id}</td>
                <td className="py-2 px-4 border-b">{renderTextEditor('place', place.id, 'name', 'Название места')}</td>
                <td className="py-2 px-4 border-b">{renderTextEditor('place', place.id, 'shortName', 'Краткое название места')}</td>
                <td className="py-2 px-4 border-b">{renderTextEditor('place', place.id, 'comment', 'Комментарий места')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    // Default behavior (for backward compatibility)
    return (
      <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
        <thead className="sticky top-0 z-20 bg-gray-100">
          <tr className="bg-gray-100">
            {renderSelectionHeader('place', sortedPlaces.map((place) => place.id))}
            <th
              className={getStickyIdHeaderClassName()}
              onClick={() => handlePlaceSort('id')}
            >
              ID{getSortIndicator('id', placeSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePlaceSort('name')}
            >
              Название{getSortIndicator('name', placeSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePlaceSort('shortName')}
            >
              Краткое название{getSortIndicator('shortName', placeSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePlaceSort('comment')}
            >
              Комментарий{getSortIndicator('comment', placeSortConfig)}
            </th>
          </tr>
        </thead>
        {showContent && (
          <tbody>
            {sortedPlaces.map((place) => (
              <tr key={place.id} className="hover:bg-gray-50">
                {renderSelectionCell('place', place.id)}
                <td className={getStickyIdCellClassName()}>{place.id}</td>
                <td className="py-2 px-4 border-b">{renderTextEditor('place', place.id, 'name', 'Название места')}</td>
                <td className="py-2 px-4 border-b">{renderTextEditor('place', place.id, 'shortName', 'Краткое название места')}</td>
                <td className="py-2 px-4 border-b">{renderTextEditor('place', place.id, 'comment', 'Комментарий места')}</td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
    );
  };

  if (activeEntity === 'persons') {
    return renderPersonsTable(true);
  } else if (activeEntity === 'families') {
    return renderFamiliesTable(true);
  } else if (activeEntity === 'events') {
    return renderEventsTable(true);
  } else if (activeEntity === 'places') {
    return renderPlacesTable(true);
  } else {
    return (
      <div className="w-full">
        <p className="text-gray-500">Нет доступных данных</p>
      </div>
    );
  }
};

export default DataTable;
