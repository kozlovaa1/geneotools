import registryJson from './mapping.json';
import type {
  AtdbEntity,
  AtdbMappingRegistry,
  EventRoleRule,
  EventTypeRule,
  FieldRule,
  MappingConfidence,
  MappingScope,
  ScopedRule,
  TableCodeRule,
  ValuesTable,
} from './mappingTypes';

const CONFIDENCE_LEVELS = new Set<MappingConfidence>(['invariant', 'fixture-specific', 'legacy-fallback']);
const ENTITIES = new Set<AtdbEntity>(['events', 'families', 'persons', 'places']);
const VALUES_TABLES = new Set<ValuesTable>(['ValuesStr', 'ValuesNum', 'ValuesDates', 'ValuesLinks']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateScopedRule(name: string, value: unknown): asserts value is Record<string, unknown> & ScopedRule {
  if (
    !isRecord(value) ||
    !CONFIDENCE_LEVELS.has(value.confidence as MappingConfidence) ||
    typeof value.read !== 'boolean' ||
    typeof value.write !== 'boolean'
  ) {
    throw new Error(`Invalid scoped ATDB mapping rule: ${name}`);
  }
  if (value.write && value.confidence !== 'invariant') {
    throw new Error(`Non-invariant ATDB mapping rule cannot be write-safe: ${name}`);
  }
}

function validateRuleMap(
  value: unknown,
  validateRule: (name: string, rule: Record<string, unknown>) => void,
): asserts value is Record<string, Record<string, unknown>> {
  if (!isRecord(value)) throw new Error('Invalid ATDB mapping rule collection');
  for (const [name, rule] of Object.entries(value)) {
    validateScopedRule(name, rule);
    validateRule(name, rule);
  }
}

function validateRegistry(value: unknown): AtdbMappingRegistry {
  if (!isRecord(value) || value.version !== 1) {
    throw new Error('Unsupported ATDB mapping registry structure');
  }

  validateRuleMap(value.tableCodes, (name, rule) => {
    if (!Number.isInteger(rule.code)) throw new Error(`Invalid ATDB table code rule: ${name}`);
  });
  validateRuleMap(value.eventTypes, (name, rule) => {
    if (!Number.isInteger(rule.id)) throw new Error(`Invalid ATDB event type rule: ${name}`);
  });
  validateRuleMap(value.eventRoles, (name, rule) => {
    if (
      !Number.isInteger(rule.id) ||
      typeof rule.eventType !== 'string' ||
      !Number.isInteger(rule.roleType) ||
      !Number.isInteger(rule.order)
    ) {
      throw new Error(`Invalid ATDB event role rule: ${name}`);
    }
  });
  validateRuleMap(value.fields, (name, rule) => {
    if (
      !Number.isInteger(rule.id) ||
      !ENTITIES.has(rule.entity as AtdbEntity) ||
      !VALUES_TABLES.has(rule.valueTable as ValuesTable) ||
      (rule.datatype !== undefined && rule.datatype !== null && !Number.isInteger(rule.datatype)) ||
      (rule.linkTarget !== undefined && !ENTITIES.has(rule.linkTarget as AtdbEntity))
    ) {
      throw new Error(`Invalid ATDB field rule: ${name}`);
    }
  });

  const eventTypes = value.eventTypes as unknown as Record<string, EventTypeRule>;
  for (const [name, role] of Object.entries(value.eventRoles as unknown as Record<string, EventRoleRule>)) {
    if (!eventTypes[role.eventType]) throw new Error(`Unknown event type for ATDB event role: ${name}`);
  }

  return value as unknown as AtdbMappingRegistry;
}

export const ATDB_MAPPING = validateRegistry(registryJson);

export function getTableCode(entity: AtdbEntity): number {
  return getTableRule(entity, 'read').code;
}

export function getTableRule(name: string, scope: MappingScope): TableCodeRule {
  const rule = ATDB_MAPPING.tableCodes[name];
  if (!rule || !rule[scope]) throw new Error(`ATDB table rule is not ${scope}-safe: ${name}`);
  return rule;
}

export function getFieldRule(name: string, scope: MappingScope): FieldRule | null {
  const rule = ATDB_MAPPING.fields[name];
  return rule && rule[scope] ? rule : null;
}

export function getEventRoleRule(name: string, scope: MappingScope): EventRoleRule | null {
  const rule = ATDB_MAPPING.eventRoles[name];
  return rule && rule[scope] ? rule : null;
}

export function getFieldsFor(entity: AtdbEntity, valueTable: ValuesTable, scope: MappingScope): FieldRule[] {
  return Object.values(ATDB_MAPPING.fields).filter(
    (rule) => rule.entity === entity && rule.valueTable === valueTable && rule[scope],
  );
}

export function isKnownField(fieldId: number, entity: AtdbEntity, valueTable: ValuesTable): boolean {
  return getFieldsFor(entity, valueTable, 'read').some((rule) => rule.id === fieldId);
}
