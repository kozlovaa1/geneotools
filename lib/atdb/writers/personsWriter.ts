import type { Person } from '../../types';
import type { SqlJsDatabase } from '../dbTypes';
import { hasLifeEventTables, writeBirthParentRoles, writeLifeEventDate } from './lifeEventWriter';

export function writePersons(db: SqlJsDatabase, persons: Person[]): void {
  for (const person of persons) {
    const sexValue = person.gender === 'M' ? 1 : person.gender === 'F' ? 2 : 0;
    db.run('UPDATE Persons SET sex = ? WHERE id = ?', [sexValue, person.id]);
    db.run('DELETE FROM ValuesStr WHERE rec_table = 9 AND rec_id = ?', [person.id]);
    if (person.firstName) db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [1, person.id, person.firstName]);
    if (person.lastName) db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [2, person.id, person.lastName]);
    if (person.patronymic) db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [3, person.id, person.patronymic]);
    if (person.birthPlace) db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [4, person.id, person.birthPlace]);
    if (person.deathPlace) db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [5, person.id, person.deathPlace]);
    if (person.notes) db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [6, person.id, person.notes]);

    db.run('DELETE FROM ValuesDates WHERE rec_table = 9 AND rec_id = ?', [person.id]);
    if (person.birthDate) {
      const [birthYear, birthMonth, birthDay] = person.birthDate.split('-').map(Number);
      if (!Number.isNaN(birthYear) && !Number.isNaN(birthMonth) && !Number.isNaN(birthDay)) db.run('INSERT INTO ValuesDates (f_id, rec_table, rec_id, y, m, d) VALUES (?, 9, ?, ?, ?, ?)', [7, person.id, birthYear, birthMonth, birthDay]);
    }
    if (person.deathDate) {
      const [deathYear, deathMonth, deathDay] = person.deathDate.split('-').map(Number);
      if (!Number.isNaN(deathYear) && !Number.isNaN(deathMonth) && !Number.isNaN(deathDay)) db.run('INSERT INTO ValuesDates (f_id, rec_table, rec_id, y, m, d) VALUES (?, 9, ?, ?, ?, ?)', [8, person.id, deathYear, deathMonth, deathDay]);
    }

    const lifeEventTablesExist = hasLifeEventTables(db);
    if (lifeEventTablesExist) {
      if (person.birthDate) writeLifeEventDate(db, person.id, 1, person.birthDate, 1);
      if (person.deathDate) writeLifeEventDate(db, person.id, 2, person.deathDate, 2);
    }

    db.run('DELETE FROM ValuesLinks WHERE rec_table = 9 AND rec_id = ?', [person.id]);
    if (person.fatherId) db.run('INSERT INTO ValuesLinks (f_id, rec_table, rec_id, vlink_table, vlink_id) VALUES (?, 9, ?, 9, ?)', [9, person.id, person.fatherId]);
    if (person.motherId) db.run('INSERT INTO ValuesLinks (f_id, rec_table, rec_id, vlink_table, vlink_id) VALUES (?, 9, ?, 9, ?)', [10, person.id, person.motherId]);
    if (lifeEventTablesExist) writeBirthParentRoles(db, person);
  }
}
