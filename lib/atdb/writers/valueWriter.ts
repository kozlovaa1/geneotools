import type { SqlParameter, SqlJsDatabase } from '../dbTypes';
import type { AtdbDiagnosticLogger } from '../diagnostics';
import { silentAtdbLogger } from '../diagnostics';
import type { FieldRule, ValuesTable } from '../mappingTypes';

const INSERT_COLUMNS: Record<ValuesTable, string> = {
  ValuesStr: 'vstr',
  ValuesNum: 'vnum',
  ValuesDates: 'y, m, d',
  ValuesLinks: 'vlink_table, vlink_id',
};

function valuesMatch(existing: SqlParameter[], values: SqlParameter[]): boolean {
  return existing.length === values.length && existing.every((value, index) => value === values[index]);
}

function readOwnedValues(
  db: SqlJsDatabase,
  rule: FieldRule,
  recTable: number,
  recId: number,
  ownedLinkTarget?: number,
): SqlParameter[][] {
  const hasOwnedLinkTarget = rule.valueTable === 'ValuesLinks' && typeof ownedLinkTarget === 'number';
  const linkTargetClause = hasOwnedLinkTarget ? ' AND vlink_table = ?' : '';
  const params: SqlParameter[] = [rule.id, recTable, recId];
  if (hasOwnedLinkTarget) params.push(ownedLinkTarget);
  const result = db.exec(
    `SELECT ${INSERT_COLUMNS[rule.valueTable]} FROM ${rule.valueTable} WHERE f_id = ? AND rec_table = ? AND rec_id = ?${linkTargetClause} ORDER BY id`,
    params,
  );
  return (result[0]?.values as SqlParameter[][] | undefined) ?? [];
}

export function replaceOwnedValue(
  db: SqlJsDatabase,
  rule: FieldRule,
  recTable: number,
  recId: number,
  values: SqlParameter[] | null,
  logger: AtdbDiagnosticLogger = silentAtdbLogger,
  ownedLinkTarget?: number,
): void {
  if (!rule.write || rule.confidence !== 'invariant') {
    logger({ level: 'WARN', code: 'value.write.skipped', details: { fieldId: rule.id, confidence: rule.confidence } });
    return;
  }
  const deleteParams: SqlParameter[] = [rule.id, recTable, recId];
  let deleteSql = `DELETE FROM ${rule.valueTable} WHERE f_id = ? AND rec_table = ? AND rec_id = ?`;
  if (rule.valueTable === 'ValuesLinks' && rule.linkTarget) {
    const linkTarget = values?.[0] ?? ownedLinkTarget;
    if (typeof linkTarget !== 'number') {
      logger({ level: 'WARN', code: 'value.link.write.skipped', details: { fieldId: rule.id } });
      return;
    }
    deleteSql += ' AND vlink_table = ?';
    deleteParams.push(linkTarget);
  }
  const existingValues = readOwnedValues(db, rule, recTable, recId, deleteParams[3] as number | undefined);
  if (values === null && existingValues.length === 0) {
    logger({ level: 'DEBUG', code: 'fix.value.write.noop', details: { fieldId: rule.id, recTable } });
    return;
  }
  if (values !== null && existingValues.length === 1 && valuesMatch(existingValues[0], values)) {
    logger({ level: 'DEBUG', code: 'fix.value.write.noop', details: { fieldId: rule.id, recTable } });
    return;
  }
  db.run(deleteSql, deleteParams);
  if (values === null) return;
  const placeholders = values.map(() => '?').join(', ');
  db.run(
    `INSERT INTO ${rule.valueTable} (f_id, rec_table, rec_id, ${INSERT_COLUMNS[rule.valueTable]}) VALUES (?, ?, ?, ${placeholders})`,
    [rule.id, recTable, recId, ...values],
  );
}
