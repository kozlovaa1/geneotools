import type { ParsedAtdb } from '../types';
import { readAtdbDateValue, splitAtdbDate } from './dates';
import { ATDB_MAPPING } from './mapping';
import type { AtdbEntity, ValuesTable } from './mappingTypes';
import { EVENT_TYPE_IDS } from './constants';
import type { SqlJsDatabase, SqlValue } from './dbTypes';
import type { AtdbSchemaContext } from './schemaContext';
import { tableExists } from './sqlHelpers';
import {
  type AtdbBuildIssue,
  type AtdbBuildOptions,
  type AtdbBuildReport,
  type AtdbChangeSet,
  type AtdbEntityChange,
  type AtdbFieldName,
  type AtdbWritableEntity,
  createAtdbBuildReport,
  summarizeChangeSet,
  throwAtdbBuildError,
} from './rebuildContract';

export interface AtdbProtectedFingerprints {
  readonly categories: Readonly<Record<string, string>>;
}

const VALUE_TABLES: ValuesTable[] = ['ValuesStr', 'ValuesNum', 'ValuesDates', 'ValuesLinks'];
const PROTECTED_TABLES = ['Global', 'Fields', 'Recs', 'EventRoles'] as const;

const PERSON_FIELDS = new Set<AtdbFieldName>([
  'firstName',
  'lastName',
  'birthLastName',
  'patronymic',
  'gender',
  'birthDate',
  'deathDate',
  'birthPlaceId',
  'deathPlaceId',
]);

const FAMILY_FIELDS = new Set<AtdbFieldName>([
  'familyName',
  'husbandLastName',
  'wifeLastName',
  'comment',
  'color',
]);

const EVENT_FIELDS = new Set<AtdbFieldName>(['placeId']);
const PLACE_FIELDS = new Set<AtdbFieldName>(['name', 'shortName', 'comment', 'parentId']);
const WRITABLE_ENTITY_TYPES = new Set<AtdbWritableEntity>(['person', 'family', 'event', 'place']);

const FIELD_RULE_NAMES: Partial<Record<AtdbFieldName, string>> = {
  firstName: 'personFirstName',
  lastName: 'personLastName',
  birthLastName: 'personBirthLastName',
  patronymic: 'personPatronymic',
  birthDate: 'eventDate',
  deathDate: 'eventDate',
  birthPlaceId: 'eventPlaceLink',
  deathPlaceId: 'eventPlaceLink',
  placeId: 'eventPlaceLink',
  familyName: 'familyName',
  husbandLastName: 'familyHusbandLastName',
  wifeLastName: 'familyWifeLastName',
  comment: 'familyComment',
  name: 'placeName',
  shortName: 'placeShortName',
};

const STRING_FIELDS = new Set<AtdbFieldName>([
  'firstName',
  'lastName',
  'birthLastName',
  'patronymic',
  'familyName',
  'husbandLastName',
  'wifeLastName',
  'comment',
  'name',
  'shortName',
]);

const LIFE_EVENT_PLACE_LINK_FIELDS = new Set<AtdbFieldName>(['birthPlaceId', 'deathPlaceId']);
const DATE_FIELDS = new Set<AtdbFieldName>(['birthDate', 'deathDate']);
const PLACE_ID_FIELDS = new Set<AtdbFieldName>(['birthPlaceId', 'deathPlaceId', 'placeId', 'parentId']);

type Row = Record<string, SqlValue | undefined>;

function issue(code: string, message: string, details: Omit<AtdbBuildIssue, 'code' | 'message'> = {}): AtdbBuildIssue {
  return { code, message, ...details };
}

function isWritableEntityType(entityType: unknown): entityType is AtdbWritableEntity {
  return typeof entityType === 'string' && WRITABLE_ENTITY_TYPES.has(entityType as AtdbWritableEntity);
}

function tableForEntity(entityType: AtdbEntityChange['entityType']): string {
  if (entityType === 'person') return 'Persons';
  if (entityType === 'family') return 'Families';
  if (entityType === 'event') return 'Events';
  return 'Places';
}

function allowedFieldsForEntity(entityType: AtdbEntityChange['entityType']): Set<AtdbFieldName> {
  if (entityType === 'person') return PERSON_FIELDS;
  if (entityType === 'family') return FAMILY_FIELDS;
  if (entityType === 'event') return EVENT_FIELDS;
  return PLACE_FIELDS;
}

function entityTableCode(entityType: AtdbEntityChange['entityType']): number {
  if (entityType === 'person') return ATDB_MAPPING.tableCodes.persons.code;
  if (entityType === 'family') return ATDB_MAPPING.tableCodes.families.code;
  if (entityType === 'event') return ATDB_MAPPING.tableCodes.events.code;
  return ATDB_MAPPING.tableCodes.places.code;
}

function mappingEntity(entityType: AtdbEntityChange['entityType']): AtdbEntity {
  if (entityType === 'person') return 'persons';
  if (entityType === 'family') return 'families';
  if (entityType === 'event') return 'events';
  return 'places';
}

function ruleNameForField(entityType: AtdbEntityChange['entityType'], field: AtdbFieldName): string | null {
  if (entityType === 'family' && field === 'comment') return 'familyComment';
  if (entityType === 'place' && field === 'comment') return 'placeComment';
  return FIELD_RULE_NAMES[field] ?? null;
}

function countRows(db: SqlJsDatabase, tableName: string): number {
  if (!tableExists(db, tableName)) return 0;
  const value = db.exec(`SELECT COUNT(*) FROM ${tableName}`)[0]?.values[0]?.[0];
  return typeof value === 'number' ? value : 0;
}

function recordExists(db: SqlJsDatabase, tableName: string, id: number): boolean {
  if (!tableExists(db, tableName)) return false;
  const value = db.exec(`SELECT COUNT(*) FROM ${tableName} WHERE id = ?`, [id])[0]?.values[0]?.[0];
  return value === 1;
}

function placesParentColumnExists(db: SqlJsDatabase): boolean {
  const result = db.exec('PRAGMA table_info(Places)');
  const nameIndex = result[0]?.columns.indexOf('name') ?? -1;
  if (nameIndex === -1) return false;
  return result[0].values.some((row) => row[nameIndex] === 'parent_id');
}

function readPlaceParentMap(db: SqlJsDatabase): Map<number, number | null> {
  const parents = new Map<number, number | null>();
  if (!tableExists(db, 'Places')) return parents;
  const hasParentColumn = placesParentColumnExists(db);
  const result = db.exec(`SELECT id${hasParentColumn ? ', parent_id' : ''} FROM Places`);
  if (!result[0]) return parents;
  for (const values of result[0].values) {
    const id = values[0];
    const parentId = hasParentColumn ? values[1] : null;
    if (typeof id === 'number') {
      parents.set(id, typeof parentId === 'number' ? parentId : null);
    }
  }
  return parents;
}

function wouldCreatePlaceParentCycle(db: SqlJsDatabase, placeId: number, parentId: number): boolean {
  const parents = readPlaceParentMap(db);
  parents.set(placeId, parentId);
  const seen = new Set<number>();
  let current: number | null | undefined = parentId;
  let depth = 0;

  while (typeof current === 'number' && depth <= parents.size) {
    if (current === placeId || seen.has(current)) return true;
    seen.add(current);
    current = parents.get(current);
    depth++;
  }

  return false;
}

function validateCombinedPlaceParentChanges(
  db: SqlJsDatabase,
  changeSet: AtdbChangeSet,
  issues: AtdbBuildIssue[],
  logger: AtdbSchemaContext['logger'],
): void {
  if (issues.some((entry) => entry.code === 'preflight.place_parent_cycle' || entry.code === 'preflight.place_parent_self')) {
    return;
  }

  const parents = readPlaceParentMap(db);
  const changedPlaceIds: number[] = [];
  for (const entityChange of changeSet.changes) {
    if (entityChange.entityType !== 'place') continue;
    for (const fieldChange of entityChange.fields) {
      if (fieldChange.field !== 'parentId') continue;
      parents.set(entityChange.id, typeof fieldChange.value === 'number' ? fieldChange.value : null);
      changedPlaceIds.push(entityChange.id);
    }
  }

  for (const placeId of changedPlaceIds) {
    const seen = new Set<number>();
    let current = parents.get(placeId);
    let depth = 0;
    while (typeof current === 'number' && depth <= parents.size) {
      if (current === placeId || seen.has(current)) {
        issues.push(issue('preflight.place_parent_cycle', 'Родительское место создаёт цикл иерархии', {
          entityType: 'place',
          field: 'parentId',
        }));
        logger({ level: 'WARN', code: 'place.parent.cycle', details: { count: changedPlaceIds.length, depth } });
        return;
      }
      seen.add(current);
      current = parents.get(current);
      depth++;
    }
  }
}

function hasRequiredLifeEventTables(db: SqlJsDatabase): boolean {
  return tableExists(db, 'Events') && tableExists(db, 'EventDetails') && tableExists(db, 'EventRoles') && tableExists(db, 'ValuesLinks');
}

function hasRequiredLifeEventDateTables(db: SqlJsDatabase): boolean {
  return tableExists(db, 'Events') && tableExists(db, 'EventDetails') && tableExists(db, 'EventRoles') && tableExists(db, 'ValuesDates');
}

function findLifeEvent(db: SqlJsDatabase, personId: number, eventRoleId: number): number | null {
  const value = db.exec(
    'SELECT e_id FROM EventDetails WHERE p_id = ? AND er_id = ? LIMIT 1',
    [personId, eventRoleId],
  )[0]?.values[0]?.[0];
  return typeof value === 'number' ? value : null;
}

function resolveLifeEventId(
  db: SqlJsDatabase,
  context: AtdbSchemaContext,
  personId: number,
  field: AtdbFieldName,
): number | null {
  const eventTypeId = field === 'birthPlaceId' || field === 'birthDate' ? EVENT_TYPE_IDS.birth : EVENT_TYPE_IDS.death;
  const role =
    eventTypeId === EVENT_TYPE_IDS.birth
      ? context.resolveMappedEventRole('bornPerson')
      : context.resolvePrimaryEventRole(eventTypeId);
  if (!role) return null;
  return findLifeEvent(db, personId, role.id);
}

function validateFieldValue(
  db: SqlJsDatabase,
  context: AtdbSchemaContext,
  entityChange: AtdbEntityChange,
  fieldChange: { field: AtdbFieldName; value: unknown },
  issues: AtdbBuildIssue[],
): void {
  const field = fieldChange.field;
  const value = fieldChange.value;

  if (!allowedFieldsForEntity(entityChange.entityType).has(field)) {
    issues.push(issue('preflight.unsupported_field', 'Поле не входит в разрешённый набор записи', {
      entityType: entityChange.entityType,
      field,
    }));
    return;
  }

  const ruleName = ruleNameForField(entityChange.entityType, field);
  if (ruleName && !context.resolveFieldRule(ruleName, 'write')) {
    issues.push(issue('preflight.field_rule_unavailable', 'Write-safe правило поля недоступно в текущей схеме', {
      entityType: entityChange.entityType,
      field,
    }));
  }

  if (STRING_FIELDS.has(field) && value !== null && value !== undefined && typeof value !== 'string') {
    issues.push(issue('preflight.invalid_string_value', 'Строковое поле должно быть строкой, null или undefined', {
      entityType: entityChange.entityType,
      field,
    }));
  }

  if (field === 'gender' && value !== null && value !== undefined && value !== 'M' && value !== 'F' && value !== 'Unknown') {
    issues.push(issue('preflight.invalid_gender', 'Пол должен быть M, F, Unknown, null или undefined', {
      entityType: entityChange.entityType,
      field,
    }));
  }

  if (field === 'color' && value !== null && value !== undefined && (!Number.isInteger(value) || typeof value !== 'number')) {
    issues.push(issue('preflight.invalid_color', 'Цвет рода должен быть целым числом, null или undefined', {
      entityType: entityChange.entityType,
      field,
    }));
  }

  if (DATE_FIELDS.has(field)) {
    if (value !== null && value !== undefined && (typeof value !== 'string' || splitAtdbDate(value) === null)) {
      issues.push(issue('preflight.invalid_date_value', 'Дата должна использовать формат YYYY-MM-DD, YYYY-MM-00, YYYY-00-00, null или undefined', {
        entityType: entityChange.entityType,
        field,
      }));
      return;
    }

    if (!hasRequiredLifeEventDateTables(db)) {
      issues.push(issue('preflight.life_event_date_tables_missing', 'Таблицы событий недоступны для изменения даты', {
        entityType: entityChange.entityType,
        field,
      }));
      return;
    }

    const eventId = resolveLifeEventId(db, context, entityChange.id, field);
    if (eventId === null) {
      issues.push(issue('preflight.life_event_not_found', 'Событие рождения или смерти не найдено для изменения даты', {
        entityType: entityChange.entityType,
        field,
      }));
      return;
    }

    const dateRule = context.resolveFieldRule('eventDate', 'write');
    if (dateRule) {
      const currentDate = readAtdbDateValue(db, {
        fieldId: dateRule.id,
        recTable: context.tableCode('events', 'write'),
        recId: eventId,
        logger: context.logger,
      });
      if (currentDate && !currentDate.isSimple && value !== currentDate.value) {
        issues.push(issue('preflight.non_simple_date_edit', 'Неточная дата требует отдельного редактора типа даты', {
          entityType: entityChange.entityType,
          field,
        }));
      }
    }
  }

  if (!PLACE_ID_FIELDS.has(field)) {
    return;
  }

  if (value !== null && value !== undefined && (!Number.isInteger(value) || typeof value !== 'number')) {
    issues.push(issue('preflight.invalid_place_link', 'Ссылка на место должна быть целым числом, null или undefined', {
      entityType: entityChange.entityType,
      field,
    }));
    return;
  }

  if (typeof value === 'number' && !recordExists(db, 'Places', value)) {
    issues.push(issue('preflight.place_not_found', 'Целевое место не найдено в исходной базе', {
      entityType: entityChange.entityType,
      field,
    }));
  }

  if (field === 'parentId') {
    if (!placesParentColumnExists(db)) {
      issues.push(issue('preflight.place_parent_column_missing', 'Колонка Places.parent_id недоступна для изменения родительского места', {
        entityType: entityChange.entityType,
        field,
      }));
      return;
    }

    if (typeof value === 'number' && value === entityChange.id) {
      issues.push(issue('preflight.place_parent_self', 'Место не может быть своим родителем', {
        entityType: entityChange.entityType,
        field,
      }));
    }

    if (typeof value === 'number' && wouldCreatePlaceParentCycle(db, entityChange.id, value)) {
      issues.push(issue('preflight.place_parent_cycle', 'Родительское место создаёт цикл иерархии', {
        entityType: entityChange.entityType,
        field,
      }));
      context.logger({ level: 'WARN', code: 'place.parent.cycle', details: { count: 1, depth: 0 } });
    }
    return;
  }

  if (field === 'placeId') {
    if (!tableExists(db, 'ValuesLinks')) {
      issues.push(issue('preflight.event_place_tables_missing', 'Таблица ссылок недоступна для изменения места события', {
        entityType: entityChange.entityType,
        field,
      }));
    }
    return;
  }

  if (!LIFE_EVENT_PLACE_LINK_FIELDS.has(field)) {
    return;
  }

  if (!hasRequiredLifeEventTables(db)) {
    issues.push(issue('preflight.life_event_tables_missing', 'Таблицы событий недоступны для изменения ссылки на место', {
      entityType: entityChange.entityType,
      field,
    }));
    return;
  }

  if (resolveLifeEventId(db, context, entityChange.id, field) === null) {
    issues.push(issue('preflight.life_event_not_found', 'Событие рождения или смерти не найдено для изменения ссылки на место', {
      entityType: entityChange.entityType,
      field,
    }));
  }
}

export function validateAtdbChangeSetPreflight(
  db: SqlJsDatabase,
  changeSet: AtdbChangeSet,
  context: AtdbSchemaContext,
  options: AtdbBuildOptions = {},
): AtdbBuildReport {
  const issues: AtdbBuildIssue[] = [];
  const seenEntities = new Set<string>();
  const summary = summarizeChangeSet(changeSet);

  for (const entityChange of changeSet.changes) {
    if (!Number.isInteger(entityChange.id)) {
      issues.push(issue('preflight.invalid_entity_id', 'Идентификатор изменяемой записи должен быть целым числом', {
        entityType: entityChange.entityType,
      }));
      continue;
    }

    if (!isWritableEntityType(entityChange.entityType)) {
      issues.push(issue('preflight.invalid_entity_type', 'Тип изменяемой записи не входит в разрешённый набор записи', {
        entityType: String(entityChange.entityType ?? 'unknown'),
      }));
      continue;
    }

    const entityKey = `${entityChange.entityType}:${entityChange.id}`;
    if (seenEntities.has(entityKey)) {
      issues.push(issue('preflight.duplicate_entity_update', 'Набор изменений содержит повторное изменение записи', {
        entityType: entityChange.entityType,
      }));
    }
    seenEntities.add(entityKey);

    const tableName = tableForEntity(entityChange.entityType);
    if (!recordExists(db, tableName, entityChange.id)) {
      issues.push(issue('preflight.entity_not_found', 'Изменяемая запись не найдена в исходной базе', {
        entityType: entityChange.entityType,
      }));
      continue;
    }

    const seenFields = new Set<string>();
    for (const fieldChange of entityChange.fields) {
      if (seenFields.has(fieldChange.field)) {
        issues.push(issue('preflight.duplicate_field_change', 'Набор изменений содержит повторное изменение поля', {
          entityType: entityChange.entityType,
          field: fieldChange.field,
        }));
      }
      seenFields.add(fieldChange.field);
      validateFieldValue(db, context, entityChange, fieldChange, issues);
    }
  }

  validateCombinedPlaceParentChanges(db, changeSet, issues, context.logger);

  const report = createAtdbBuildReport({
    changes: summary.changes,
    issues,
    counts: {
      persons: countRows(db, 'Persons'),
      families: countRows(db, 'Families'),
      events: countRows(db, 'Events'),
      places: countRows(db, 'Places'),
    },
  });

  options.logger?.({
    level: 'DEBUG',
    code: 'rebuild.preflight.completed',
    details: {
      changes: summary.changes,
      issues: issues.length,
      persons: report.counts.persons,
      families: report.counts.families,
      events: report.counts.events,
      places: report.counts.places,
    },
  });

  for (const validationIssue of issues) {
    options.logger?.({
      level: validationIssue.code.includes('tables_missing') ? 'WARN' : 'ERROR',
      code: 'rebuild.preflight.issue',
      details: {
        reasonCode: validationIssue.code,
        entityType: validationIssue.entityType ?? 'unknown',
        field: validationIssue.field ?? 'none',
      },
    });
  }

  throwAtdbBuildError(report, options);
  return report;
}

function readRows(db: SqlJsDatabase, tableName: string): Row[] {
  if (!tableExists(db, tableName)) return [];
  const result = db.exec(`SELECT * FROM ${tableName} ORDER BY rowid`);
  if (!result[0]) return [];
  return result[0].values.map((values) =>
    Object.fromEntries(result[0].columns.map((column, index) => [column, values[index]])),
  );
}

function stableFingerprint(rows: Row[]): string {
  return JSON.stringify(
    rows
      .map((row) => Object.keys(row).sort().map((key) => [key, row[key]]))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  );
}

function valueRowKey(tableName: ValuesTable, row: Row): string {
  const target = tableName === 'ValuesLinks' ? `:${row.vlink_table ?? 'none'}` : '';
  return `${tableName}:${row.rec_table}:${row.f_id}:${row.rec_id}${target}`;
}

function ruleOwnsRow(tableName: ValuesTable, row: Row): boolean {
  for (const rule of Object.values(ATDB_MAPPING.fields)) {
    if (!rule.write || rule.confidence !== 'invariant' || rule.valueTable !== tableName) continue;
    const tableCode = ATDB_MAPPING.tableCodes[rule.entity].code;
    if (row.rec_table !== tableCode || row.f_id !== rule.id) continue;
    if (tableName !== 'ValuesLinks' || !rule.linkTarget) return true;
    if (row.vlink_table === ATDB_MAPPING.tableCodes[rule.linkTarget].code) return true;
  }

  return false;
}

function ruleNameForChange(entityChange: AtdbEntityChange, field: AtdbFieldName): string | null {
  return ruleNameForField(entityChange.entityType, field);
}

function collectTouchedOwnedValueKeys(
  db: SqlJsDatabase,
  changeSet: AtdbChangeSet,
  context: AtdbSchemaContext,
): Set<string> {
  const touched = new Set<string>();

  for (const entityChange of changeSet.changes) {
    for (const fieldChange of entityChange.fields) {
      const field = fieldChange.field;
      if (field === 'gender' || field === 'color') continue;

      if (LIFE_EVENT_PLACE_LINK_FIELDS.has(field)) {
        const rule = context.resolveFieldRule('eventPlaceLink', 'write');
        const eventId = resolveLifeEventId(db, context, entityChange.id, field);
        if (rule && eventId !== null) {
          touched.add(
            `ValuesLinks:${ATDB_MAPPING.tableCodes.events.code}:${rule.id}:${eventId}:${ATDB_MAPPING.tableCodes.places.code}`,
          );
        }
        continue;
      }

      if (DATE_FIELDS.has(field)) {
        const rule = context.resolveFieldRule('eventDate', 'write');
        const eventId = resolveLifeEventId(db, context, entityChange.id, field);
        if (rule && eventId !== null) {
          touched.add(`ValuesDates:${ATDB_MAPPING.tableCodes.events.code}:${rule.id}:${eventId}`);
        }
        continue;
      }

      if (entityChange.entityType === 'event' && field === 'placeId') {
        const rule = context.resolveFieldRule('eventPlaceLink', 'write');
        if (rule) {
          touched.add(
            `ValuesLinks:${ATDB_MAPPING.tableCodes.events.code}:${rule.id}:${entityChange.id}:${ATDB_MAPPING.tableCodes.places.code}`,
          );
        }
        continue;
      }

      const ruleName = ruleNameForChange(entityChange, field);
      const rule = ruleName ? context.resolveFieldRule(ruleName, 'write') : null;
      if (!rule) continue;
      touched.add(`${rule.valueTable}:${entityTableCode(entityChange.entityType)}:${rule.id}:${entityChange.id}`);
    }
  }

  return touched;
}

function collectValueFingerprints(db: SqlJsDatabase, touched: Set<string>): Record<string, string> {
  const unknownRows: Row[] = [];
  const unchangedOwnedRows: Row[] = [];

  for (const tableName of VALUE_TABLES) {
    for (const row of readRows(db, tableName)) {
      const ownsRow = ruleOwnsRow(tableName, row);
      const rowKey = valueRowKey(tableName, row);
      if (!ownsRow) {
        unknownRows.push({ tableName, ...row });
      } else if (!touched.has(rowKey)) {
        unchangedOwnedRows.push({ tableName, ...row });
      }
    }
  }

  return {
    unknownValues: stableFingerprint(unknownRows),
    unchangedOwnedValues: stableFingerprint(unchangedOwnedRows),
  };
}

export function collectProtectedFingerprints(
  db: SqlJsDatabase,
  changeSet: AtdbChangeSet,
  context: AtdbSchemaContext,
): AtdbProtectedFingerprints {
  const touched = collectTouchedOwnedValueKeys(db, changeSet, context);
  const categories: Record<string, string> = {};

  for (const tableName of PROTECTED_TABLES) {
    categories[tableName] = stableFingerprint(readRows(db, tableName));
  }

  Object.assign(categories, collectValueFingerprints(db, touched));
  return { categories };
}

function runIntegrityCheck(db: SqlJsDatabase): boolean {
  const value = db.exec('PRAGMA integrity_check')[0]?.values[0]?.[0];
  return value === 'ok';
}

function indexById<T extends { id: number }>(rows: T[]): Map<number, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

function expectedValueMatches(field: AtdbFieldName, actual: unknown, expected: unknown): boolean {
  if (field === 'gender' && (expected === null || expected === undefined)) {
    return actual === 'Unknown';
  }

  if (expected === null || expected === undefined) {
    return actual === null || actual === undefined;
  }

  return actual === expected;
}

function entityMap(parsed: ParsedAtdb, entityType: AtdbEntityChange['entityType']): Map<number, { id: number }> {
  if (entityType === 'person') return indexById(parsed.persons);
  if (entityType === 'family') return indexById(parsed.families);
  if (entityType === 'event') return indexById(parsed.events);
  return indexById(parsed.places);
}

function verifyAppliedChanges(parsed: ParsedAtdb, changeSet: AtdbChangeSet, issues: AtdbBuildIssue[]): void {
  for (const entityChange of changeSet.changes) {
    const rebuiltEntity = entityMap(parsed, entityChange.entityType).get(entityChange.id) as Record<string, unknown> | undefined;
    if (!rebuiltEntity) {
      issues.push(issue('postbuild.changed_entity_missing', 'Изменённая запись отсутствует после повторного чтения', {
        entityType: entityChange.entityType,
      }));
      continue;
    }

    for (const fieldChange of entityChange.fields) {
      if (!expectedValueMatches(fieldChange.field, rebuiltEntity[fieldChange.field], fieldChange.value)) {
        issues.push(issue('postbuild.change_not_visible', 'Поддержанное изменение не подтверждено повторным чтением', {
          entityType: entityChange.entityType,
          field: fieldChange.field,
        }));
      }
    }
  }
}

function verifyCounts(original: ParsedAtdb, rebuilt: ParsedAtdb, issues: AtdbBuildIssue[]): void {
  const countPairs = [
    ['persons', original.persons.length, rebuilt.persons.length],
    ['families', original.families.length, rebuilt.families.length],
    ['events', original.events.length, rebuilt.events.length],
    ['places', original.places.length, rebuilt.places.length],
  ] as const;

  for (const [entityType, before, after] of countPairs) {
    if (before !== after) {
      issues.push(issue('postbuild.count_drift', 'Количество записей изменилось после сборки', {
        entityType,
        count: Math.abs(before - after),
      }));
    }
  }
}

function verifyProtectedFingerprints(
  before: AtdbProtectedFingerprints,
  after: AtdbProtectedFingerprints,
  issues: AtdbBuildIssue[],
): void {
  for (const [category, beforeFingerprint] of Object.entries(before.categories)) {
    if (after.categories[category] !== beforeFingerprint) {
      issues.push(issue('postbuild.protected_fingerprint_changed', 'Защищённая часть базы изменилась после сборки', {
        entityType: category,
      }));
    }
  }
}

export function validateAtdbPostBuild(
  db: SqlJsDatabase,
  original: ParsedAtdb,
  rebuilt: ParsedAtdb,
  changeSet: AtdbChangeSet,
  beforeFingerprints: AtdbProtectedFingerprints,
  context: AtdbSchemaContext,
  options: AtdbBuildOptions = {},
): AtdbBuildReport {
  const issues: AtdbBuildIssue[] = [];
  const summary = summarizeChangeSet(changeSet);

  if (!runIntegrityCheck(db)) {
    issues.push(issue('postbuild.integrity_check_failed', 'SQLite integrity_check вернул ошибку'));
  }

  verifyCounts(original, rebuilt, issues);
  verifyAppliedChanges(rebuilt, changeSet, issues);
  verifyProtectedFingerprints(beforeFingerprints, collectProtectedFingerprints(db, changeSet, context), issues);

  const report = createAtdbBuildReport({
    changes: summary.changes,
    issues,
    counts: {
      persons: rebuilt.persons.length,
      families: rebuilt.families.length,
      events: rebuilt.events.length,
      places: rebuilt.places.length,
    },
  });

  options.logger?.({
    level: 'DEBUG',
    code: 'rebuild.postbuild.completed',
    details: {
      integrityOk: !issues.some((postIssue) => postIssue.code === 'postbuild.integrity_check_failed'),
      changes: summary.changes,
      issues: issues.length,
      persons: rebuilt.persons.length,
      families: rebuilt.families.length,
      events: rebuilt.events.length,
      places: rebuilt.places.length,
    },
  });

  for (const validationIssue of issues) {
    options.logger?.({
      level: validationIssue.code.includes('fingerprint') ? 'WARN' : 'ERROR',
      code: 'rebuild.postbuild.issue',
      details: {
        reasonCode: validationIssue.code,
        entityType: validationIssue.entityType ?? 'unknown',
        field: validationIssue.field ?? 'none',
      },
    });
  }

  throwAtdbBuildError(report, options);
  return report;
}

export function ensureCoreTableCompatibility(
  db: SqlJsDatabase,
  changeSet: AtdbChangeSet,
): AtdbBuildIssue[] {
  const issues: AtdbBuildIssue[] = [];
  for (const entityChange of changeSet.changes) {
    const tableName = tableForEntity(entityChange.entityType);
    if (!tableExists(db, tableName)) {
      issues.push(issue('preflight.required_table_missing', 'Обязательная таблица отсутствует для запрошенной записи', {
        entityType: mappingEntity(entityChange.entityType),
      }));
    }
  }
  return issues;
}
