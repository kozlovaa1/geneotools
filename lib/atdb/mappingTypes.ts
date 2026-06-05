export type MappingConfidence = 'invariant' | 'fixture-specific' | 'legacy-fallback';
export type MappingScope = 'read' | 'write';
export type AtdbEntity = 'events' | 'families' | 'persons' | 'places';
export type ValuesTable = 'ValuesStr' | 'ValuesNum' | 'ValuesDates' | 'ValuesLinks';

export interface ScopedRule {
  confidence: MappingConfidence;
  read: boolean;
  write: boolean;
}

export interface TableCodeRule extends ScopedRule {
  code: number;
}

export interface EventTypeRule extends ScopedRule {
  id: number;
}

export interface EventRoleRule extends ScopedRule {
  id: number;
  eventType: string;
  roleType: number;
  order: number;
}

export interface FieldRule extends ScopedRule {
  id: number;
  entity: AtdbEntity;
  valueTable: ValuesTable;
  datatype?: number | null;
  linkTarget?: AtdbEntity;
}

export interface AtdbMappingRegistry {
  version: number;
  tableCodes: Record<string, TableCodeRule>;
  eventTypes: Record<string, EventTypeRule>;
  eventRoles: Record<string, EventRoleRule>;
  fields: Record<string, FieldRule>;
}
