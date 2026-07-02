import type {
  AtdbChangeSet,
  AtdbEntityChange,
  AtdbEventField,
  AtdbFamilyField,
  AtdbFieldName,
  AtdbFieldChange,
  AtdbFieldValue,
  AtdbPersonField,
  AtdbPlaceField,
  AtdbWritableEntity,
  ParsedAtdb,
} from './sqlProcessor';

export type AtdbSelectableEntity = Exclude<AtdbWritableEntity, 'event'>;

export const ATDB_EDITABLE_PERSON_FIELDS = [
  'firstName',
  'lastName',
  'birthLastName',
  'patronymic',
  'gender',
  'birthDate',
  'deathDate',
  'birthPlaceId',
  'deathPlaceId',
] as const satisfies readonly AtdbPersonField[];

export const ATDB_EDITABLE_FAMILY_FIELDS = [
  'familyName',
  'husbandLastName',
  'wifeLastName',
  'comment',
  'color',
] as const satisfies readonly AtdbFamilyField[];

export const ATDB_EDITABLE_PLACE_FIELDS = [
  'name',
  'shortName',
  'comment',
  'parentId',
] as const satisfies readonly AtdbPlaceField[];

export const ATDB_EDITABLE_EVENT_FIELDS = [
  'placeId',
] as const satisfies readonly AtdbEventField[];

export const ATDB_EDITABLE_FIELDS = {
  person: ATDB_EDITABLE_PERSON_FIELDS,
  family: ATDB_EDITABLE_FAMILY_FIELDS,
  event: ATDB_EDITABLE_EVENT_FIELDS,
  place: ATDB_EDITABLE_PLACE_FIELDS,
} as const satisfies Record<AtdbWritableEntity, readonly AtdbFieldName[]>;

export const ATDB_GENDER_VALUES = ['M', 'F', 'Unknown'] as const;

export type AtdbEditableGender = (typeof ATDB_GENDER_VALUES)[number];
export type AtdbEditableFieldMap = typeof ATDB_EDITABLE_FIELDS;
export type AtdbEditableField<EntityType extends AtdbWritableEntity> = AtdbEditableFieldMap[EntityType][number];
export type AtdbDraftFieldValue = AtdbFieldValue;

export interface AtdbDraftFieldKey {
  entityType: AtdbWritableEntity;
  id: number;
  field: AtdbFieldName;
}

export interface AtdbDraftFieldChange extends AtdbDraftFieldKey {
  value: AtdbDraftFieldValue;
}

export interface AtdbEditDraftState {
  changes: Record<string, AtdbDraftFieldChange>;
}

export interface AtdbDraftChangeCount {
  entities: number;
  fields: number;
}

type ComparableDraftValue = string | number | null;
type OriginalFieldResult =
  | {
      found: true;
      value: AtdbDraftFieldValue;
    }
  | {
      found: false;
    };

const FIELD_SORT_ORDER = new Map<string, number>(
  Object.values(ATDB_EDITABLE_FIELDS)
    .flat()
    .map((field, index) => [field, index]),
);

const ENTITY_SORT_ORDER: Record<AtdbWritableEntity, number> = {
  person: 0,
  family: 1,
  event: 2,
  place: 3,
};

export function isAtdbEditableEntityType(entityType: unknown): entityType is AtdbWritableEntity {
  return entityType === 'person' || entityType === 'family' || entityType === 'event' || entityType === 'place';
}

export function isAtdbSelectableEntityType(entityType: unknown): entityType is AtdbSelectableEntity {
  return entityType === 'person' || entityType === 'family' || entityType === 'place';
}

export function isAtdbEditableField(
  entityType: AtdbWritableEntity,
  field: unknown,
): field is AtdbEditableField<typeof entityType> {
  return typeof field === 'string' && (ATDB_EDITABLE_FIELDS[entityType] as readonly string[]).includes(field);
}

export function isAtdbEditableGender(value: unknown): value is AtdbEditableGender {
  return value === 'M' || value === 'F' || value === 'Unknown';
}

export function isAtdbDraftFieldValue(field: AtdbFieldName, value: unknown): value is AtdbDraftFieldValue {
  if (value === null || value === undefined) {
    return true;
  }

  if (field === 'gender') {
    return isAtdbEditableGender(value);
  }

  if (field === 'color' || field === 'birthPlaceId' || field === 'deathPlaceId' || field === 'placeId' || field === 'parentId') {
    return typeof value === 'number' && Number.isInteger(value);
  }

  return typeof value === 'string';
}

export function createEmptyAtdbEditDraft(): AtdbEditDraftState {
  return { changes: {} };
}

export function clearDraft(): AtdbEditDraftState {
  return createEmptyAtdbEditDraft();
}

export function setDraftField(
  draft: AtdbEditDraftState,
  data: ParsedAtdb,
  key: AtdbDraftFieldKey,
  value: unknown,
): AtdbEditDraftState {
  const original = getOriginalField(data, key);
  const normalizedValue = normalizeAtdbDraftValue(key.field, value);

  if (!original.found || normalizedValue === undefined || !isSupportedDraftKey(key)) {
    return draft;
  }

  const draftKey = createDraftKey(key);
  if (areDraftValuesEqual(key.field, original.value, normalizedValue)) {
    return resetDraftField(draft, key);
  }

  const current = draft.changes[draftKey];
  if (current && current.value === normalizedValue) {
    return draft;
  }

  return {
    changes: {
      ...draft.changes,
      [draftKey]: {
        ...key,
        value: normalizedValue,
      },
    },
  };
}

export function resetDraftField(draft: AtdbEditDraftState, key: AtdbDraftFieldKey): AtdbEditDraftState {
  const draftKey = createDraftKey(key);
  if (!Object.prototype.hasOwnProperty.call(draft.changes, draftKey)) {
    return draft;
  }

  const { [draftKey]: _removed, ...changes } = draft.changes;
  void _removed;
  return { changes };
}

export function resetDraftEntity(
  draft: AtdbEditDraftState,
  entityType: AtdbWritableEntity,
  id: number,
): AtdbEditDraftState {
  const changes = Object.fromEntries(
    Object.entries(draft.changes).filter(([, change]) => change.entityType !== entityType || change.id !== id),
  );

  if (Object.keys(changes).length === Object.keys(draft.changes).length) {
    return draft;
  }

  return { changes };
}

export function getDraftValue(
  draft: AtdbEditDraftState,
  data: ParsedAtdb,
  key: AtdbDraftFieldKey,
): AtdbDraftFieldValue {
  const change = draft.changes[createDraftKey(key)];
  if (change) {
    return change.value;
  }

  const original = getOriginalField(data, key);
  return original.found ? original.value : undefined;
}

export function isFieldDirty(
  draft: AtdbEditDraftState,
  data: ParsedAtdb,
  key: AtdbDraftFieldKey,
): boolean {
  const change = draft.changes[createDraftKey(key)];
  if (!change) {
    return false;
  }

  const original = getOriginalField(data, key);
  return original.found && !areDraftValuesEqual(key.field, original.value, change.value);
}

export function buildAtdbChangeSet(data: ParsedAtdb, draft: AtdbEditDraftState): AtdbChangeSet {
  const groupedChanges = new Map<string, AtdbEntityChange>();

  for (const change of Object.values(draft.changes)) {
    if (!isSupportedDraftKey(change) || !isAtdbDraftFieldValue(change.field, change.value)) {
      continue;
    }

    const original = getOriginalField(data, change);
    if (!original.found || areDraftValuesEqual(change.field, original.value, change.value)) {
      continue;
    }

    const entityKey = `${change.entityType}:${change.id}`;
    const entityChange = groupedChanges.get(entityKey) ?? {
      entityType: change.entityType,
      id: change.id,
      fields: [],
    };

    entityChange.fields.push({
      field: change.field,
      value: normalizeAtdbDraftValue(change.field, change.value),
    } as AtdbFieldChange);
    groupedChanges.set(entityKey, entityChange);
  }

  const changes = Array.from(groupedChanges.values())
    .map((entityChange) => ({
      ...entityChange,
      fields: entityChange.fields.toSorted(compareFieldChanges),
    }))
    .filter((entityChange) => entityChange.fields.length > 0)
    .toSorted(compareEntityChanges);

  return { changes };
}

export function countDraftChanges(data: ParsedAtdb, draft: AtdbEditDraftState): AtdbDraftChangeCount {
  const changeSet = buildAtdbChangeSet(data, draft);
  return {
    entities: changeSet.changes.length,
    fields: changeSet.changes.reduce((total, change) => total + change.fields.length, 0),
  };
}

function isSupportedDraftKey(key: AtdbDraftFieldKey): boolean {
  return Number.isInteger(key.id) && isAtdbEditableEntityType(key.entityType) && isAtdbEditableField(key.entityType, key.field);
}

function createDraftKey(key: AtdbDraftFieldKey): string {
  return `${key.entityType}:${key.id}:${key.field}`;
}

function normalizeAtdbDraftValue(field: AtdbFieldName, value: unknown): AtdbDraftFieldValue | undefined {
  if (value === null || value === undefined) {
    return null;
  }

  if (field === 'gender') {
    return isAtdbEditableGender(value) ? value : undefined;
  }

  if (field === 'color' || field === 'birthPlaceId' || field === 'deathPlaceId' || field === 'placeId' || field === 'parentId') {
    return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
  }

  return typeof value === 'string' ? value : undefined;
}

function getOriginalField(
  data: ParsedAtdb,
  key: AtdbDraftFieldKey,
): OriginalFieldResult {
  if (!isSupportedDraftKey(key)) {
    return { found: false };
  }

  if (key.entityType === 'person') {
    const person = data.persons.find((row) => row.id === key.id);
    return person ? { found: true, value: person[key.field as AtdbPersonField] } : { found: false };
  }

  if (key.entityType === 'family') {
    const family = data.families.find((row) => row.id === key.id);
    return family ? { found: true, value: family[key.field as AtdbFamilyField] } : { found: false };
  }

  if (key.entityType === 'event') {
    const event = data.events.find((row) => row.id === key.id);
    return event ? { found: true, value: event[key.field as AtdbEventField] } : { found: false };
  }

  const place = data.places.find((row) => row.id === key.id);
  return place ? { found: true, value: place[key.field as AtdbPlaceField] } : { found: false };
}

function areDraftValuesEqual(field: AtdbFieldName, left: AtdbDraftFieldValue, right: AtdbDraftFieldValue): boolean {
  return toComparableDraftValue(field, left) === toComparableDraftValue(field, right);
}

function toComparableDraftValue(field: AtdbFieldName, value: AtdbDraftFieldValue): ComparableDraftValue {
  if (field === 'gender' && (value === null || value === undefined)) {
    return 'Unknown';
  }

  return value === undefined ? null : value;
}

function compareEntityChanges(left: AtdbEntityChange, right: AtdbEntityChange): number {
  const entityOrder = ENTITY_SORT_ORDER[left.entityType] - ENTITY_SORT_ORDER[right.entityType];
  if (entityOrder !== 0) return entityOrder;
  return left.id - right.id;
}

function compareFieldChanges(left: AtdbFieldChange, right: AtdbFieldChange): number {
  const leftOrder = FIELD_SORT_ORDER.get(left.field) ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = FIELD_SORT_ORDER.get(right.field) ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return left.field.localeCompare(right.field);
}
