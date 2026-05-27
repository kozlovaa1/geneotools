import type { Person } from '../../types';
import { isNewDateMoreHistoricallyAccurate } from '../dates';
import type { SqlJsDatabase } from '../dbTypes';
import type { FieldDefinitions } from '../fieldDefinitions';

export function readPersons(db: SqlJsDatabase, fieldDefinitions: FieldDefinitions): Person[] {
    // Get all persons
    const persons: Person[] = [];
    try {
      // Get the column names dynamically from the Persons table
      const fieldsInfo = db.prepare("PRAGMA table_info(Persons)");
      const columnNames: string[] = [];
      while(fieldsInfo.step()) {
        const row = fieldsInfo.getAsObject();
        columnNames.push(row.name as string);
      }
      fieldsInfo.free();

      // Construct a more flexible query based on the available columns
      let selectClause = "id, sex";
      if (columnNames.includes('fname')) selectClause += ", fname";
      if (columnNames.includes('lname')) selectClause += ", lname";
      if (columnNames.includes('patronymic')) selectClause += ", patronymic";
      if (columnNames.includes('birth_date')) selectClause += ", birth_date";
      if (columnNames.includes('death_date')) selectClause += ", death_date";
      if (columnNames.includes('birth_place')) selectClause += ", birth_place";
      if (columnNames.includes('death_place')) selectClause += ", death_place";
      if (columnNames.includes('notes')) selectClause += ", notes";

      const personStmt = db.prepare(`SELECT ${selectClause} FROM Persons`);
      while (personStmt.step()) {
        const row = personStmt.getAsObject();
        const personId = row.id as number;
        const sex = (row.sex || row.sex_value || row.sextype) as number || 0; // Handle different possible column names
        const firstName = (row.fname || row.firstname) as string;
        const lastName = (row.lname || row.lastname) as string;
        const patronymic = (row.patronymic || row.middlename) as string;
        const birthDate = (row.birth_date || row.bdate) as string;
        const deathDate = (row.death_date || row.ddate) as string;
        const birthPlace = (row.birth_place || row.birthplace) as string;
        const deathPlace = (row.death_place || row.deathplace) as string;
        const notes = (row.notes || row.comments) as string;

        // Initialize person object with values from the main table
        const person: Person = {
          id: personId,
          gender: sex === 1 ? 'M' : sex === 2 ? 'F' : 'Unknown',
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          patronymic: patronymic || undefined,
          birthDate: birthDate || undefined,
          deathDate: deathDate || undefined,
          birthPlace: birthPlace || undefined,
          deathPlace: deathPlace || undefined,
          notes: notes || undefined,
          fatherId: undefined,
          motherId: undefined,
          spouseIds: []
        };

        // Get all string values for this person from ValuesStr table (without restricting rec_table initially)
        // This is to explore what data is available for the person
        const valuesStrStmt = db.prepare(`
          SELECT f_id, rec_table, rec_id, vstr
          FROM ValuesStr
          WHERE rec_id = ?
        `);
        valuesStrStmt.bind([personId]);

        const allNameValues: { [key: number]: { rec_table: number; vstr: string } } = {};
        while (valuesStrStmt.step()) {
          const valuesStrRow = valuesStrStmt.getAsObject();
          const fieldId = valuesStrRow.f_id as number;
          const recTable = valuesStrRow.rec_table as number;
          const valueStr = valuesStrRow.vstr as string;
          allNameValues[fieldId] = { rec_table: recTable, vstr: valueStr };
        }
        valuesStrStmt.free();

        // Apply values based on Field definitions
        for (const [fieldId, data] of Object.entries(allNameValues)) {
          const id = parseInt(fieldId);
          const valueStr = data.vstr;

          // Check if we have a field definition for this field ID
          const fieldDef = fieldDefinitions.get(id);

          // Check table code to determine if this field is for Persons, Families, etc.
          if (fieldDef && fieldDef.tableCode === 9) { // 9 is for Persons
            // Use field name from definition if available
            if (fieldDef.name) {
              switch (fieldDef.name.toLowerCase()) {
                case 'fname': // First name
                case 'first name':
                case 'имя':
                  if (!person.firstName) person.firstName = valueStr;
                  break;
                case 'lname': // Last name
                case 'last name':
                case 'фамилия':
                  if (!person.lastName) person.lastName = valueStr;
                  break;
                case 'patronymic': // Patronymic
                case 'отчество':
                  if (!person.patronymic) person.patronymic = valueStr;
                  break;
                case 'birthplace': // Birth place
                case 'birth place':
                case 'место рождения':
                  if (!person.birthPlace) person.birthPlace = valueStr;
                  break;
                case 'deathplace': // Death place
                case 'death place':
                case 'место смерти':
                  if (!person.deathPlace) person.deathPlace = valueStr;
                  break;
                case 'notes': // Notes
                case 'примечания':
                  if (!person.notes) person.notes = valueStr;
                  break;
                default:
                  // Unknown field name, but we can continue processing
              }
            } else {
              // If name is null but tableCode is 9, try to use field ID
              if (!person.lastName && id === 64) { // Last name fallback
                person.lastName = valueStr;
              } else if (!person.firstName && id === 66) { // First name fallback
                person.firstName = valueStr;
              } else if (!person.patronymic && id === 67) { // Patronymic fallback
                person.patronymic = valueStr;
              }
            }
          } else if (fieldDef && fieldDef.tableCode === 13) {
            // Table 13 can carry person-related fields in some .atdb variants.
            // Field 64 - often contains last name
            // Field 65 - often contains maiden name or mother's name
            // Field 66 - often contains first name
            // Field 67 - often contains patronymic
            // Field 89 - often contains notes
            // Field 73 - often contains occupation or status
            switch (id) {
              case 64: // Last name
                if (!person.lastName) person.lastName = valueStr;
                break;
              case 65: // Observed to be maiden name or mother's name
                if (!person.lastName && fieldDef.name && fieldDef.name.toLowerCase().includes('m')) {
                  // Use as last name if field name suggests it's maiden (mF, mf, etc.)
                  person.lastName = valueStr;
                } else if (!person.motherLastName) {
                  person.motherLastName = valueStr;
                }
                break;
              case 66: // First name
                if (!person.firstName) person.firstName = valueStr;
                break;
              case 67: // Patronymic
                if (!person.patronymic) person.patronymic = valueStr;
                break;
              case 89: // Observed to be notes/comments
                if (!person.notes) person.notes = valueStr;
                break;
              case 73: // Observed to be occupation or status
                if (!person.occupation) person.occupation = valueStr; // Using occupation field to store main occupation
                break;
              default:
                // Field not mapped to person property, but continue processing
            }
          } else {
            // Use default field mapping if no field definition available
            if (!person.lastName && id === 64) { // Last name fallback
              person.lastName = valueStr;
            } else if (!person.firstName && id === 66) { // First name fallback
              person.firstName = valueStr;
            } else if (!person.patronymic && id === 67) { // Patronymic fallback
              person.patronymic = valueStr;
            } else if (!person.firstName && id === 1) { // First name (fallback)
              person.firstName = valueStr;
            } else if (!person.lastName && id === 2) { // Last name (fallback)
              person.lastName = valueStr;
            } else if (!person.patronymic && id === 3) { // Patronymic (fallback)
              person.patronymic = valueStr;
            } else if (!person.birthPlace && id === 4) { // Birth place
              person.birthPlace = valueStr;
            } else if (!person.deathPlace && id === 5) { // Death place
              person.deathPlace = valueStr;
            } else if (!person.notes && id === 6) { // Notes
              person.notes = valueStr;
            } else if (!person.birthDate && [14, 18, 25].includes(id) && valueStr) {
              // Check if value is a potential date in various formats
              const dateRegex = /^(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4}|\d{4}\/\d{2}\/\d{2}|\d{2}-\d{2}-\d{4})$/;
              if (valueStr.match(dateRegex)) {
                person.birthDate = valueStr;
              }
            } else if (!person.deathDate && [15, 19, 26].includes(id) && valueStr) {
              // Check if value is a potential date in various formats
              const dateRegex = /^(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4}|\d{4}\/\d{2}\/\d{2}|\d{2}-\d{2}-\d{4})$/;
              if (valueStr.match(dateRegex)) {
                person.deathDate = valueStr;
              }
            } else if (id > 6 && ![14, 15, 18, 19, 25, 26].includes(id)) {
              // Additional field handling
            }
          }
        }

        // Get all numeric values for this person from ValuesNum table
        const valuesNumStmt = db.prepare(`
          SELECT f_id, vnum
          FROM ValuesNum
          WHERE rec_id = ?
        `);
        valuesNumStmt.bind([personId]);

        const numValues: { [key: number]: number } = {};
        while (valuesNumStmt.step()) {
          const valuesNumRow = valuesNumStmt.getAsObject();
          const fieldId = valuesNumRow.f_id as number;
          const valueNum = valuesNumRow.vnum as number;
          numValues[fieldId] = valueNum;
        }
        valuesNumStmt.free();

        // Get all date values for this person from ValuesDates table
        const valuesDatesStmt = db.prepare(`
          SELECT f_id, y, m, d, rec_table, rec_id
          FROM ValuesDates
          WHERE rec_id = ?  -- We'll check all tables for this person
        `);
        valuesDatesStmt.bind([personId]);

        const allDateValues: { [key: number]: { y: number; m: number; d: number; rec_table: number; rec_id: number } } = {};
        while (valuesDatesStmt.step()) {
          const valuesDatesRow = valuesDatesStmt.getAsObject();
          const fieldId = valuesDatesRow.f_id as number;
          const year = valuesDatesRow.y as number;
          const month = valuesDatesRow.m as number;
          const day = valuesDatesRow.d as number;
          const recTable = valuesDatesRow.rec_table as number;
          const recId = valuesDatesRow.rec_id as number;
          allDateValues[fieldId] = { y: year, m: month, d: day, rec_table: recTable, rec_id: recId };
        }
        valuesDatesStmt.free();

        // Process date values
        for (const [fieldId, date] of Object.entries(allDateValues)) {
          const id = parseInt(fieldId);

          // Check if we have a field definition for this field ID
          const fieldDef = fieldDefinitions.get(id);
          if (date.y) {
            let dateStr = null;
            if (date.y && date.m && date.d) {
              // Full date with year, month, and day
              dateStr = `${date.y.toString().padStart(4, '0')}-${date.m.toString().padStart(2, '0')}-${date.d.toString().padStart(2, '0')}`;
            } else if (date.y && date.m && !date.d) {
              // Partial date with year and month only
              dateStr = `${date.y.toString().padStart(4, '0')}-${date.m.toString().padStart(2, '0')}-00`;
            } else if (date.y && !date.m && !date.d) {
              // Partial date with year only
              dateStr = `${date.y.toString().padStart(4, '0')}-00-00`;
            }

            if (dateStr) { // Only process if we have a valid date string
              if (fieldDef && fieldDef.name && fieldDef.tableCode === 9) { // 9 is for Persons
                // Use field name from definition if available
                switch (fieldDef.name.toLowerCase()) {
                case 'birthdate': // Birth date
                case 'birth date':
                case 'дата рождения':
                  if (!person.birthDate || isNewDateMoreHistoricallyAccurate(person.birthDate, dateStr)) person.birthDate = dateStr;
                  break;
                case 'deathdate': // Death date
                case 'death date':
                case 'дата смерти':
                  if (!person.deathDate || isNewDateMoreHistoricallyAccurate(person.deathDate, dateStr)) person.deathDate = dateStr;
                  break;
                default:
                  // Unknown field name, but we can continue processing
                }
              } else if (fieldDef && fieldDef.name && fieldDef.tableCode === 13) {
                // Sometimes person date data is stored with table code 13 instead of 9
                switch (fieldDef.name.toLowerCase()) {
                  case 'birthdate': // Birth date
                  case 'birth date':
                  case 'дата рождения':
                    if (!person.birthDate || isNewDateMoreHistoricallyAccurate(person.birthDate, dateStr)) person.birthDate = dateStr;
                    break;
                  case 'deathdate': // Death date
                  case 'death date':
                  case 'дата смерти':
                    if (!person.deathDate || isNewDateMoreHistoricallyAccurate(person.deathDate, dateStr)) person.deathDate = dateStr;
                    break;
                  default:
                    // Field not mapped to person property, but continue processing
                }
              } else {
                // Use default field mapping if no field definition available
                // Based on observed field IDs in the database
                if (([7, 14, 18, 25].includes(id) && (!person.birthDate || isNewDateMoreHistoricallyAccurate(person.birthDate, dateStr))) ||
                   ([7, 14, 18, 25].includes(id) && !person.birthDate)) { // Standard birth date field IDs
                  person.birthDate = dateStr;
                } else if (([8, 15, 19, 26].includes(id) && (!person.deathDate || isNewDateMoreHistoricallyAccurate(person.deathDate, dateStr))) ||
                          ([8, 15, 19, 26].includes(id) && !person.deathDate)) { // Standard death date field IDs
                  person.deathDate = dateStr;
                } else if ((id === 29 && (!person.birthDate || isNewDateMoreHistoricallyAccurate(person.birthDate, dateStr))) ||
                          (id === 29 && !person.birthDate)) { // Alternative birth date field ID
                  person.birthDate = dateStr;
                } else if ((id === 4469 && (!person.birthDate || isNewDateMoreHistoricallyAccurate(person.birthDate, dateStr))) ||
                           (id === 4469 && !person.birthDate)) { // Special field ID for birth date in some databases
                  person.birthDate = dateStr;
                }
              }
            }
          }
        }

        // Additionally, check for birth and death dates and places through Events, EventDetails, and EventRoles
        // According to the schema:
        // - Persons.id = EventDetails.p_id
        // - EventDetails.e_id connects to the date information
        // - EventDetails.er_id = EventRoles.id
        // - EventRoles.et_id = event type (1 = Birth, 2 = Death)
        try {
          const eventDetailsStmt = db.prepare(`
            SELECT e_id, er_id
            FROM EventDetails
            WHERE p_id = ?
          `);
          eventDetailsStmt.bind([personId]);

          while (eventDetailsStmt.step()) {
            const eventDetailsRow = eventDetailsStmt.getAsObject();
            const eventId = eventDetailsRow.e_id as number;
            const eventRoleId = eventDetailsRow.er_id as number;

            // Get event type from EventRoles
            let eventType = 0; // default
            if (eventRoleId) {
              const eventRoleStmt = db.prepare(`
                SELECT et_id
                FROM EventRoles
                WHERE id = ?
              `);
              eventRoleStmt.bind([eventRoleId]);

              if (eventRoleStmt.step()) {
                const eventRoleRow = eventRoleStmt.getAsObject();
                eventType = eventRoleRow.et_id as number;
              }
              eventRoleStmt.free();
            }

            // Now get date values from ValuesDates where rec_table = 7 (EventDetails) and rec_id matches the event ID
            // In this approach, field IDs don't determine birth/death, but rather the event type from EventRoles does
            const eventDateStmt = db.prepare(`
              SELECT f_id, y, m, d
              FROM ValuesDates
              WHERE rec_table = 7 AND rec_id = ?
            `);
            eventDateStmt.bind([eventId]);

            while (eventDateStmt.step()) {
              const dateRow = eventDateStmt.getAsObject();
              const year = dateRow.y as number;
              const month = dateRow.m as number;
              const day = dateRow.d as number;

              if (year) {
                let dateStr = null;
                if (year && month && day) {
                  // Full date with year, month, and day
                  dateStr = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                } else if (year && month && !day) {
                  // Partial date with year and month only
                  dateStr = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-00`;
                } else if (year && !month && !day) {
                  // Partial date with year only
                  dateStr = `${year.toString().padStart(4, '0')}-00-00`;
                }

                if (dateStr) {
                  // Determine if this is birth or death based on event type from EventRoles
                  switch (eventType) {
                    case 1: // Birth event type
                      if (!person.birthDate || isNewDateMoreHistoricallyAccurate(person.birthDate, dateStr)) person.birthDate = dateStr;
                      break;
                    case 2: // Death event type
                      if (!person.deathDate || isNewDateMoreHistoricallyAccurate(person.deathDate, dateStr)) person.deathDate = dateStr;
                      break;
                    default:
                      // Other event types, but continue processing
                  }
                }
              }
            }
            eventDateStmt.free();

            // Next, get place links from ValuesLinks where rec_table = 7 (EventDetails) and rec_id matches the event ID
            const eventLinkStmt = db.prepare(`
              SELECT f_id, vlink_table, vlink_id
              FROM ValuesLinks
              WHERE rec_table = 7 AND rec_id = ?
            `);
            eventLinkStmt.bind([eventId]);

            while (eventLinkStmt.step()) {
              const linkRow = eventLinkStmt.getAsObject();
              const linkTable = linkRow.vlink_table as number;
              const linkedId = linkRow.vlink_id as number;

              // If the link is to a place (linkTable = 14), get the place details
              if (linkTable === 14) { // 14 is the code for Places table
                switch (eventType) {
                  case 1: // Birth event type
                    person.birthPlaceId = linkedId;
                    break;
                  case 2: // Death event type
                    person.deathPlaceId = linkedId;
                    break;
                  default:
                    // Other event types, but continue processing
                }
              }
            }
            eventLinkStmt.free();
          }
          eventDetailsStmt.free();
        } catch (err) {
          // EventDetails or EventRoles tables might not exist in all databases, so we just continue
          console.warn('Could not read EventDetails or EventRoles tables (these are optional):', err);
        }

        // Get all linked values for this person from ValuesLinks table
        const valuesLinksStmt = db.prepare(`
          SELECT f_id, vlink_table, vlink_id, rec_table, rec_id
          FROM ValuesLinks
          WHERE rec_id = ?  -- We'll check all tables for this person
        `);
        valuesLinksStmt.bind([personId]);

        const linkValues: { [key: number]: { vlink_table: number; vlink_id: number; rec_table: number; rec_id: number } } = {};
        while (valuesLinksStmt.step()) {
          const valuesLinksRow = valuesLinksStmt.getAsObject();
          const fieldId = valuesLinksRow.f_id as number;
          const linkTable = valuesLinksRow.vlink_table as number;
          const linkedId = valuesLinksRow.vlink_id as number;
          const recTable = valuesLinksRow.rec_table as number;
          const recId = valuesLinksRow.rec_id as number;
          linkValues[fieldId] = { vlink_table: linkTable, vlink_id: linkedId, rec_table: recTable, rec_id: recId };
        }
        valuesLinksStmt.free();

        // Process linked values (relationships)
        for (const [fieldId, data] of Object.entries(linkValues)) {
          const id = parseInt(fieldId);
          const linkedId = data.vlink_id;

          // Check if we have a field definition for this field ID
          const fieldDef = fieldDefinitions.get(id);
          if (fieldDef && fieldDef.name && fieldDef.tableCode === 9) { // 9 is for Persons
            // Use field name from definition if available
            switch (fieldDef.name.toLowerCase()) {
              case 'father': // Father ID
              case 'father id':
              case 'отец':
              case 'id отца':
                if (!person.fatherId) person.fatherId = linkedId;
                break;
              case 'mother': // Mother ID
              case 'mother id':
              case 'мать':
              case 'id матери':
                if (!person.motherId) person.motherId = linkedId;
                break;
              default:
                // Unknown field name, but we can continue processing
            }
          } else if (fieldDef && fieldDef.name && fieldDef.tableCode === 13) {
            // Sometimes person link data is stored with table code 13 instead of 9
            switch (fieldDef.name.toLowerCase()) {
              case 'father': // Father ID
              case 'father id':
              case 'отец':
              case 'id отца':
                if (!person.fatherId) person.fatherId = linkedId;
                break;
              case 'mother': // Mother ID
              case 'mother id':
              case 'мать':
              case 'id матери':
                if (!person.motherId) person.motherId = linkedId;
                break;
              default:
                // Field not mapped to person relationship, but continue processing
            }
          } else {
            // Use default field mapping if no field definition available
            if (!person.fatherId && id === 9) { // Father ID fallback
              person.fatherId = linkedId;
            } else if (!person.motherId && id === 10) { // Mother ID fallback
              person.motherId = linkedId;
            } else if (!person.fatherId && id === 153) { // Alternative field IDs for father/mother relationships
              person.fatherId = linkedId;
            } else if (!person.motherId && id === 154) {
              person.motherId = linkedId;
            }
          }
        }

        persons.push(person);
      }
      personStmt.free();

      // Extract father and mother IDs from birth events
      // For each person, find their birth event in EventDetails where er_id = 1 (meaning the person was born)
      // Then find other participants in the same event where er_id = 2 (father) and er_id = 3 (mother)
      for (const person of persons) {
        try {
          const birthEventQuery = db.prepare(`
            SELECT e_id
            FROM EventDetails
            WHERE p_id = ? AND er_id = 1
          `);
          birthEventQuery.bind([person.id]);

          if (birthEventQuery.step()) {
            const birthEventRow = birthEventQuery.getAsObject();
            const eventId = birthEventRow.e_id as number;

            // Find the father (er_id = 2) and mother (er_id = 3) in the same event
            const relatedPersonsQuery = db.prepare(`
              SELECT p_id, er_id
              FROM EventDetails
              WHERE e_id = ? AND er_id IN (2, 3)
            `);
            relatedPersonsQuery.bind([eventId]);

            while (relatedPersonsQuery.step()) {
              const relatedRow = relatedPersonsQuery.getAsObject();
              const relatedPersonId = relatedRow.p_id as number;
              const eventRole = relatedRow.er_id as number;

              if (eventRole === 2) { // Father
                person.fatherId = relatedPersonId;
              } else if (eventRole === 3) { // Mother
                person.motherId = relatedPersonId;
              }
            }
            relatedPersonsQuery.free();
          }
          birthEventQuery.free();
        } catch (err) {
          // If EventDetails table doesn't exist or has a different structure, continue with existing data
          console.warn('Could not extract parent information from birth events:', err);
        }
      }
    } catch (err) {
      console.error('Error reading Persons table:', err);
    }
  return persons;
}
