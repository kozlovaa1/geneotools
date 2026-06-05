import { ATDB_MAPPING, getEventRoleRule, getFieldRule, getTableRule } from './mapping';
import type { SqlJsDatabase } from './dbTypes';
import type { AtdbDiagnosticLogger } from './diagnostics';
import { silentAtdbLogger } from './diagnostics';
import { readFieldDefinitions, type FieldDefinitions } from './fieldDefinitions';
import type { FieldRule, MappingConfidence, MappingScope, ValuesTable } from './mappingTypes';
import { tableExists } from './sqlHelpers';

export interface EventRoleDefinition {
  id: number;
  eventTypeId: number;
  roleType: number | null;
  isMain: number | null;
  order: number | null;
}

export interface AtdbSchemaContext {
  fields: FieldDefinitions;
  eventTypeIds: ReadonlySet<number>;
  eventRoles: ReadonlyMap<number, EventRoleDefinition>;
  logger: AtdbDiagnosticLogger;
  tableCode(name: 'events' | 'families' | 'persons' | 'places', scope?: MappingScope): number;
  resolveFieldRule(name: string, scope: MappingScope): FieldRule | null;
  resolveEventRole(eventTypeId: number, roleType?: number, order?: number): EventRoleDefinition | null;
  resolvePrimaryEventRole(eventTypeId: number): EventRoleDefinition | null;
  resolveMappedEventRole(name: string): EventRoleDefinition | null;
}

function readIdSet(db: SqlJsDatabase, tableName: string): Set<number> {
  const ids = new Set<number>();
  if (!tableExists(db, tableName)) return ids;
  const statement = db.prepare(`SELECT id FROM ${tableName}`);
  while (statement.step()) {
    const id = statement.getAsObject().id;
    if (typeof id === 'number') ids.add(id);
  }
  statement.free();
  return ids;
}

function readEventRoles(db: SqlJsDatabase): Map<number, EventRoleDefinition> {
  const roles = new Map<number, EventRoleDefinition>();
  if (!tableExists(db, 'EventRoles')) return roles;
  const statement = db.prepare('SELECT id, et_id, roletype, ismain, ord FROM EventRoles');
  while (statement.step()) {
    const row = statement.getAsObject();
    if (typeof row.id === 'number' && typeof row.et_id === 'number') {
      roles.set(row.id, {
        id: row.id,
        eventTypeId: row.et_id,
        roleType: typeof row.roletype === 'number' ? row.roletype : null,
        isMain: typeof row.ismain === 'number' ? row.ismain : null,
        order: typeof row.ord === 'number' ? row.ord : null,
      });
    }
  }
  statement.free();
  return roles;
}

export function createAtdbSchemaContext(
  db: SqlJsDatabase,
  logger: AtdbDiagnosticLogger = silentAtdbLogger,
): AtdbSchemaContext {
  const fields = readFieldDefinitions(db, logger);
  const eventTypeIds = readIdSet(db, 'EventTypes');
  const eventRoles = readEventRoles(db);
  const valuesTables = new Set<ValuesTable>(
    (['ValuesStr', 'ValuesNum', 'ValuesDates', 'ValuesLinks'] as const).filter((tableName) => tableExists(db, tableName)),
  );
  const tableCodeCache = new Map<string, number>();
  const fieldRuleCache = new Map<string, FieldRule | null>();
  const primaryEventRoleCache = new Map<number, EventRoleDefinition | null>();
  const mappedEventRoleCache = new Map<string, EventRoleDefinition | null>();
  logger({
    level: 'DEBUG',
    code: 'schema.context.resolved',
    details: { fields: fields.size, eventTypes: eventTypeIds.size, eventRoles: eventRoles.size, valuesTables: valuesTables.size },
  });

  function logResolvedRule(
    kind: 'table' | 'field' | 'event-role',
    name: string,
    scope: MappingScope,
    confidence: MappingConfidence,
  ): void {
    logger({ level: 'DEBUG', code: 'mapping.rule.resolved', details: { kind, name, scope, confidence } });
    if (confidence === 'legacy-fallback') {
      logger({ level: 'WARN', code: 'mapping.legacy-fallback.used', details: { kind, name, scope } });
    }
  }

  function resolveEventRole(eventTypeId: number, roleType?: number, order?: number): EventRoleDefinition | null {
    const matches = [...eventRoles.values()].filter(
      (role) =>
        role.eventTypeId === eventTypeId &&
        (roleType === undefined || role.roleType === roleType) &&
        (order === undefined || role.order === order),
    );
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) logger({ level: 'WARN', code: 'event-role.ambiguous', details: { eventTypeId, count: matches.length } });
    return null;
  }

  function resolvePrimaryEventRole(eventTypeId: number): EventRoleDefinition | null {
    if (primaryEventRoleCache.has(eventTypeId)) return primaryEventRoleCache.get(eventTypeId) ?? null;
    const matches = [...eventRoles.values()].filter((role) => role.eventTypeId === eventTypeId && role.isMain === 1);
    if (matches.length === 1) {
      logger({ level: 'DEBUG', code: 'fix.life-event.primary-role.resolved', details: { eventTypeId } });
      primaryEventRoleCache.set(eventTypeId, matches[0]);
      return matches[0];
    }
    logger({ level: 'WARN', code: 'fix.life-event.primary-role.skipped', details: { eventTypeId, count: matches.length } });
    primaryEventRoleCache.set(eventTypeId, null);
    return null;
  }

  return {
    fields,
    eventTypeIds,
    eventRoles,
    logger,
    tableCode(name, scope = 'read') {
      const cacheKey = `${scope}:${name}`;
      const cached = tableCodeCache.get(cacheKey);
      if (cached !== undefined) return cached;
      const rule = getTableRule(name, scope);
      logResolvedRule('table', name, scope, rule.confidence);
      tableCodeCache.set(cacheKey, rule.code);
      return rule.code;
    },
    resolveFieldRule(name, scope) {
      const cacheKey = `${scope}:${name}`;
      if (fieldRuleCache.has(cacheKey)) return fieldRuleCache.get(cacheKey) ?? null;
      const rule = getFieldRule(name, scope);
      if (!rule) {
        fieldRuleCache.set(cacheKey, null);
        return null;
      }
      const definition = fields.get(rule.id);
      const expectedTableCode = getTableRule(rule.entity, scope).code;
      const datatypeMatches = rule.datatype === undefined || definition?.datatype === rule.datatype;
      if (!definition || definition.tableCode !== expectedTableCode || !datatypeMatches || !valuesTables.has(rule.valueTable)) {
        logger({
          level: 'WARN',
          code: `field.${scope}.skipped`,
          details: {
            fieldId: rule.id,
            catalogPresent: Boolean(definition),
            datatypeMatches,
            valuesTablePresent: valuesTables.has(rule.valueTable),
          },
        });
        fieldRuleCache.set(cacheKey, null);
        return null;
      }
      logResolvedRule('field', name, scope, rule.confidence);
      fieldRuleCache.set(cacheKey, rule);
      return rule;
    },
    resolveEventRole,
    resolvePrimaryEventRole,
    resolveMappedEventRole(name) {
      if (mappedEventRoleCache.has(name)) return mappedEventRoleCache.get(name) ?? null;
      const rule = getEventRoleRule(name, 'read');
      if (!rule) {
        mappedEventRoleCache.set(name, null);
        return null;
      }
      logResolvedRule('event-role', name, 'read', rule.confidence);
      const role = resolveEventRole(ATDB_MAPPING.eventTypes[rule.eventType].id, rule.roleType, rule.order);
      mappedEventRoleCache.set(name, role);
      return role;
    },
  };
}
