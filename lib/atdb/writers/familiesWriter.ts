import type { Family, Person } from '../../types';
import type { SqlJsDatabase } from '../dbTypes';

export function deriveFamiliesFromSpouseRelationships(persons: Person[], families: Family[]): void {
  // First, make sure all spouse relationships from Person objects are reflected in families
  for (const person of persons) {
    if (person.spouseIds && person.spouseIds.length > 0) {
      for (const spouseId of person.spouseIds) {
        // Check if there's already a family connecting these two people
          const existingFamily = families.find(family =>
          (family.husbandId === person.id && family.wifeId === spouseId) ||
          (family.wifeId === person.id && family.husbandId === spouseId) ||
          (family.husbandId === spouseId && family.wifeId === person.id) ||
          (family.wifeId === spouseId && family.husbandId === person.id)
        );

        // If no family exists for this couple, create one
        if (!existingFamily) {
            const spouse = persons.find(p => p.id === spouseId);
          if (spouse) {
            // Determine gender to assign husband/wife roles appropriately
            const husbandId = person.gender === 'M' ? person.id :
                             (spouse.gender === 'M' ? spouseId :
                             person.gender === 'F' ? spouseId : person.id);
            const wifeId = person.gender === 'F' ? person.id :
                          (spouse.gender === 'F' ? spouseId :
                          person.gender === 'M' ? spouseId : spouseId);

            // Only add the family if both husband and wife are properly assigned and different
            if (husbandId && wifeId && husbandId !== wifeId) {
              const newFamily = {
                id: -1, // Will be handled by database insertion
                husbandId,
                wifeId,
                childrenIds: [],
                marriedDate: undefined,
                divorcedDate: undefined,
                notes: undefined
              };

              // Add to families if not duplicate
                const duplicateFamily = families.find(f =>
                (f.husbandId === newFamily.husbandId && f.wifeId === newFamily.wifeId) ||
                (f.husbandId === newFamily.wifeId && f.wifeId === newFamily.husbandId)
              );

              if (!duplicateFamily) {
                  families.push(newFamily);
              }
            }
          }
        }
      }
    }
  }
}

export function writeFamilies(db: SqlJsDatabase, families: Family[]): void {
    // Update families data - delete old values and insert new ones
    for (const family of families) {
      // Update the color field in the Families table if it exists
      if (typeof family.color !== 'undefined') {
        db.run('UPDATE Families SET color = ? WHERE id = ?', [family.color, family.id]);
      }

      // Delete existing linked values in ValuesLinks table for this family (table code 9 for Families according to requirements)
      db.run('DELETE FROM ValuesLinks WHERE rec_table = 9 AND rec_id = ?', [family.id]);

      // Insert updated linked values
      if (family.husbandId) {
        db.run('INSERT INTO ValuesLinks (f_id, rec_table, rec_id, vlink_table, vlink_id) VALUES (?, 9, ?, 9, ?)', [1, family.id, family.husbandId]); // 1 is husband ID (link to Person table)
      }
      if (family.wifeId) {
        db.run('INSERT INTO ValuesLinks (f_id, rec_table, rec_id, vlink_table, vlink_id) VALUES (?, 9, ?, 9, ?)', [2, family.id, family.wifeId]); // 2 is wife ID (link to Person table)
      }
      for (const childId of family.childrenIds) {
        db.run('INSERT INTO ValuesLinks (f_id, rec_table, rec_id, vlink_table, vlink_id) VALUES (?, 9, ?, 9, ?)', [3, family.id, childId]); // 3 is child ID (link to Person table)
      }

      // Delete existing date values in ValuesDates table for this family
      db.run('DELETE FROM ValuesDates WHERE rec_table = 9 AND rec_id = ?', [family.id]);

      // Insert updated date values
      if (family.marriedDate) {
        const [marYear, marMonth, marDay] = family.marriedDate.split('-').map(Number);
        if (!isNaN(marYear) && !isNaN(marMonth) && !isNaN(marDay)) {
          db.run('INSERT INTO ValuesDates (f_id, rec_table, rec_id, y, m, d) VALUES (?, 9, ?, ?, ?, ?)', [4, family.id, marYear, marMonth, marDay]); // 4 is marriage date
        }
      }
      if (family.divorcedDate) {
        const [divYear, divMonth, divDay] = family.divorcedDate.split('-').map(Number);
        if (!isNaN(divYear) && !isNaN(divMonth) && !isNaN(divDay)) {
          db.run('INSERT INTO ValuesDates (f_id, rec_table, rec_id, y, m, d) VALUES (?, 9, ?, ?, ?, ?)', [5, family.id, divYear, divMonth, divDay]); // 5 is divorce date
        }
      }

      // Delete existing string values in ValuesStr table for this family
      db.run('DELETE FROM ValuesStr WHERE rec_table = 9 AND rec_id = ?', [family.id]);

      // Insert updated string values
      if (family.familyName) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [50, family.id, family.familyName]); // 50 is family name
      }
      if (family.husbandLastName) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [48, family.id, family.husbandLastName]); // 48 is husband surname
      }
      if (family.wifeLastName) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [49, family.id, family.wifeLastName]); // 49 is wife surname
      }
      if (family.comment) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [52, family.id, family.comment]); // 52 is comment
      }
      if (family.notes) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [6, family.id, family.notes]); // 6 is notes for family
      }
    }
}
