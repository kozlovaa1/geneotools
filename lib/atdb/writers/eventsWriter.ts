import type { Event } from '../../types';
import type { SqlJsDatabase } from '../dbTypes';
import type { AtdbSchemaContext } from '../schemaContext';

export function writeEvents(db: SqlJsDatabase, events: Event[], context: AtdbSchemaContext): void {
  for (const event of events) {
    const match = typeof event.eventType === 'string' ? /^EventType(\d+)$/.exec(event.eventType) : null;
    if (match && context.eventTypeIds.has(Number(match[1]))) {
      db.run('UPDATE Events SET et_id = ? WHERE id = ?', [Number(match[1]), event.id]);
    } else {
      context.logger({ level: 'WARN', code: 'event.type.write.skipped' });
    }
  }
  context.logger({ level: 'DEBUG', code: 'events.write', details: { count: events.length } });
}
