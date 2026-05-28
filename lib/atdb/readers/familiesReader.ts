import type { Family } from '../../types';
import type { SqlJsDatabase } from '../dbTypes';

export function readFamilies(db: SqlJsDatabase): Family[] {
    // Get all families
    const families: Family[] = [];
    try {
      const familyStmt = db.prepare("SELECT id, color FROM Families");
      while (familyStmt.step()) {
        const row = familyStmt.getAsObject();
        const familyId = row.id as number;

        // Initialize family object with default values
        const family: Family = {
          id: familyId,
          color: row.color as number,
          childrenIds: []
        };

        // Get all linked values for this family from ValuesLinks table (table code 13 for Families)
        const valuesLinksStmt = db.prepare(`
          SELECT f_id, vlink_id
          FROM ValuesLinks
          WHERE rec_table = 13 AND rec_id = ?  -- 13 is the code for Families table
        `);
        valuesLinksStmt.bind([familyId]);

        // Process linked values (relationships like husband, wife, children)
        while (valuesLinksStmt.step()) {
          const valuesLinksRow = valuesLinksStmt.getAsObject();
          const fieldId = valuesLinksRow.f_id as number;
          const linkedId = valuesLinksRow.vlink_id as number;

          // Field IDs in Древо Жизни typically mean:
          // 1: Husband ID
          // 2: Wife ID
          // 3: Child ID (multiple entries possible)
          switch (fieldId) {
            case 1: // Husband ID
              family.husbandId = linkedId;
              break;
            case 2: // Wife ID
              family.wifeId = linkedId;
              break;
            case 3: // Child ID
              family.childrenIds.push(linkedId);
              break;
            default:
              // Unknown link field, but continue processing
          }
        }
        valuesLinksStmt.free();

        // Get date values for the family (like marriage, divorce dates)
        const valuesDatesStmt = db.prepare(`
          SELECT f_id, y, m, d
          FROM ValuesDates
          WHERE rec_table = 13 AND rec_id = ?  -- 13 is the code for Families table
        `);
        valuesDatesStmt.bind([familyId]);

        while (valuesDatesStmt.step()) {
          const valuesDatesRow = valuesDatesStmt.getAsObject();
          const fieldId = valuesDatesRow.f_id as number;
          const year = valuesDatesRow.y as number;
          const month = valuesDatesRow.m as number;
          const day = valuesDatesRow.d as number;

          if (year && month && day) {
            const dateStr = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            switch (fieldId) {
              case 4: // Marriage date
                family.marriedDate = dateStr;
                break;
              case 5: // Divorce date
                family.divorcedDate = dateStr;
                break;
              default:
                // Unknown date field, but continue processing
            }
          }
        }
        valuesDatesStmt.free();

        // Get string values for the family (including family name, surnames, and comment)
        const valuesStrStmt = db.prepare(`
          SELECT f_id, vstr
          FROM ValuesStr
          WHERE rec_table = 9 AND rec_id = ?  -- 9 is the code for Families table (according to requirements)
        `);
        valuesStrStmt.bind([familyId]);

        while (valuesStrStmt.step()) {
          const valuesStrRow = valuesStrStmt.getAsObject();
          const fieldId = valuesStrRow.f_id as number;
          const valueStr = valuesStrRow.vstr as string;

          switch (fieldId) {
            case 48: // Мужская фамилия
              family.husbandLastName = valueStr;
              break;
            case 49: // Женская фамилия
              family.wifeLastName = valueStr;
              break;
            case 50: // Название рода
              family.familyName = valueStr;
              break;
            case 52: // Комментарий
              family.comment = valueStr;
              break;
            case 6: // Notes (старое поле)
              family.notes = valueStr;
              break;
            default:
              // Unknown string field, but continue processing
          }
        }
        valuesStrStmt.free();

        families.push(family);
      }
      familyStmt.free();
    } catch (err) {
      console.error('Error reading Families table:', err);
    }
  return families;
}
