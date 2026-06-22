import type { Family, Person } from '../../types';
import type { AtdbChangeSet, AtdbFamilyField } from '../rebuildContract';
import type { SqlJsDatabase, SqlParameter } from '../dbTypes';
import type { AtdbSchemaContext } from '../schemaContext';
import { replaceOwnedValue } from './valueWriter';

const FAMILY_STRING_RULES: Partial<Record<AtdbFamilyField, string>> = {
  familyName: 'familyName',
  husbandLastName: 'familyHusbandLastName',
  wifeLastName: 'familyWifeLastName',
  comment: 'familyComment',
};

function stringValue(value: unknown): SqlParameter[] | null {
  return typeof value === 'string' ? [value] : null;
}

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

export function writeFamilyChanges(db: SqlJsDatabase, changeSet: AtdbChangeSet, context: AtdbSchemaContext): void {
  const recTable = context.tableCode('families', 'write');
  let applied = 0;

  for (const entityChange of changeSet.changes) {
    if (entityChange.entityType !== 'family') continue;

    for (const fieldChange of entityChange.fields) {
      if (fieldChange.field === 'color') {
        db.run('UPDATE Families SET color = ? WHERE id = ?', [
          typeof fieldChange.value === 'number' ? fieldChange.value : null,
          entityChange.id,
        ]);
        applied++;
        continue;
      }

      const ruleName = FAMILY_STRING_RULES[fieldChange.field as AtdbFamilyField];
      const rule = ruleName ? context.resolveFieldRule(ruleName, 'write') : null;
      if (rule) {
        replaceOwnedValue(db, rule, recTable, entityChange.id, stringValue(fieldChange.value), context.logger);
        applied++;
      }
    }
  }

  context.logger({ level: 'DEBUG', code: 'rebuild.families.applied', details: { changes: applied } });
}
