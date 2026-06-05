import type { Place } from '../../types';
import type { SqlJsDatabase } from '../dbTypes';
import type { AtdbSchemaContext } from '../schemaContext';
import { replaceOwnedValue } from './valueWriter';

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
