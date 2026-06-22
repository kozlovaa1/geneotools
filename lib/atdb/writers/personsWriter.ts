import type { Person } from '../../types';
import type { AtdbChangeSet, AtdbPersonField } from '../rebuildContract';
import type { SqlJsDatabase, SqlParameter } from '../dbTypes';
import type { AtdbSchemaContext } from '../schemaContext';
import { replaceOwnedValue } from './valueWriter';

const PERSON_STRING_RULES: Partial<Record<AtdbPersonField, string>> = {
  firstName: 'personFirstName',
  lastName: 'personLastName',
  patronymic: 'personPatronymic',
};

function stringValue(value: unknown): SqlParameter[] | null {
  return typeof value === 'string' ? [value] : null;
}

function genderValue(value: unknown): number {
  if (value === 'M') return 1;
  if (value === 'F') return 2;
  return 0;
}

export function writePersons(db: SqlJsDatabase, persons: Person[], context: AtdbSchemaContext): void {
  const recTable = context.tableCode('persons', 'write');
  const fields = [
    ['personFirstName', (person: Person) => person.firstName],
    ['personLastName', (person: Person) => person.lastName],
    ['personPatronymic', (person: Person) => person.patronymic],
  ] as const;
  for (const person of persons) {
    const sexValue = person.gender === 'M' ? 1 : person.gender === 'F' ? 2 : 0;
    db.run('UPDATE Persons SET sex = ? WHERE id = ?', [sexValue, person.id]);
    for (const [ruleName, readValue] of fields) {
      const rule = context.resolveFieldRule(ruleName, 'write');
      if (rule) replaceOwnedValue(db, rule, recTable, person.id, readValue(person) ? [readValue(person) ?? null] : null, context.logger);
    }
  }
  context.logger({ level: 'DEBUG', code: 'persons.write', details: { count: persons.length } });
}

export function writePersonChanges(db: SqlJsDatabase, changeSet: AtdbChangeSet, context: AtdbSchemaContext): void {
  const recTable = context.tableCode('persons', 'write');
  let applied = 0;

  for (const entityChange of changeSet.changes) {
    if (entityChange.entityType !== 'person') continue;

    for (const fieldChange of entityChange.fields) {
      if (fieldChange.field === 'birthPlaceId' || fieldChange.field === 'deathPlaceId') continue;

      if (fieldChange.field === 'gender') {
        db.run('UPDATE Persons SET sex = ? WHERE id = ?', [genderValue(fieldChange.value), entityChange.id]);
        applied++;
        continue;
      }

      const ruleName = PERSON_STRING_RULES[fieldChange.field as AtdbPersonField];
      const rule = ruleName ? context.resolveFieldRule(ruleName, 'write') : null;
      if (rule) {
        replaceOwnedValue(db, rule, recTable, entityChange.id, stringValue(fieldChange.value), context.logger);
        applied++;
      }
    }
  }

  context.logger({ level: 'DEBUG', code: 'rebuild.persons.applied', details: { changes: applied } });
}
