import type { Place } from '../../types';
import type { AtdbChangeSet, AtdbPlaceField } from '../rebuildContract';
import type { SqlJsDatabase, SqlParameter } from '../dbTypes';
import type { AtdbSchemaContext } from '../schemaContext';
import { replaceOwnedValue } from './valueWriter';

const PLACE_STRING_RULES: Partial<Record<AtdbPlaceField, string>> = {
  name: 'placeName',
  shortName: 'placeShortName',
  comment: 'placeComment',
};

function stringValue(value: unknown): SqlParameter[] | null {
  return typeof value === 'string' ? [value] : null;
}

export function writePlaces(db: SqlJsDatabase, places: Place[] | undefined, context: AtdbSchemaContext): void {
  const recTable = context.tableCode('places', 'write');
  const fields = [
    ['placeName', (place: Place) => place.name],
    ['placeShortName', (place: Place) => place.shortName],
    ['placeComment', (place: Place) => place.comment],
  ] as const;
  for (const place of places ?? []) {
    for (const [ruleName, readValue] of fields) {
      const rule = context.resolveFieldRule(ruleName, 'write');
      if (rule) replaceOwnedValue(db, rule, recTable, place.id, readValue(place) ? [readValue(place) ?? null] : null, context.logger);
    }
  }
  context.logger({ level: 'DEBUG', code: 'places.write', details: { count: places?.length ?? 0 } });
}

export function writePlaceChanges(db: SqlJsDatabase, changeSet: AtdbChangeSet, context: AtdbSchemaContext): void {
  const recTable = context.tableCode('places', 'write');
  let applied = 0;

  for (const entityChange of changeSet.changes) {
    if (entityChange.entityType !== 'place') continue;

    for (const fieldChange of entityChange.fields) {
      const ruleName = PLACE_STRING_RULES[fieldChange.field as AtdbPlaceField];
      const rule = ruleName ? context.resolveFieldRule(ruleName, 'write') : null;
      if (rule) {
        replaceOwnedValue(db, rule, recTable, entityChange.id, stringValue(fieldChange.value), context.logger);
        applied++;
      }
    }
  }

  context.logger({ level: 'DEBUG', code: 'rebuild.places.applied', details: { changes: applied } });
}
