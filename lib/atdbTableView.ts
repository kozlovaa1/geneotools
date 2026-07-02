import {
  getDraftValue,
  type AtdbSelectableEntity,
  type AtdbEditDraftState,
} from './atdbEditDraft';
import { formatAtdbPlaceLabel, formatAtdbPlaceParentPath } from './atdbPlaceLabels';
import type { AtdbFieldName, AtdbWritableEntity } from './sqlProcessor';
import type { Event, Family, ParsedAtdb, Person, Place } from './types';
import { getEventTypeName } from './utils';

export type AtdbTableEntity = 'persons' | 'families' | 'events' | 'places';
export type AtdbTableRow = Person | Family | Event | Place;
export type AtdbTableFilterOperator = 'contains' | 'equals' | 'empty' | 'not-empty';
export type AtdbTableSortDirection = 'ascending' | 'descending';
export type AtdbTableColumnValueKind = 'text' | 'number' | 'gender' | 'place-link' | 'event-type';
export type AtdbTableCellValue = string | number | readonly (string | number)[] | null | undefined;

export interface AtdbTableColumn {
  entity: AtdbTableEntity;
  key: string;
  label: string;
  searchable: boolean;
  sortable: boolean;
  filterable: boolean;
  valueKind: AtdbTableColumnValueKind;
  sourceField?: AtdbFieldName;
  writableEntity?: AtdbWritableEntity;
}

export interface AtdbTableSortConfig {
  key: string;
  direction: AtdbTableSortDirection;
}

export interface AtdbTableFilter {
  field: string;
  operator: AtdbTableFilterOperator;
  value?: string;
}

export interface AtdbTableQuery {
  entity: AtdbTableEntity;
  quickSearch?: string;
  filter?: AtdbTableFilter | null;
  sort?: AtdbTableSortConfig | null;
}

export interface AtdbTableQueryState {
  quickSearch: string;
  filter: AtdbTableFilter | null;
  sort: AtdbTableSortConfig | null;
}

export interface AtdbTableQueryResult<Row extends AtdbTableRow = AtdbTableRow> {
  entity: AtdbTableEntity;
  rows: Row[];
  visibleIds: number[];
  totalCount: number;
  visibleCount: number;
  activeFilterCount: number;
  columns: readonly AtdbTableColumn[];
  filterableColumns: readonly AtdbTableColumn[];
}

interface AtdbTableQueryContext {
  placeById: ReadonlyMap<number, Place>;
  cellValueCache: Map<string, Map<string, AtdbTableCellValue>>;
}

const TABLE_FILTER_OPERATORS = new Set<AtdbTableFilterOperator>([
  'contains',
  'equals',
  'empty',
  'not-empty',
]);

const PERSON_COLUMNS = [
  createColumn('persons', 'id', 'ID', 'number'),
  createColumn('persons', 'lastName', 'Фамилия', 'text', {
    sourceField: 'lastName',
    writableEntity: 'person',
  }),
  createColumn('persons', 'birthLastName', 'Фамилия при рождении', 'text', {
    sourceField: 'birthLastName',
    writableEntity: 'person',
  }),
  createColumn('persons', 'firstName', 'Имя', 'text', {
    sourceField: 'firstName',
    writableEntity: 'person',
  }),
  createColumn('persons', 'patronymic', 'Отчество', 'text', {
    sourceField: 'patronymic',
    writableEntity: 'person',
  }),
  createColumn('persons', 'gender', 'Пол', 'gender', {
    sourceField: 'gender',
    writableEntity: 'person',
  }),
  createColumn('persons', 'birthDate', 'Дата рождения', 'text', {
    sourceField: 'birthDate',
    writableEntity: 'person',
  }),
  createColumn('persons', 'deathDate', 'Дата смерти', 'text', {
    sourceField: 'deathDate',
    writableEntity: 'person',
  }),
  createColumn('persons', 'birthPlace', 'Место рождения', 'place-link', {
    sourceField: 'birthPlaceId',
    writableEntity: 'person',
  }),
  createColumn('persons', 'deathPlace', 'Место смерти', 'place-link', {
    sourceField: 'deathPlaceId',
    writableEntity: 'person',
  }),
  createColumn('persons', 'fatherId', 'ID отца', 'number'),
  createColumn('persons', 'motherId', 'ID матери', 'number'),
  createColumn('persons', 'notes', 'Примечания', 'text'),
  createColumn('persons', 'occupation', 'Основное занятие', 'text'),
] as const satisfies readonly AtdbTableColumn[];

const FAMILY_COLUMNS = [
  createColumn('families', 'id', 'ID', 'number'),
  createColumn('families', 'familyName', 'Название рода', 'text', {
    sourceField: 'familyName',
    writableEntity: 'family',
  }),
  createColumn('families', 'husbandLastName', 'Мужская фамилия', 'text', {
    sourceField: 'husbandLastName',
    writableEntity: 'family',
  }),
  createColumn('families', 'wifeLastName', 'Женская фамилия', 'text', {
    sourceField: 'wifeLastName',
    writableEntity: 'family',
  }),
  createColumn('families', 'comment', 'Комментарий', 'text', {
    sourceField: 'comment',
    writableEntity: 'family',
  }),
  createColumn('families', 'color', 'Цвет', 'number', {
    sourceField: 'color',
    writableEntity: 'family',
  }),
] as const satisfies readonly AtdbTableColumn[];

const EVENT_COLUMNS = [
  createColumn('events', 'id', 'ID', 'number'),
  createColumn('events', 'personId', 'ID персоны', 'number'),
  createColumn('events', 'eventType', 'Тип события', 'event-type'),
  createColumn('events', 'date', 'Дата', 'text'),
  createColumn('events', 'place', 'Место', 'place-link', {
    sourceField: 'placeId',
    writableEntity: 'event',
  }),
  createColumn('events', 'description', 'Описание', 'text'),
] as const satisfies readonly AtdbTableColumn[];

const PLACE_COLUMNS = [
  createColumn('places', 'id', 'ID', 'number'),
  createColumn('places', 'name', 'Название', 'text', {
    sourceField: 'name',
    writableEntity: 'place',
  }),
  createColumn('places', 'shortName', 'Краткое название', 'text', {
    sourceField: 'shortName',
    writableEntity: 'place',
  }),
  createColumn('places', 'placeNamingDate', 'Дата именования', 'text'),
  createColumn('places', 'parentPlace', 'Родительское место', 'place-link', {
    sourceField: 'parentId',
    writableEntity: 'place',
  }),
  createColumn('places', 'parentPath', 'Путь родительских мест', 'text'),
  createColumn('places', 'comment', 'Комментарий', 'text', {
    sourceField: 'comment',
    writableEntity: 'place',
  }),
] as const satisfies readonly AtdbTableColumn[];

const TABLE_COLUMNS: Record<AtdbTableEntity, readonly AtdbTableColumn[]> = {
  persons: PERSON_COLUMNS,
  families: FAMILY_COLUMNS,
  events: EVENT_COLUMNS,
  places: PLACE_COLUMNS,
};

export function isAtdbTableEntity(value: unknown): value is AtdbTableEntity {
  return value === 'persons' || value === 'families' || value === 'events' || value === 'places';
}

export function getWritableEntityForAtdbTableEntity(entity: AtdbTableEntity): AtdbSelectableEntity | null {
  if (entity === 'persons') return 'person';
  if (entity === 'families') return 'family';
  if (entity === 'places') return 'place';
  return null;
}

export function getAtdbTableColumns(entity: AtdbTableEntity): readonly AtdbTableColumn[] {
  return TABLE_COLUMNS[entity] ?? [];
}

export function getAtdbTableFilterableColumns(entity: AtdbTableEntity): readonly AtdbTableColumn[] {
  return getAtdbTableColumns(entity).filter((column) => column.filterable);
}

export function getAtdbTableColumn(entity: AtdbTableEntity, key: string): AtdbTableColumn | undefined {
  return getAtdbTableColumns(entity).find((column) => column.key === key);
}

export function createEmptyAtdbTableQueryState(): AtdbTableQueryState {
  return {
    quickSearch: '',
    filter: null,
    sort: null,
  };
}

export function createAtdbTableQuery(entity: AtdbTableEntity, state: AtdbTableQueryState): AtdbTableQuery {
  return {
    entity,
    quickSearch: state.quickSearch,
    filter: state.filter,
    sort: state.sort,
  };
}

export function queryAtdbTableRows(
  data: ParsedAtdb,
  draft: AtdbEditDraftState | null | undefined,
  query: AtdbTableQuery,
): AtdbTableQueryResult {
  const entity = query.entity;
  const columns = getAtdbTableColumns(entity);
  const filterableColumns = columns.filter((column) => column.filterable);
  const searchableColumns = columns.filter((column) => column.searchable);
  const sourceRows = getAtdbTableRows(data, entity);
  const quickSearch = normalizeSearchText(query.quickSearch);
  const activeFilter = normalizeFilter(query.filter, filterableColumns);
  const context = createAtdbTableQueryContext(data);

  let rows = [...sourceRows];
  if (quickSearch.length > 0) {
    rows = rows.filter((row) =>
      searchableColumns.some((column) =>
        getSearchText(getCachedAtdbTableCellValue(context, data, draft, entity, row, column.key)).includes(quickSearch),
      ),
    );
  }

  if (activeFilter) {
    rows = rows.filter((row) =>
      matchesFilter(getCachedAtdbTableCellValue(context, data, draft, entity, row, activeFilter.field), activeFilter),
    );
  }

  const sort = query.sort;
  const sortColumn = sort ? columns.find((column) => column.key === sort.key && column.sortable) : undefined;
  if (sortColumn && sort) {
    rows = stableSortRows(rows, (left, right) => {
      const leftValue = getCachedAtdbTableCellValue(context, data, draft, entity, left, sortColumn.key);
      const rightValue = getCachedAtdbTableCellValue(context, data, draft, entity, right, sortColumn.key);
      return compareCellValues(leftValue, rightValue, sort.direction);
    });
  }

  return {
    entity,
    rows,
    visibleIds: rows.map((row) => row.id),
    totalCount: sourceRows.length,
    visibleCount: rows.length,
    activeFilterCount: activeFilter ? 1 : 0,
    columns,
    filterableColumns,
  };
}

export function getAtdbTableRows(data: ParsedAtdb, entity: AtdbTableEntity): AtdbTableRow[] {
  if (entity === 'persons') return data.persons;
  if (entity === 'families') return data.families;
  if (entity === 'events') return data.events;
  return data.places;
}

export function getAtdbTableCellValue(
  data: ParsedAtdb,
  draft: AtdbEditDraftState | null | undefined,
  entity: AtdbTableEntity,
  row: AtdbTableRow,
  columnKey: string,
): AtdbTableCellValue {
  return resolveAtdbTableCellValue(createAtdbTableQueryContext(data), data, draft, entity, row, columnKey);
}

function createAtdbTableQueryContext(data: ParsedAtdb): AtdbTableQueryContext {
  return {
    placeById: new Map(data.places.map((place) => [place.id, place])),
    cellValueCache: new Map(),
  };
}

function getCachedAtdbTableCellValue(
  context: AtdbTableQueryContext,
  data: ParsedAtdb,
  draft: AtdbEditDraftState | null | undefined,
  entity: AtdbTableEntity,
  row: AtdbTableRow,
  columnKey: string,
): AtdbTableCellValue {
  const rowCacheKey = `${entity}:${row.id}`;
  const existingRowCache = context.cellValueCache.get(rowCacheKey);
  const rowCache = existingRowCache ?? new Map<string, AtdbTableCellValue>();

  if (!existingRowCache) {
    context.cellValueCache.set(rowCacheKey, rowCache);
  }

  if (rowCache.has(columnKey)) {
    return rowCache.get(columnKey);
  }

  const value = resolveAtdbTableCellValue(context, data, draft, entity, row, columnKey);
  rowCache.set(columnKey, value);
  return value;
}

function resolveAtdbTableCellValue(
  context: AtdbTableQueryContext,
  data: ParsedAtdb,
  draft: AtdbEditDraftState | null | undefined,
  entity: AtdbTableEntity,
  row: AtdbTableRow,
  columnKey: string,
): AtdbTableCellValue {
  if (entity === 'persons') return getPersonCellValue(context, data, draft, row as Person, columnKey);
  if (entity === 'families') return getFamilyCellValue(data, draft, row as Family, columnKey);
  if (entity === 'events') return getEventCellValue(data, draft, row as Event, columnKey);
  return getPlaceCellValue(data, draft, row as Place, columnKey);
}

function createColumn(
  entity: AtdbTableEntity,
  key: string,
  label: string,
  valueKind: AtdbTableColumnValueKind,
  options: Pick<AtdbTableColumn, 'sourceField' | 'writableEntity'> = {},
): AtdbTableColumn {
  return {
    entity,
    key,
    label,
    valueKind,
    searchable: true,
    sortable: true,
    filterable: true,
    ...options,
  };
}

function getPersonCellValue(
  context: AtdbTableQueryContext,
  data: ParsedAtdb,
  draft: AtdbEditDraftState | null | undefined,
  person: Person,
  columnKey: string,
): AtdbTableCellValue {
  if (columnKey === 'birthPlace') {
    return getDraftAwarePlaceLinkLabel(context, data, draft, person, 'birthPlaceId', person.birthPlace);
  }

  if (columnKey === 'deathPlace') {
    return getDraftAwarePlaceLinkLabel(context, data, draft, person, 'deathPlaceId', person.deathPlace);
  }

  if (isPersonDraftField(columnKey)) {
    return getDraftAwareValue(data, draft, 'person', person.id, columnKey, person[columnKey]);
  }

  return getRecordValue(person, columnKey);
}

function getFamilyCellValue(
  data: ParsedAtdb,
  draft: AtdbEditDraftState | null | undefined,
  family: Family,
  columnKey: string,
): AtdbTableCellValue {
  if (isFamilyDraftField(columnKey)) {
    return getDraftAwareValue(data, draft, 'family', family.id, columnKey, family[columnKey]);
  }

  return getRecordValue(family, columnKey);
}

function getEventCellValue(
  data: ParsedAtdb,
  draft: AtdbEditDraftState | null | undefined,
  event: Event,
  columnKey: string,
): AtdbTableCellValue {
  if (columnKey === 'personId') {
    return event.personIds?.[0];
  }

  if (columnKey === 'eventType') {
    return getEventTypeName(event.eventType);
  }

  if (columnKey === 'place') {
    const draftValue = getDraftAwareValue(data, draft, 'event', event.id, 'placeId', event.placeId);
    if (draftValue === null) return '';
    if (typeof draftValue === 'number') return formatAtdbPlaceLabel(data, draftValue, { draft });
    return event.place ?? '';
  }

  return getRecordValue(event, columnKey);
}

function getPlaceCellValue(
  data: ParsedAtdb,
  draft: AtdbEditDraftState | null | undefined,
  place: Place,
  columnKey: string,
): AtdbTableCellValue {
  if (columnKey === 'parentPlace') {
    const draftValue = getDraftAwareValue(data, draft, 'place', place.id, 'parentId', place.parentId);
    if (draftValue === null) return '';
    if (typeof draftValue === 'number') return formatAtdbPlaceLabel(data, draftValue, { draft });
    return '';
  }

  if (columnKey === 'parentPath') {
    return formatAtdbPlaceParentPath(data, place.id, { draft });
  }

  if (columnKey === 'placeNamingDate') {
    return place.placeNamingDateInfo?.display || place.placeNamingDate;
  }

  if (isPlaceDraftField(columnKey)) {
    return getDraftAwareValue(data, draft, 'place', place.id, columnKey, place[columnKey]);
  }

  return getRecordValue(place, columnKey);
}

function getDraftAwarePlaceLinkLabel(
  context: AtdbTableQueryContext,
  data: ParsedAtdb,
  draft: AtdbEditDraftState | null | undefined,
  person: Person,
  field: 'birthPlaceId' | 'deathPlaceId',
  fallback: string | undefined,
): string {
  const draftValue = getDraftAwareValue(data, draft, 'person', person.id, field, person[field]);
  if (draftValue === null) return '';
  if (typeof draftValue === 'number') return getDraftAwarePlaceLabel(context, data, draft, draftValue);
  return fallback ?? '';
}

function getDraftAwarePlaceLabel(
  context: AtdbTableQueryContext,
  data: ParsedAtdb,
  draft: AtdbEditDraftState | null | undefined,
  placeId: number,
): string {
  return formatAtdbPlaceLabel(data, placeId, { draft });
}

function getDraftAwareValue(
  data: ParsedAtdb,
  draft: AtdbEditDraftState | null | undefined,
  entityType: AtdbWritableEntity,
  id: number,
  field: AtdbFieldName,
  fallback: AtdbTableCellValue,
): AtdbTableCellValue {
  if (!draft) return fallback;
  return getDraftValue(draft, data, { entityType, id, field });
}

function isPersonDraftField(field: string): field is 'firstName' | 'lastName' | 'birthLastName' | 'patronymic' | 'gender' | 'birthDate' | 'deathDate' | 'birthPlaceId' | 'deathPlaceId' {
  return field === 'firstName'
    || field === 'lastName'
    || field === 'birthLastName'
    || field === 'patronymic'
    || field === 'gender'
    || field === 'birthDate'
    || field === 'deathDate'
    || field === 'birthPlaceId'
    || field === 'deathPlaceId';
}

function isFamilyDraftField(field: string): field is 'familyName' | 'husbandLastName' | 'wifeLastName' | 'comment' | 'color' {
  return field === 'familyName'
    || field === 'husbandLastName'
    || field === 'wifeLastName'
    || field === 'comment'
    || field === 'color';
}

function isPlaceDraftField(field: string): field is 'name' | 'shortName' | 'comment' | 'parentId' {
  return field === 'name' || field === 'shortName' || field === 'comment' || field === 'parentId';
}

function getRecordValue(record: AtdbTableRow, key: string): AtdbTableCellValue {
  const value = (record as unknown as Record<string, unknown>)[key];
  if (isAtdbTableCellValue(value)) return value;
  return undefined;
}

function isAtdbTableCellValue(value: unknown): value is AtdbTableCellValue {
  return value === null
    || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || (Array.isArray(value) && value.every((item) => typeof item === 'string' || typeof item === 'number'));
}

function normalizeFilter(
  filter: AtdbTableFilter | null | undefined,
  filterableColumns: readonly AtdbTableColumn[],
): AtdbTableFilter | null {
  if (!filter || !TABLE_FILTER_OPERATORS.has(filter.operator)) return null;
  if (!filterableColumns.some((column) => column.key === filter.field)) return null;

  if (filter.operator === 'empty' || filter.operator === 'not-empty') {
    return {
      field: filter.field,
      operator: filter.operator,
    };
  }

  const value = normalizeSearchText(filter.value);
  if (value.length === 0) return null;

  return {
    field: filter.field,
    operator: filter.operator,
    value,
  };
}

function matchesFilter(value: AtdbTableCellValue, filter: AtdbTableFilter): boolean {
  const text = getSearchText(value);

  if (filter.operator === 'empty') {
    return text.length === 0;
  }

  if (filter.operator === 'not-empty') {
    return text.length > 0;
  }

  const expected = filter.value ?? '';
  if (filter.operator === 'equals') {
    return text === expected;
  }

  return text.includes(expected);
}

function stableSortRows<Row extends AtdbTableRow>(rows: Row[], compare: (left: Row, right: Row) => number): Row[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const result = compare(left.row, right.row);
      return result === 0 ? left.index - right.index : result;
    })
    .map((entry) => entry.row);
}

function compareCellValues(
  left: AtdbTableCellValue,
  right: AtdbTableCellValue,
  direction: AtdbTableSortDirection,
): number {
  const leftMissing = isMissingValue(left);
  const rightMissing = isMissingValue(right);
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return direction === 'ascending' ? 1 : -1;
  if (rightMissing) return direction === 'ascending' ? -1 : 1;

  const leftText = getDisplayText(left);
  const rightText = getDisplayText(right);
  const result = leftText.localeCompare(rightText, undefined, { numeric: true });
  return direction === 'ascending' ? result : -result;
}

function isMissingValue(value: AtdbTableCellValue): boolean {
  return value === null || value === undefined;
}

function getSearchText(value: AtdbTableCellValue): string {
  return getDisplayText(value).toLocaleLowerCase();
}

function normalizeSearchText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';
}

function getDisplayText(value: AtdbTableCellValue): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');
  return String(value);
}
