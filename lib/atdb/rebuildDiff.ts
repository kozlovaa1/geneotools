import type { Event, Family, ParsedAtdb, Person, Place } from '../types';
import {
  type AtdbBuildOptions,
  type AtdbBuildIssue,
  type AtdbChangeSet,
  type AtdbEntityChange,
  type AtdbEventField,
  type AtdbFamilyField,
  type AtdbFieldName,
  type AtdbFieldValue,
  type AtdbPersonField,
  type AtdbPlaceField,
  createAtdbBuildReport,
  summarizeChangeSet,
  throwAtdbBuildError,
} from './rebuildContract';

export interface AtdbCompatibilityDiff {
  changeSet: AtdbChangeSet;
  report: ReturnType<typeof createAtdbBuildReport>;
}

const PERSON_FIELDS: AtdbPersonField[] = [
  'firstName',
  'lastName',
  'birthLastName',
  'patronymic',
  'gender',
  'birthDate',
  'deathDate',
  'birthPlaceId',
  'deathPlaceId',
];

const FAMILY_FIELDS: AtdbFamilyField[] = [
  'familyName',
  'husbandLastName',
  'wifeLastName',
  'comment',
  'color',
];

const PLACE_FIELDS: AtdbPlaceField[] = ['name', 'shortName', 'comment', 'parentId'];
const EVENT_FIELDS: AtdbEventField[] = ['placeId'];

const PERSON_UNSUPPORTED_FIELDS = [
  'birthPlace',
  'deathPlace',
  'notes',
  'fatherId',
  'motherId',
  'spouseIds',
  'occupation',
] as const;

const FAMILY_UNSUPPORTED_FIELDS = [
  'husbandId',
  'wifeId',
  'childrenIds',
  'marriedDate',
  'divorcedDate',
  'notes',
] as const;

const EVENT_UNSUPPORTED_FIELDS = [
  'eventType',
  'date',
  'place',
  'description',
  'personIds',
] as const;

const PLACE_UNSUPPORTED_FIELDS = [
  'parentPath',
  'placeNamingDate',
] as const;

function normalizeValue(value: unknown): unknown {
  return value === undefined ? null : value;
}

function normalizeArray(value: unknown): number[] {
  return Array.isArray(value) ? value : [];
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(normalizeArray(left)) === JSON.stringify(normalizeArray(right));
  }

  return normalizeValue(left) === normalizeValue(right);
}

function changeValue(value: unknown): AtdbFieldValue {
  return value === undefined ? null : (value as AtdbFieldValue);
}

function mapById<T extends { id: number }>(
  rows: T[],
  entityType: string,
  issues: AtdbBuildIssue[],
): Map<number, T> {
  const result = new Map<number, T>();
  const duplicates = new Set<number>();

  for (const row of rows) {
    if (!Number.isInteger(row.id)) {
      issues.push({
        code: 'diff.invalid_entity_id',
        message: 'Некорректный идентификатор записи в модели',
        entityType,
      });
      continue;
    }

    if (result.has(row.id)) {
      duplicates.add(row.id);
      continue;
    }

    result.set(row.id, row);
  }

  if (duplicates.size > 0) {
    issues.push({
      code: 'diff.duplicate_entity_id',
      message: 'Модель содержит повторяющиеся идентификаторы записей',
      entityType,
      count: duplicates.size,
    });
  }

  return result;
}

function addCollectionIssues<T extends { id: number }>(
  entityType: string,
  originalRows: T[],
  targetRows: T[],
  originalById: Map<number, T>,
  targetById: Map<number, T>,
  issues: AtdbBuildIssue[],
): void {
  if (originalRows.length !== targetRows.length) {
    issues.push({
      code: 'diff.entity_count_changed',
      message: 'Количество записей изменилось, а создание и удаление пока запрещены',
      entityType,
      count: Math.abs(originalRows.length - targetRows.length),
    });
  }

  for (const id of originalById.keys()) {
    if (!targetById.has(id)) {
      issues.push({
        code: 'diff.entity_missing',
        message: 'Запись удалена из модели, удаление пока запрещено',
        entityType,
      });
    }
  }

  for (const id of targetById.keys()) {
    if (!originalById.has(id)) {
      issues.push({
        code: 'diff.entity_created',
        message: 'В модели появилась новая запись, создание пока запрещено',
        entityType,
      });
    }
  }
}

function addUnsupportedIssue(entityType: string, field: string, issues: AtdbBuildIssue[]): void {
  issues.push({
    code: field === 'eventType' ? 'diff.event_type_changed' : 'diff.unsupported_field_changed',
    message: 'Изменено поле, которое не входит в безопасный набор обратной сборки',
    entityType,
    field,
  });
}

function diffSupportedFields<T extends { id: number }, FieldName extends AtdbFieldName>(
  entityType: AtdbEntityChange['entityType'],
  original: T,
  target: T,
  fields: readonly FieldName[],
): { entityChange: AtdbEntityChange | null; noopChanges: number } {
  const fieldChanges = [];
  let noopChanges = 0;

  for (const field of fields) {
    const originalValue = (original as Record<string, unknown>)[field];
    const targetValue = (target as Record<string, unknown>)[field];
    if (valuesEqual(originalValue, targetValue)) {
      noopChanges++;
      continue;
    }

    fieldChanges.push({ field, value: changeValue(targetValue) });
  }

  return {
    entityChange: fieldChanges.length > 0 ? { entityType, id: target.id, fields: fieldChanges } : null,
    noopChanges,
  };
}

function checkUnsupportedFields<T extends { id: number }>(
  entityType: string,
  original: T,
  target: T,
  fields: readonly string[],
  issues: AtdbBuildIssue[],
): void {
  for (const field of fields) {
    const originalValue = (original as Record<string, unknown>)[field];
    const targetValue = (target as Record<string, unknown>)[field];
    if (!valuesEqual(originalValue, targetValue)) {
      addUnsupportedIssue(entityType, field, issues);
    }
  }
}

function checkMetadata(original: ParsedAtdb, target: ParsedAtdb, issues: AtdbBuildIssue[]): void {
  const metadataFields = ['version', 'guid', 'sourceGuid', 'mainLanguage', 'parameters'] as const;
  for (const field of metadataFields) {
    if (!valuesEqual(original.metadata?.[field], target.metadata?.[field])) {
      issues.push({
        code: 'diff.metadata_changed',
        message: 'Изменение metadata/Global запрещено в strict rebuild',
        entityType: 'metadata',
        field,
      });
    }
  }
}

function diffPersons(
  original: Person[],
  target: Person[],
  issues: AtdbBuildIssue[],
): { changes: AtdbEntityChange[]; noopChanges: number } {
  const changes: AtdbEntityChange[] = [];
  let noopChanges = 0;
  const originalById = mapById(original, 'person', issues);
  const targetById = mapById(target, 'person', issues);
  addCollectionIssues('person', original, target, originalById, targetById, issues);

  for (const [id, originalPerson] of originalById) {
    const targetPerson = targetById.get(id);
    if (!targetPerson) continue;

    const diff = diffSupportedFields('person', originalPerson, targetPerson, PERSON_FIELDS);
    if (diff.entityChange) changes.push(diff.entityChange);
    noopChanges += diff.noopChanges;
    checkUnsupportedFields('person', originalPerson, targetPerson, PERSON_UNSUPPORTED_FIELDS, issues);
  }

  return { changes, noopChanges };
}

function diffFamilies(
  original: Family[],
  target: Family[],
  issues: AtdbBuildIssue[],
): { changes: AtdbEntityChange[]; noopChanges: number } {
  const changes: AtdbEntityChange[] = [];
  let noopChanges = 0;
  const originalById = mapById(original, 'family', issues);
  const targetById = mapById(target, 'family', issues);
  addCollectionIssues('family', original, target, originalById, targetById, issues);

  for (const [id, originalFamily] of originalById) {
    const targetFamily = targetById.get(id);
    if (!targetFamily) continue;

    const diff = diffSupportedFields('family', originalFamily, targetFamily, FAMILY_FIELDS);
    if (diff.entityChange) changes.push(diff.entityChange);
    noopChanges += diff.noopChanges;
    checkUnsupportedFields('family', originalFamily, targetFamily, FAMILY_UNSUPPORTED_FIELDS, issues);
  }

  return { changes, noopChanges };
}

function diffPlaces(
  original: Place[],
  target: Place[],
  issues: AtdbBuildIssue[],
): { changes: AtdbEntityChange[]; noopChanges: number } {
  const changes: AtdbEntityChange[] = [];
  let noopChanges = 0;
  const originalById = mapById(original, 'place', issues);
  const targetById = mapById(target, 'place', issues);
  addCollectionIssues('place', original, target, originalById, targetById, issues);

  for (const [id, originalPlace] of originalById) {
    const targetPlace = targetById.get(id);
    if (!targetPlace) continue;

    const diff = diffSupportedFields('place', originalPlace, targetPlace, PLACE_FIELDS);
    if (diff.entityChange) changes.push(diff.entityChange);
    noopChanges += diff.noopChanges;
    checkUnsupportedFields('place', originalPlace, targetPlace, PLACE_UNSUPPORTED_FIELDS, issues);
  }

  return { changes, noopChanges };
}

function diffEvents(
  original: Event[],
  target: Event[],
  issues: AtdbBuildIssue[],
): { changes: AtdbEntityChange[]; noopChanges: number } {
  const changes: AtdbEntityChange[] = [];
  let noopChanges = 0;
  const originalById = mapById(original, 'event', issues);
  const targetById = mapById(target, 'event', issues);
  addCollectionIssues('event', original, target, originalById, targetById, issues);

  for (const [id, originalEvent] of originalById) {
    const targetEvent = targetById.get(id);
    if (!targetEvent) continue;
    const diff = diffSupportedFields('event', originalEvent, targetEvent, EVENT_FIELDS);
    if (diff.entityChange) changes.push(diff.entityChange);
    noopChanges += diff.noopChanges;
    checkUnsupportedFields('event', originalEvent, targetEvent, EVENT_UNSUPPORTED_FIELDS, issues);
  }

  return { changes, noopChanges };
}

export function createCompatibilityChangeSet(
  target: ParsedAtdb,
  original: ParsedAtdb,
  options: AtdbBuildOptions = {},
): AtdbCompatibilityDiff {
  const issues: AtdbBuildIssue[] = [];
  const changes: AtdbEntityChange[] = [];
  let noopChanges = 0;

  checkMetadata(original, target, issues);

  const personDiff = diffPersons(original.persons, target.persons, issues);
  changes.push(...personDiff.changes);
  noopChanges += personDiff.noopChanges;

  const familyDiff = diffFamilies(original.families, target.families, issues);
  changes.push(...familyDiff.changes);
  noopChanges += familyDiff.noopChanges;

  const eventDiff = diffEvents(original.events, target.events, issues);
  changes.push(...eventDiff.changes);
  noopChanges += eventDiff.noopChanges;

  const placeDiff = diffPlaces(original.places, target.places, issues);
  changes.push(...placeDiff.changes);
  noopChanges += placeDiff.noopChanges;

  const changeSet = { changes };
  const summary = summarizeChangeSet(changeSet);
  const report = createAtdbBuildReport({
    changes: summary.changes,
    noopChanges,
    issues,
    counts: {
      persons: target.persons.length,
      families: target.families.length,
      events: target.events.length,
      places: target.places.length,
    },
  });

  options.logger?.({
    level: 'DEBUG',
    code: 'rebuild.diff.completed',
    details: {
      persons: target.persons.length,
      families: target.families.length,
      events: target.events.length,
      places: target.places.length,
      changes: summary.changes,
      noopChanges,
    },
  });

  for (const issue of issues) {
    const level = issue.code.startsWith('diff.unsupported') || issue.code === 'diff.event_type_changed' ? 'WARN' : 'ERROR';
    options.logger?.({
      level,
      code: 'rebuild.diff.issue',
      details: {
        reasonCode: issue.code,
        entityType: issue.entityType ?? 'unknown',
        field: issue.field ?? 'none',
      },
    });
  }

  throwAtdbBuildError(report, options);
  return { changeSet, report };
}
