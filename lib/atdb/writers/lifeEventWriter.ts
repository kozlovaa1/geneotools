import type { Person } from '../../types';
import type { SqlJsDatabase } from '../dbTypes';
import { getLastInsertRowId, tableExists } from '../sqlHelpers';

export function hasLifeEventTables(db: SqlJsDatabase): boolean {
  return tableExists(db, 'EventDetails') && tableExists(db, 'EventRoles');
}

export function findOrCreateLifeEvent(db: SqlJsDatabase, personId: number, eventTypeId: 1 | 2, bornRoleId?: 1): number | null {
  const existingEvent = db.exec('SELECT ed.e_id as eventId, ed.er_id as eventRoleId FROM EventDetails ed JOIN EventRoles er ON ed.er_id = er.id WHERE ed.p_id = ? AND er.et_id = ?', [personId, eventTypeId]);
  if (existingEvent.length > 0) {
    const eventId = existingEvent[0].values[0][0];
    return typeof eventId === 'number' ? eventId : null;
  }

  db.run('INSERT INTO EventRoles (et_id) VALUES (?)', [eventTypeId]);
  const eventRoleId = getLastInsertRowId(db);
  if (eventRoleId === null) return null;

  db.run('INSERT INTO Events (et_id) VALUES (?)', [eventTypeId]);
  const eventId = getLastInsertRowId(db);
  if (eventId === null) return null;

  db.run('INSERT INTO EventDetails (p_id, e_id, er_id) VALUES (?, ?, ?)', [personId, eventId, bornRoleId ?? eventRoleId]);
  return eventId;
}

export function writeLifeEventDate(db: SqlJsDatabase, personId: number, eventTypeId: 1 | 2, date: string, fieldId: 1 | 2): void {
  const eventId = findOrCreateLifeEvent(db, personId, eventTypeId);
  if (!eventId) return;

  const [year, month, day] = date.split('-').map(Number);
  if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
    db.run('DELETE FROM ValuesDates WHERE rec_table = 7 AND rec_id = ? AND y IS NOT NULL', [eventId]);
    db.run('INSERT INTO ValuesDates (f_id, rec_table, rec_id, y, m, d) VALUES (?, 7, ?, ?, ?, ?)', [fieldId, eventId, year, month, day]);
  }
}

export function writeBirthParentRoles(db: SqlJsDatabase, person: Person): void {
  const birthEventId = findOrCreateLifeEvent(db, person.id, 1, 1);
  if (!birthEventId) return;

  db.run('DELETE FROM EventDetails WHERE e_id = ? AND er_id IN (2, 3)', [birthEventId]);
  if (person.fatherId) db.run('INSERT INTO EventDetails (p_id, e_id, er_id) VALUES (?, ?, 2)', [person.fatherId, birthEventId]);
  if (person.motherId) db.run('INSERT INTO EventDetails (p_id, e_id, er_id) VALUES (?, ?, 3)', [person.motherId, birthEventId]);
}

export function writeLifeEventPlaceLinks(db: SqlJsDatabase, persons: Person[]): void {
  if (!hasLifeEventTables(db)) return;

  for (const person of persons) {
    if (person.birthPlaceId) {
      const birthEventId = findOrCreateLifeEvent(db, person.id, 1);
      if (birthEventId) {
        db.run('DELETE FROM ValuesLinks WHERE rec_table = 7 AND rec_id = ? AND vlink_table = 14', [birthEventId]);
        db.run('INSERT INTO ValuesLinks (f_id, rec_table, rec_id, vlink_table, vlink_id) VALUES (1, 7, ?, 14, ?)', [birthEventId, person.birthPlaceId]);
      }
    }

    if (person.deathPlaceId) {
      const deathEventId = findOrCreateLifeEvent(db, person.id, 2);
      if (deathEventId) {
        db.run('DELETE FROM ValuesLinks WHERE rec_table = 7 AND rec_id = ? AND vlink_table = 14', [deathEventId]);
        db.run('INSERT INTO ValuesLinks (f_id, rec_table, rec_id, vlink_table, vlink_id) VALUES (1, 7, ?, 14, ?)', [deathEventId, person.deathPlaceId]);
      }
    }
  }
}
