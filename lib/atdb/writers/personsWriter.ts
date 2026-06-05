import type { Person } from '../../types';
import type { SqlJsDatabase } from '../dbTypes';
import type { AtdbSchemaContext } from '../schemaContext';
import { replaceOwnedValue } from './valueWriter';

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
