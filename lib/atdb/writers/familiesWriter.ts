import type { Family, Person } from '../../types';
import type { SqlJsDatabase } from '../dbTypes';
import type { AtdbSchemaContext } from '../schemaContext';
import { replaceOwnedValue } from './valueWriter';

export function deriveFamiliesFromSpouseRelationships(_persons: Person[], _families: Family[]): void {
  void _persons;
  void _families;
  // Family creation is intentionally outside the write-safe mapping contract.
}

export function writeFamilies(db: SqlJsDatabase, families: Family[], context: AtdbSchemaContext): void {
  const recTable = context.tableCode('families', 'write');
  const fields = [
    ['familyName', (family: Family) => family.familyName],
    ['familyHusbandLastName', (family: Family) => family.husbandLastName],
    ['familyWifeLastName', (family: Family) => family.wifeLastName],
    ['familyComment', (family: Family) => family.comment],
  ] as const;
  for (const family of families) {
    if (typeof family.color === 'number') db.run('UPDATE Families SET color = ? WHERE id = ?', [family.color, family.id]);
    for (const [ruleName, readValue] of fields) {
      const rule = context.resolveFieldRule(ruleName, 'write');
      if (rule) replaceOwnedValue(db, rule, recTable, family.id, readValue(family) ? [readValue(family) ?? null] : null, context.logger);
    }
  }
  context.logger({ level: 'DEBUG', code: 'families.write', details: { count: families.length } });
}
