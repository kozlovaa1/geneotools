import {
  ATDB_EDITABLE_FAMILY_FIELDS,
  ATDB_EDITABLE_PERSON_FIELDS,
  ATDB_EDITABLE_PLACE_FIELDS,
  ATDB_GENDER_VALUES,
  getDraftValue,
  isAtdbEditableField,
  isAtdbSelectableEntityType,
  isFieldDirty,
  setDraftField,
  type AtdbDraftFieldKey,
  type AtdbDraftFieldValue,
  type AtdbEditDraftState,
  type AtdbSelectableEntity,
} from './atdbEditDraft';
import { parseAtdbIntegerInput } from './atdbIntegerInput';
import type {
  AtdbFieldName,
  AtdbFieldValue,
  ParsedAtdb,
} from './sqlProcessor';

export type AtdbBatchEditableValueKind = 'text' | 'number' | 'gender' | 'place-link';
export type AtdbBatchEditAction = 'fill' | 'clear' | 'replace';
export type AtdbBatchEditScopeType = 'selected' | 'all' | 'predicate';
export type AtdbBatchPredicateOperator = 'contains' | 'equals' | 'empty' | 'not-empty';
export type AtdbBatchPreviewStatus = 'affected' | 'skipped' | 'noop';
export type AtdbBatchPreviewReason =
  | 'invalid-action'
  | 'invalid-scope'
  | 'invalid-value'
  | 'unsupported-entity'
  | 'unsupported-field'
  | 'unsupported-operation'
  | 'replace-not-supported'
  | 'empty-search'
  | 'missing-record'
  | 'predicate-miss'
  | 'place-not-found'
  | 'not-editable-link'
  | 'no-change'
  | 'stale-preview';

export interface AtdbBatchEditableField {
  entityType: AtdbSelectableEntity;
  field: AtdbFieldName;
  label: string;
  valueKind: AtdbBatchEditableValueKind;
  supportsFill: boolean;
  supportsClear: boolean;
  supportsReplace: boolean;
}

export interface AtdbBatchEditPredicate {
  field: AtdbFieldName;
  operator: AtdbBatchPredicateOperator;
  value?: string;
  caseSensitive?: boolean;
}

export type AtdbBatchEditScope =
  | {
      type: 'selected';
      ids: readonly number[];
    }
  | {
      type: 'all';
    }
  | {
      type: 'predicate';
      predicate: AtdbBatchEditPredicate;
    };

export interface AtdbBatchEditOperation {
  entityType: AtdbSelectableEntity;
  field: AtdbFieldName;
  action: AtdbBatchEditAction;
  scope: AtdbBatchEditScope;
  value?: AtdbFieldValue;
  searchText?: string;
  replacementText?: string;
  caseSensitive?: boolean;
}

export interface AtdbBatchEditValidation {
  ok: boolean;
  code?: AtdbBatchPreviewReason;
  entityType?: string;
  field?: string;
  action?: string;
}

export interface AtdbBatchEditPreviewRow {
  entityType: AtdbSelectableEntity;
  id: number;
  field: AtdbFieldName;
  status: AtdbBatchPreviewStatus;
  reason?: AtdbBatchPreviewReason;
  currentValue?: AtdbDraftFieldValue;
  nextValue?: AtdbDraftFieldValue;
  dirty: boolean;
  overwritesDirty: boolean;
}

export interface AtdbBatchEditPreview {
  valid: boolean;
  operation: AtdbBatchEditOperation;
  fingerprint: string;
  validation: AtdbBatchEditValidation;
  rows: AtdbBatchEditPreviewRow[];
  counts: {
    total: number;
    affected: number;
    skipped: number;
    noop: number;
  };
  reasonCounts: Partial<Record<AtdbBatchPreviewReason, number>>;
}

export interface AtdbBatchEditApplyResult {
  draft: AtdbEditDraftState;
  applied: number;
  skipped: number;
  noop: number;
  stale: boolean;
  reason?: AtdbBatchPreviewReason;
}

type EntityRow = ParsedAtdb['persons'][number] | ParsedAtdb['families'][number] | ParsedAtdb['places'][number];

type FieldMetadataRecord<Field extends AtdbFieldName> = Record<
  Field,
  Omit<AtdbBatchEditableField, 'entityType' | 'field'>
>;

const PERSON_FIELD_METADATA: FieldMetadataRecord<(typeof ATDB_EDITABLE_PERSON_FIELDS)[number]> = {
  firstName: createTextMetadata('Имя'),
  lastName: createTextMetadata('Фамилия'),
  birthLastName: createTextMetadata('Фамилия при рождении'),
  patronymic: createTextMetadata('Отчество'),
  gender: {
    label: 'Пол',
    valueKind: 'gender',
    supportsFill: true,
    supportsClear: true,
    supportsReplace: false,
  },
  birthDate: createTextMetadata('Дата рождения'),
  deathDate: createTextMetadata('Дата смерти'),
  birthPlaceId: createPlaceLinkMetadata('Место рождения'),
  deathPlaceId: createPlaceLinkMetadata('Место смерти'),
};

const FAMILY_FIELD_METADATA: FieldMetadataRecord<(typeof ATDB_EDITABLE_FAMILY_FIELDS)[number]> = {
  familyName: createTextMetadata('Название рода'),
  husbandLastName: createTextMetadata('Мужская фамилия'),
  wifeLastName: createTextMetadata('Женская фамилия'),
  comment: createTextMetadata('Комментарий рода'),
  color: {
    label: 'Цвет',
    valueKind: 'number',
    supportsFill: true,
    supportsClear: true,
    supportsReplace: false,
  },
};

const PLACE_FIELD_METADATA: FieldMetadataRecord<(typeof ATDB_EDITABLE_PLACE_FIELDS)[number]> = {
  name: createTextMetadata('Название места'),
  shortName: createTextMetadata('Краткое название места'),
  comment: createTextMetadata('Комментарий места'),
  parentId: createPlaceLinkMetadata('Родительское место'),
};

const ATDB_BATCH_EDITABLE_PERSON_FIELDS = ATDB_EDITABLE_PERSON_FIELDS.filter(
  (field) => field !== 'birthDate' && field !== 'deathDate',
);
const ATDB_BATCH_EDITABLE_PLACE_FIELDS = ATDB_EDITABLE_PLACE_FIELDS.filter((field) => field !== 'parentId');

export const ATDB_BATCH_EDITABLE_FIELDS: readonly AtdbBatchEditableField[] = [
  ...ATDB_BATCH_EDITABLE_PERSON_FIELDS.map((field) => createEditableField('person', field, PERSON_FIELD_METADATA[field])),
  ...ATDB_EDITABLE_FAMILY_FIELDS.map((field) => createEditableField('family', field, FAMILY_FIELD_METADATA[field])),
  ...ATDB_BATCH_EDITABLE_PLACE_FIELDS.map((field) => createEditableField('place', field, PLACE_FIELD_METADATA[field])),
];

const EDITABLE_FIELD_BY_KEY = new Map(
  ATDB_BATCH_EDITABLE_FIELDS.map((metadata) => [createMetadataKey(metadata.entityType, metadata.field), metadata]),
);

const EMPTY_PREVIEW_COUNTS = {
  total: 0,
  affected: 0,
  skipped: 0,
  noop: 0,
} as const;

function createTextMetadata(label: string): Omit<AtdbBatchEditableField, 'entityType' | 'field'> {
  return {
    label,
    valueKind: 'text',
    supportsFill: true,
    supportsClear: true,
    supportsReplace: true,
  };
}

function createPlaceLinkMetadata(label: string): Omit<AtdbBatchEditableField, 'entityType' | 'field'> {
  return {
    label,
    valueKind: 'place-link',
    supportsFill: true,
    supportsClear: true,
    supportsReplace: false,
  };
}

function createEditableField<Field extends AtdbFieldName>(
  entityType: AtdbSelectableEntity,
  field: Field,
  metadata: Omit<AtdbBatchEditableField, 'entityType' | 'field'>,
): AtdbBatchEditableField {
  return {
    entityType,
    field,
    ...metadata,
  };
}

export function getAtdbBatchEditableFields(entityType?: AtdbSelectableEntity): AtdbBatchEditableField[] {
  return ATDB_BATCH_EDITABLE_FIELDS.filter((metadata) => !entityType || metadata.entityType === entityType);
}

export function getAtdbBatchEditableField(
  entityType: AtdbSelectableEntity,
  field: AtdbFieldName,
): AtdbBatchEditableField | null {
  return EDITABLE_FIELD_BY_KEY.get(createMetadataKey(entityType, field)) ?? null;
}

export function parseAtdbBatchIntegerInput(value: string): number | undefined {
  return parseAtdbIntegerInput(value);
}

export function previewAtdbBatchEdit(
  data: ParsedAtdb,
  draft: AtdbEditDraftState,
  operation: AtdbBatchEditOperation,
): AtdbBatchEditPreview {
  const normalizedOperation = normalizeOperation(operation);
  const fingerprint = createAtdbBatchEditFingerprint(data, draft, normalizedOperation);
  const validation = validateOperation(data, normalizedOperation);

  if (!validation.ok) {
    return createPreview(normalizedOperation, fingerprint, validation, []);
  }

  const metadata = getAtdbBatchEditableField(normalizedOperation.entityType, normalizedOperation.field);
  if (!metadata) {
    return createPreview(
      normalizedOperation,
      fingerprint,
      { ok: false, code: 'unsupported-field', entityType: normalizedOperation.entityType, field: normalizedOperation.field },
      [],
    );
  }

  const candidateIds = resolveCandidateIds(data, normalizedOperation);
  const rows = candidateIds.map((id) => previewRow(data, draft, normalizedOperation, metadata, id));
  return createPreview(normalizedOperation, fingerprint, validation, rows);
}

export function applyAtdbBatchEdit(
  data: ParsedAtdb,
  draft: AtdbEditDraftState,
  preview: AtdbBatchEditPreview,
): AtdbBatchEditApplyResult {
  const currentFingerprint = createAtdbBatchEditFingerprint(data, draft, preview.operation);
  if (!preview.valid || currentFingerprint !== preview.fingerprint) {
    return {
      draft,
      applied: 0,
      skipped: preview.counts.skipped,
      noop: preview.counts.noop,
      stale: true,
      reason: 'stale-preview',
    };
  }

  let nextDraft = draft;
  let applied = 0;
  for (const row of preview.rows) {
    if (row.status !== 'affected') continue;
    nextDraft = setDraftField(nextDraft, data, createDraftKey(row.entityType, row.id, row.field), row.nextValue);
    applied++;
  }

  return {
    draft: nextDraft,
    applied,
    skipped: preview.counts.skipped,
    noop: preview.counts.noop,
    stale: false,
  };
}

export function createAtdbBatchEditFingerprint(
  data: ParsedAtdb,
  draft: AtdbEditDraftState,
  operation: AtdbBatchEditOperation,
): string {
  return stableHash(
    stableStringify({
      operation: normalizeOperation(operation),
      editableData: {
        persons: data.persons.map((person) => ({
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          patronymic: person.patronymic,
          gender: person.gender,
          birthPlaceId: person.birthPlaceId,
          deathPlaceId: person.deathPlaceId,
        })),
        families: data.families.map((family) => ({
          id: family.id,
          familyName: family.familyName,
          husbandLastName: family.husbandLastName,
          wifeLastName: family.wifeLastName,
          comment: family.comment,
          color: family.color,
        })),
        places: data.places.map((place) => ({
          id: place.id,
          name: place.name,
          shortName: place.shortName,
          comment: place.comment,
        })),
      },
      draftChanges: Object.values(draft.changes).toSorted(compareDraftChanges),
    }),
  );
}

function validateOperation(data: ParsedAtdb, operation: AtdbBatchEditOperation): AtdbBatchEditValidation {
  if (!isAtdbSelectableEntityType(operation.entityType)) {
    return { ok: false, code: 'unsupported-entity', entityType: String(operation.entityType ?? 'unknown') };
  }

  if (!isAtdbEditableField(operation.entityType, operation.field)) {
    return {
      ok: false,
      code: 'unsupported-field',
      entityType: operation.entityType,
      field: String(operation.field ?? 'unknown'),
    };
  }

  const metadata = getAtdbBatchEditableField(operation.entityType, operation.field);
  if (!metadata) {
    return {
      ok: false,
      code: 'unsupported-field',
      entityType: operation.entityType,
      field: String(operation.field ?? 'unknown'),
    };
  }

  if (operation.action !== 'fill' && operation.action !== 'clear' && operation.action !== 'replace') {
    return { ok: false, code: 'invalid-action', entityType: operation.entityType, field: operation.field };
  }

  if ((operation.action === 'fill' && !metadata.supportsFill) || (operation.action === 'clear' && !metadata.supportsClear)) {
    return { ok: false, code: 'unsupported-operation', entityType: operation.entityType, field: operation.field };
  }

  if (operation.action === 'replace') {
    if (!metadata.supportsReplace) {
      return { ok: false, code: 'replace-not-supported', entityType: operation.entityType, field: operation.field };
    }

    if (!operation.searchText) {
      return { ok: false, code: 'empty-search', entityType: operation.entityType, field: operation.field };
    }
  }

  if (operation.action === 'fill') {
    const normalizedValue = normalizeOperationValue(metadata, operation.value);
    if (normalizedValue === undefined || normalizedValue === null) {
      return { ok: false, code: 'invalid-value', entityType: operation.entityType, field: operation.field };
    }
  }

  if (
    operation.action !== 'replace' &&
    metadata.valueKind === 'place-link' &&
    typeof operation.value === 'number' &&
    !data.places.some((place) => place.id === operation.value)
  ) {
    return { ok: true };
  }

  if (operation.scope.type === 'selected') {
    if (!Array.isArray(operation.scope.ids)) {
      return { ok: false, code: 'invalid-scope', entityType: operation.entityType, field: operation.field };
    }
    return { ok: true };
  }

  if (operation.scope.type === 'all') {
    return { ok: true };
  }

  if (operation.scope.type !== 'predicate') {
    return { ok: false, code: 'invalid-scope', entityType: operation.entityType, field: operation.field };
  }

  if (!isAtdbEditableField(operation.entityType, operation.scope.predicate.field)) {
    return {
      ok: false,
      code: 'unsupported-field',
      entityType: operation.entityType,
      field: String(operation.scope.predicate.field ?? 'unknown'),
    };
  }

  if (!['contains', 'equals', 'empty', 'not-empty'].includes(operation.scope.predicate.operator)) {
    return { ok: false, code: 'invalid-scope', entityType: operation.entityType, field: operation.scope.predicate.field };
  }

  return { ok: true };
}

function resolveCandidateIds(data: ParsedAtdb, operation: AtdbBatchEditOperation): number[] {
  if (operation.scope.type === 'selected') {
    return dedupeIds(operation.scope.ids);
  }

  return getRows(data, operation.entityType).map((row) => row.id);
}

function previewRow(
  data: ParsedAtdb,
  draft: AtdbEditDraftState,
  operation: AtdbBatchEditOperation,
  metadata: AtdbBatchEditableField,
  id: number,
): AtdbBatchEditPreviewRow {
  const row = getRow(data, operation.entityType, id);
  if (!row) {
    return createPreviewRow(operation.entityType, id, operation.field, 'skipped', {
      reason: 'missing-record',
      dirty: false,
    });
  }

  if (operation.scope.type === 'predicate' && !matchesPredicate(data, draft, operation.entityType, id, operation.scope.predicate)) {
    return createPreviewRow(operation.entityType, id, operation.field, 'skipped', {
      reason: 'predicate-miss',
      dirty: false,
    });
  }

  const key = createDraftKey(operation.entityType, id, operation.field);
  const currentValue = getDraftValue(draft, data, key);
  const dirty = isFieldDirty(draft, data, key);
  const originalValue = getOriginalValue(data, key);
  const nextValue = getNextValue(data, operation, metadata, currentValue, originalValue);

  if (nextValue.reason) {
    return createPreviewRow(operation.entityType, id, operation.field, 'skipped', {
      reason: nextValue.reason,
      currentValue,
      dirty,
    });
  }

  if (areBatchValuesEqual(operation.field, currentValue, nextValue.value)) {
    return createPreviewRow(operation.entityType, id, operation.field, 'noop', {
      reason: 'no-change',
      currentValue,
      nextValue: nextValue.value,
      dirty,
    });
  }

  return createPreviewRow(operation.entityType, id, operation.field, 'affected', {
    currentValue,
    nextValue: nextValue.value,
    dirty,
    overwritesDirty: dirty,
  });
}

function getNextValue(
  data: ParsedAtdb,
  operation: AtdbBatchEditOperation,
  metadata: AtdbBatchEditableField,
  currentValue: AtdbDraftFieldValue,
  originalValue: AtdbDraftFieldValue,
): { value?: AtdbDraftFieldValue; reason?: AtdbBatchPreviewReason } {
  if (metadata.valueKind === 'place-link' && typeof originalValue !== 'number') {
    return { reason: 'not-editable-link' };
  }

  if (operation.action === 'replace') {
    if (!metadata.supportsReplace) return { reason: 'replace-not-supported' };
    if (!operation.searchText) return { reason: 'empty-search' };
    if (typeof currentValue !== 'string') return { reason: 'invalid-value' };
    return {
      value: replaceStringValue(currentValue, operation.searchText, operation.replacementText ?? '', operation.caseSensitive),
    };
  }

  if (operation.action === 'clear') {
    return { value: null };
  }

  const value = normalizeOperationValue(metadata, operation.value);
  if (value === undefined || value === null) {
    return { reason: 'invalid-value' };
  }

  if (metadata.valueKind === 'place-link' && typeof value === 'number' && !data.places.some((place) => place.id === value)) {
    return { reason: 'place-not-found' };
  }

  return { value };
}

function matchesPredicate(
  data: ParsedAtdb,
  draft: AtdbEditDraftState,
  entityType: AtdbSelectableEntity,
  id: number,
  predicate: AtdbBatchEditPredicate,
): boolean {
  if (!isAtdbEditableField(entityType, predicate.field)) return false;

  const value = getDraftValue(draft, data, createDraftKey(entityType, id, predicate.field));
  const text = valueToPredicateText(value, predicate.caseSensitive);
  const expected = predicate.caseSensitive ? predicate.value ?? '' : (predicate.value ?? '').toLocaleLowerCase();

  if (predicate.operator === 'empty') {
    return text.length === 0;
  }

  if (predicate.operator === 'not-empty') {
    return text.length > 0;
  }

  if (predicate.operator === 'equals') {
    return text === expected;
  }

  return text.includes(expected);
}

function createPreview(
  operation: AtdbBatchEditOperation,
  fingerprint: string,
  validation: AtdbBatchEditValidation,
  rows: AtdbBatchEditPreviewRow[],
): AtdbBatchEditPreview {
  const reasonCounts: Partial<Record<AtdbBatchPreviewReason, number>> = {};
  const counts = rows.reduce(
    (accumulator, row) => {
      accumulator.total++;
      if (row.status === 'affected') accumulator.affected++;
      if (row.status === 'skipped') accumulator.skipped++;
      if (row.status === 'noop') accumulator.noop++;
      if (row.reason) {
        reasonCounts[row.reason] = (reasonCounts[row.reason] ?? 0) + 1;
      }
      return accumulator;
    },
    { ...EMPTY_PREVIEW_COUNTS },
  );

  if (!validation.ok && validation.code) {
    reasonCounts[validation.code] = (reasonCounts[validation.code] ?? 0) + 1;
  }

  return {
    valid: validation.ok,
    operation,
    fingerprint,
    validation,
    rows,
    counts,
    reasonCounts,
  };
}

function createPreviewRow(
  entityType: AtdbSelectableEntity,
  id: number,
  field: AtdbFieldName,
  status: AtdbBatchPreviewStatus,
  options: {
    reason?: AtdbBatchPreviewReason;
    currentValue?: AtdbDraftFieldValue;
    nextValue?: AtdbDraftFieldValue;
    dirty?: boolean;
    overwritesDirty?: boolean;
  } = {},
): AtdbBatchEditPreviewRow {
  return {
    entityType,
    id,
    field,
    status,
    reason: options.reason,
    currentValue: options.currentValue,
    nextValue: options.nextValue,
    dirty: options.dirty ?? false,
    overwritesDirty: options.overwritesDirty ?? false,
  };
}

function normalizeOperation(operation: AtdbBatchEditOperation): AtdbBatchEditOperation {
  return {
    entityType: operation.entityType,
    field: operation.field,
    action: operation.action,
    value: operation.value,
    searchText: operation.searchText ?? '',
    replacementText: operation.replacementText ?? '',
    caseSensitive: operation.caseSensitive === true,
    scope: normalizeScope(operation.scope),
  };
}

function normalizeScope(scope: AtdbBatchEditScope): AtdbBatchEditScope {
  if (scope.type === 'selected') {
    return { type: 'selected', ids: dedupeIds(scope.ids) };
  }

  if (scope.type === 'predicate') {
    return {
      type: 'predicate',
      predicate: {
        field: scope.predicate.field,
        operator: scope.predicate.operator,
        value: scope.predicate.value ?? '',
        caseSensitive: scope.predicate.caseSensitive === true,
      },
    };
  }

  return { type: 'all' };
}

function normalizeOperationValue(
  metadata: AtdbBatchEditableField,
  value: AtdbFieldValue,
): AtdbDraftFieldValue | undefined {
  if (value === null || value === undefined) {
    return null;
  }

  if (metadata.valueKind === 'text') {
    return typeof value === 'string' ? value : undefined;
  }

  if (metadata.valueKind === 'number' || metadata.valueKind === 'place-link') {
    return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
  }

  return typeof value === 'string' && (ATDB_GENDER_VALUES as readonly string[]).includes(value) ? value : undefined;
}

function replaceStringValue(value: string, searchText: string, replacementText: string, caseSensitive = false): string {
  if (searchText.length === 0) return value;

  if (caseSensitive) {
    return value.split(searchText).join(replacementText);
  }

  return value.replaceAll(new RegExp(escapeRegExp(searchText), 'gi'), replacementText);
}

function valueToPredicateText(value: AtdbDraftFieldValue, caseSensitive = false): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  return caseSensitive ? text : text.toLocaleLowerCase();
}

function getRows(data: ParsedAtdb, entityType: AtdbSelectableEntity): EntityRow[] {
  if (entityType === 'person') return data.persons;
  if (entityType === 'family') return data.families;
  return data.places;
}

function getRow(data: ParsedAtdb, entityType: AtdbSelectableEntity, id: number): EntityRow | undefined {
  return getRows(data, entityType).find((row) => row.id === id);
}

function getOriginalValue(data: ParsedAtdb, key: AtdbDraftFieldKey): AtdbDraftFieldValue {
  if (!isAtdbSelectableEntityType(key.entityType)) {
    return undefined;
  }
  const row = getRow(data, key.entityType, key.id) as Record<string, AtdbDraftFieldValue> | undefined;
  return row?.[key.field];
}

function createDraftKey(entityType: AtdbSelectableEntity, id: number, field: AtdbFieldName): AtdbDraftFieldKey {
  return {
    entityType,
    id,
    field,
  };
}

function createMetadataKey(entityType: AtdbSelectableEntity, field: AtdbFieldName): string {
  return `${entityType}:${field}`;
}

function dedupeIds(ids: readonly number[]): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const id of ids) {
    if (!Number.isInteger(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function areBatchValuesEqual(field: AtdbFieldName, left: AtdbDraftFieldValue, right: AtdbDraftFieldValue): boolean {
  return toComparableValue(field, left) === toComparableValue(field, right);
}

function toComparableValue(field: AtdbFieldName, value: AtdbDraftFieldValue): string | number | null {
  if (field === 'gender' && (value === null || value === undefined)) {
    return 'Unknown';
  }

  return value === undefined ? null : value;
}

function compareDraftChanges(left: AtdbDraftFieldKey, right: AtdbDraftFieldKey): number {
  const leftKey = `${left.entityType}:${left.id}:${left.field}`;
  const rightKey = `${right.entityType}:${right.id}:${right.field}`;
  return leftKey.localeCompare(rightKey);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
