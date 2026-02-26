// This file handles sql.js operations and is designed to be imported dynamically
// to avoid server-side rendering issues

export interface Person {
  id: number;
  firstName?: string;
  lastName?: string;
  patronymic?: string;
  gender: 'M' | 'F' | 'Unknown';
  birthDate?: string; // Format: YYYY-MM-DD
  deathDate?: string; // Format: YYYY-MM-DD
  birthPlace?: string;
  deathPlace?: string;
  birthPlaceId?: number;
  deathPlaceId?: number;
  notes?: string;
  fatherId?: number;
  motherId?: number;
  spouseIds?: number[];
  occupation?: string;
  motherLastName?: string;
}

export interface Family {
  id: number;
  familyName?: string;        // Название рода (f_id=50 from ValuesStr)
  husbandLastName?: string;   // Мужская фамилия (f_id=48 from ValuesStr)
  wifeLastName?: string;      // Женская фамилия (f_id=49 from ValuesStr)
  comment?: string;           // Комментарий (f_id=52 from ValuesStr)
  husbandId?: number;
  wifeId?: number;
  childrenIds: number[];
  marriedDate?: string; // Format: YYYY-MM-DD
  divorcedDate?: string; // Format: YYYY-MM-DD
  notes?: string;
  color?: number;
}

export interface Event {
  id: number;
  personIds?: number[];
  eventType: string; // Birth, Death, Marriage, etc.
  date?: string; // Format: YYYY-MM-DD
  place?: string;
  description?: string;
}

export interface Place {
  id: number;
  name?: string;
  shortName?: string;
  comment?: string;
}

export interface ParsedAtdb {
  persons: Person[];
  families: Family[];
  events: Event[];
  places: Place[];
  metadata: {
    version?: number;
    guid?: string;
    sourceGuid?: string;
    mainLanguage?: string;
    parameters?: string;
  };
}

export async function parseAtdb(buffer: Uint8Array | Buffer): Promise<ParsedAtdb> {
  // Dynamically import the SQL module
  const { createDbFromBuffer } = await import('./initSqlJs');
  const db = await createDbFromBuffer(buffer instanceof Buffer ? new Uint8Array(buffer) : buffer);

  // Check if buffer has minimum size and correct header
  if (buffer.length < 16) {
    throw new Error('Invalid .atdb file: too small to be valid SQLite database');
  }

  // Verify it's an SQLite database by checking the header
  const header = buffer.subarray(0, 16);
  const headerStr = String.fromCharCode(...header);

  if (!headerStr.startsWith('SQLite format 3')) {
    throw new Error('Invalid .atdb file: not a valid SQLite database');
  }

  // Read field definitions to map field IDs to their meanings
  const fieldDefinitions = new Map<number, { tableCode: number; name: string }>();
  try {
    const fieldsStmt = db.prepare("SELECT id, tablecode, area FROM Fields");
    while (fieldsStmt.step()) {
      const row = fieldsStmt.getAsObject();
      const fieldId = row.id as number;
      const tableCode = row.tablecode as number;
      const fieldName = row.area as string;
      fieldDefinitions.set(fieldId, { tableCode, name: fieldName });
    }
    fieldsStmt.free();
  } catch (err) {
    console.warn('Could not read Fields table (this is optional):', err);
  }

  // Helper function to determine if a new date is more historically accurate
  const isNewDateMoreHistoricallyAccurate = (currentDate: string, newDate: string): boolean => {
    // If current date is empty, accept the new one
    if (!currentDate) return true;

    // Extract years from dates (in YYYY-MM-DD format)
    const currentYear = parseInt(currentDate.split('-')[0]);
    const newYear = parseInt(newDate.split('-')[0]);

    // If both dates are in the past, prefer older (more historical) date
    if (currentYear > 1950 && newYear < currentYear && newYear > 1500) {
      return true;
    }

    // If current date is in the future (unlikely for historical person), prefer past date
    const currentYearAsNumber = parseInt(currentDate.split('-')[0]);
    const newYearAsNumber = parseInt(newDate.split('-')[0]);
    const currentIsFuture = currentYearAsNumber > new Date().getFullYear();
    const newIsPast = newYearAsNumber <= new Date().getFullYear();

    if (currentIsFuture && newIsPast && newYearAsNumber > 1500) {
      return true;
    }

    return false;
  };

  try {
    // First, get metadata from the Global table
    let metadata: {
      version?: number;
      guid?: string;
      sourceGuid?: string;
      mainLanguage?: string;
      parameters?: string;
    } = {
      version: undefined,
      guid: undefined,
      sourceGuid: undefined,
      mainLanguage: undefined,
      parameters: undefined
    };

    try {
      const globalStmt = db.prepare("SELECT version, guid, srcguid as sourceGuid, mainlang as mainLanguage, params as parameters FROM Global LIMIT 1");
      if (globalStmt.step()) {
        const globalRow = globalStmt.getAsObject();
        metadata = {
          version: globalRow.version as number | undefined,
          guid: globalRow.guid as string | undefined,
          sourceGuid: globalRow.sourceGuid as string | undefined,
          mainLanguage: globalRow.mainLanguage as string | undefined,
          parameters: globalRow.parameters as string | undefined
        };
      }
      globalStmt.free();
    } catch (err) {
      console.warn('Could not read Global table:', err);
    }
    
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
          const recId = valuesStrRow.rec_id as number;
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
              if (!person.lastName && id === 64) { // Last name (based on observed data: "Никишин", "Солдатов", etc.)
                person.lastName = valueStr;
              } else if (!person.firstName && id === 66) { // First name (based on observed data: "Алексей", "Александр", etc.)
                person.firstName = valueStr;
              } else if (!person.patronymic && id === 67) { // Patronymic (based on observed data)
                person.patronymic = valueStr;
              }
            }
          } else if (fieldDef && fieldDef.tableCode === 13) {
            // According to our debug logs, person data in table 13 often has names like "MF", "mF", etc.
            // The field IDs 64, 65, 66, 67 are commonly used for names:
            // Field 64 - often contains last name
            // Field 65 - often contains maiden name or mother's name
            // Field 66 - often contains first name
            // Field 67 - often contains patronymic
            // Field 89 - often contains notes
            // Field 73 - often contains occupation or status
            switch (id) {
              case 64: // Observed to be last name in debug logs (e.g. "Никишин", "Солдатов", "Горбачёв")
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
              case 66: // Observed to be first name in debug logs (e.g. "Алексей", "Александр", "Матрёна")
                if (!person.firstName) person.firstName = valueStr;
                break;
              case 67: // Observed to be patronymic in debug logs (e.g. "Ильич", "Александрович")
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
            // Based on the actual values observed in the database
            if (!person.lastName && id === 64) { // Last name (based on observed data: "Никишин", "Солдатов", etc.)
              person.lastName = valueStr;
            } else if (!person.firstName && id === 66) { // First name (based on observed data: "Алексей", "Александр", etc.)
              person.firstName = valueStr;
            } else if (!person.patronymic && id === 67) { // Patronymic (based on observed data)
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
        let dateRowCount = 0;
        while (valuesDatesStmt.step()) {
          const valuesDatesRow = valuesDatesStmt.getAsObject();
          const fieldId = valuesDatesRow.f_id as number;
          const year = valuesDatesRow.y as number;
          const month = valuesDatesRow.m as number;
          const day = valuesDatesRow.d as number;
          const recTable = valuesDatesRow.rec_table as number;
          const recId = valuesDatesRow.rec_id as number;
          allDateValues[fieldId] = { y: year, m: month, d: day, rec_table: recTable, rec_id: recId };
          dateRowCount++;
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
              const fieldId = dateRow.f_id as number;
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
              const linkFieldId = linkRow.f_id as number;  // Not directly used in this approach
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
        let linkRowCount = 0;
        while (valuesLinksStmt.step()) {
          const valuesLinksRow = valuesLinksStmt.getAsObject();
          const fieldId = valuesLinksRow.f_id as number;
          const linkTable = valuesLinksRow.vlink_table as number;
          const linkedId = valuesLinksRow.vlink_id as number;
          const recTable = valuesLinksRow.rec_table as number;
          const recId = valuesLinksRow.rec_id as number;
          linkValues[fieldId] = { vlink_table: linkTable, vlink_id: linkedId, rec_table: recTable, rec_id: recId };
          linkRowCount++;
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
            // Using observed field IDs from debug logs
            if (!person.fatherId && id === 9) { // Father ID - observed in debug
              person.fatherId = linkedId;
            } else if (!person.motherId && id === 10) { // Mother ID - observed in debug
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
    
    // Get all events
    const events: Event[] = [];
    try {
      const eventStmt = db.prepare("SELECT id, et_id FROM Events");
      while (eventStmt.step()) {
        const row = eventStmt.getAsObject();
        const eventId = row.id as number;
        const etId = row.et_id as number;

        // Initialize event object with data from Events table
        const event: Event = {
          id: eventId,
          eventType: `EventType${etId}` // This will be replaced with actual names later
        };

        // Get related persons through EventDetails table
        // EventDetails connects events to persons and their roles
        const eventDetailsStmt = db.prepare(`
          SELECT p_id, er_id, p_ord
          FROM EventDetails
          WHERE e_id = ?
          ORDER BY p_ord
        `);
        eventDetailsStmt.bind([eventId]);

        const personIds: number[] = [];
        while (eventDetailsStmt.step()) {
          const eventDetailsRow = eventDetailsStmt.getAsObject();
          const personId = eventDetailsRow.p_id as number;
          personIds.push(personId);
        }
        eventDetailsStmt.free();

        if (personIds.length > 0) {
          event.personIds = personIds;
        }

        // Get event date through ValuesDates where rec_table=7 (EventDetails table code)
        // We use the first person in the event (with the lowest p_ord) to get the date
        let firstPersonId: number | undefined;
        const firstPersonIdResult = db.prepare(`
          SELECT p_id
          FROM EventDetails
          WHERE e_id = ?
          ORDER BY p_ord
          LIMIT 1
        `);
        firstPersonIdResult.bind([eventId]);

        if (firstPersonIdResult.step()) {
          const firstPersonRow = firstPersonIdResult.getAsObject();
          firstPersonId = firstPersonRow.p_id as number;

          // Now get the date from ValuesDates where rec_table=7 (EventDetails) and
          // rec_id matches the EventDetails record for the first person
          const dateEventDetailsStmt = db.prepare(`
            SELECT ed.id
            FROM EventDetails ed
            WHERE ed.e_id = ? AND ed.p_id = ?
            ORDER BY ed.p_ord
            LIMIT 1
          `);
          dateEventDetailsStmt.bind([eventId, firstPersonId]);

          if (dateEventDetailsStmt.step()) {
            const dateEventDetailsRow = dateEventDetailsStmt.getAsObject();
            const eventDetailsId = dateEventDetailsRow.id as number;

            const valuesDatesStmt = db.prepare(`
              SELECT f_id, y, m, d
              FROM ValuesDates
              WHERE rec_table = 7 AND rec_id = ?  -- 7 is the code for EventDetails table
            `);
            valuesDatesStmt.bind([eventDetailsId]);

            while (valuesDatesStmt.step()) {
              const valuesDatesRow = valuesDatesStmt.getAsObject();
              const year = valuesDatesRow.y as number;
              const month = valuesDatesRow.m as number;
              const day = valuesDatesRow.d as number;

              if (year && month && day) {
                const dateStr = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                event.date = dateStr; // Use the date found
                break; // Assuming only one date per event
              }
            }
            valuesDatesStmt.free();
          }
          dateEventDetailsStmt.free();
        }
        firstPersonIdResult.free();

        // Get event place through ValuesLinks where rec_table=7 (EventDetails table code)
        // We use the first person in the event (with the lowest p_ord) to get the place
        if (firstPersonId !== undefined) {
          const placeEventDetailsStmt = db.prepare(`
            SELECT ed.id
            FROM EventDetails ed
            WHERE ed.e_id = ? AND ed.p_id = ?
            ORDER BY ed.p_ord
            LIMIT 1
          `);
          placeEventDetailsStmt.bind([eventId, firstPersonId]);

          if (placeEventDetailsStmt.step()) {
            const placeEventDetailsRow = placeEventDetailsStmt.getAsObject();
            const eventDetailsId = placeEventDetailsRow.id as number;

            // Get place link from ValuesLinks where rec_table=7 (EventDetails) and
            // rec_id matches the EventDetails record for the first person
            const valuesLinksStmt = db.prepare(`
              SELECT f_id, vlink_table, vlink_id
              FROM ValuesLinks
              WHERE rec_table = 7 AND rec_id = ? AND vlink_table = 14  -- 14 is the code for Places table
            `);
            valuesLinksStmt.bind([eventDetailsId]);

            if (valuesLinksStmt.step()) {
              const valuesLinksRow = valuesLinksStmt.getAsObject();
              const placeId = valuesLinksRow.vlink_id as number;

              // Now get the place name from the Places table via ValuesStr
              const placeStrStmt = db.prepare(`
                SELECT vstr
                FROM ValuesStr
                WHERE rec_table = 14 AND rec_id = ? AND f_id = 93  -- 93 is typically for place name
              `);
              placeStrStmt.bind([placeId]);

              if (placeStrStmt.step()) {
                const placeStrRow = placeStrStmt.getAsObject();
                event.place = placeStrRow.vstr as string;
              }
              placeStrStmt.free();
            }
            valuesLinksStmt.free();
          }
          placeEventDetailsStmt.free();
        }

        // Get event description from ValuesStr where rec_table=11 (Events) and rec_id=eventId
        const valuesStrStmt = db.prepare(`
          SELECT f_id, vstr
          FROM ValuesStr
          WHERE rec_table = 11 AND rec_id = ?  -- 11 is the code for Events table
        `);
        valuesStrStmt.bind([eventId]);

        while (valuesStrStmt.step()) {
          const valuesStrRow = valuesStrStmt.getAsObject();
          const fieldId = valuesStrRow.f_id as number;
          const valueStr = valuesStrRow.vstr as string;

          switch (fieldId) {
            case 4: // Event place
              if (!event.place) event.place = valueStr; // Only set if not already set from EventDetails
              break;
            case 5: // Event description
              event.description = valueStr;
              break;
            default:
              // Unknown string field, but continue processing
          }
        }
        valuesStrStmt.free();

        events.push(event);
      }
      eventStmt.free();
    } catch (err) {
      console.error('Error reading Events table:', err);
    }

    // Populate spouse relationships based on Families
    // For each family, link the husband and wife as spouses of each other
    for (const family of families) {
      if (family.husbandId && family.wifeId) {
        // Find the husband in persons array and add wife as spouse
        const husband = persons.find(p => p.id === family.husbandId);
        if (husband) {
          if (!husband.spouseIds) {
            husband.spouseIds = [];
          }
          if (!husband.spouseIds.includes(family.wifeId)) {
            husband.spouseIds.push(family.wifeId);
          }
        }

        // Find the wife in persons array and add husband as spouse
        const wife = persons.find(p => p.id === family.wifeId);
        if (wife) {
          if (!wife.spouseIds) {
            wife.spouseIds = [];
          }
          if (!wife.spouseIds.includes(family.husbandId)) {
            wife.spouseIds.push(family.husbandId);
          }
        }
      }
    }

    // Create Places array and populate place information in persons
    const places: Place[] = [];

    try {
      // Get all places
      const placesStmt = db.prepare('SELECT id FROM Places');
      while (placesStmt.step()) {
        const placeRow = placesStmt.getAsObject();
        const placeId = placeRow.id as number;

        // Get place details from ValuesStr where rec_table = 14 (Places)
        const placeDetailsStmt = db.prepare(`
          SELECT f_id, vstr
          FROM ValuesStr
          WHERE rec_table = 14 AND rec_id = ?
        `);
        placeDetailsStmt.bind([placeId]);

        const place: Place = { id: placeId };
        while (placeDetailsStmt.step()) {
          const detailRow = placeDetailsStmt.getAsObject();
          const fieldId = detailRow.f_id as number;
          const valueStr = detailRow.vstr as string;

          // Field IDs: 93 - name, 94 - short name, 104 - comment
          switch (fieldId) {
            case 93: // Name
              place.name = valueStr;
              break;
            case 94: // Short name
              place.shortName = valueStr;
              break;
            case 104: // Comment
              place.comment = valueStr;
              break;
            default:
              // Other fields, but continue processing
          }
        }
        placeDetailsStmt.free();

        places.push(place);
      }
      placesStmt.free();

      // Now populate birthPlace and deathPlace in persons based on place IDs
      for (const person of persons) {
        if (person.birthPlaceId !== undefined) {
          const birthPlace = places.find(p => p.id === person.birthPlaceId);
          if (birthPlace && birthPlace.name) {
            person.birthPlace = birthPlace.name;
          }
        }

        if (person.deathPlaceId !== undefined) {
          const deathPlace = places.find(p => p.id === person.deathPlaceId);
          if (deathPlace && deathPlace.name) {
            person.deathPlace = deathPlace.name;
          }
        }
      }
    } catch (err) {
      // Places table might not exist in all databases, so we just continue
      console.warn('Could not read Places table (this is optional):', err);
    }

    return {
      persons,
      families,
      events,
      places,
      metadata
    };
  } finally {
    // Close the database to free memory
    db.close();
  }
}

export async function buildAtdb(data: ParsedAtdb, originalBuffer: Uint8Array | Buffer): Promise<Uint8Array> {
  // Dynamically import the SQL module
  const { createDbFromBuffer } = await import('./initSqlJs');
  const db = await createDbFromBuffer(originalBuffer instanceof Buffer ? new Uint8Array(originalBuffer) : originalBuffer);

  try {
    // Update metadata if available
    if (data.metadata) {
      // First, delete any existing metadata
      db.run('DELETE FROM Global');

      // Then insert the updated metadata
      db.run(
        'INSERT INTO Global (version, guid, srcguid, mainlang, params) VALUES (?, ?, ?, ?, ?)',
        [
          data.metadata.version || null,
          data.metadata.guid || null,
          data.metadata.sourceGuid || null,
          data.metadata.mainLanguage || null,
          data.metadata.parameters || null
        ]
      );
    }

    // Update persons data - delete old values and insert new ones
    for (const person of data.persons) {
      // Update the sex field in the Persons table
      const sexValue = person.gender === 'M' ? 1 : person.gender === 'F' ? 2 : 0;
      db.run('UPDATE Persons SET sex = ? WHERE id = ?', [sexValue, person.id]);

      // Delete existing string values in ValuesStr table for this person (table code 9 for Persons)
      db.run('DELETE FROM ValuesStr WHERE rec_table = 9 AND rec_id = ?', [person.id]);

      // Insert updated string values
      if (person.firstName) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [1, 9, person.id, person.firstName]); // 1 is first name
      }
      if (person.lastName) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [2, 9, person.id, person.lastName]); // 2 is last name
      }
      if (person.patronymic) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [3, 9, person.id, person.patronymic]); // 3 is patronymic
      }
      if (person.birthPlace) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [4, 9, person.id, person.birthPlace]); // 4 is birth place
      }
      if (person.deathPlace) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [5, 9, person.id, person.deathPlace]); // 5 is death place
      }
      if (person.notes) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [6, 9, person.id, person.notes]); // 6 is notes
      }

      // Delete existing date values in ValuesDates table for this person
      db.run('DELETE FROM ValuesDates WHERE rec_table = 9 AND rec_id = ?', [person.id]);

      // Insert updated date values
      if (person.birthDate) {
        const [birthYear, birthMonth, birthDay] = person.birthDate.split('-').map(Number);
        if (!isNaN(birthYear) && !isNaN(birthMonth) && !isNaN(birthDay)) {
          db.run('INSERT INTO ValuesDates (f_id, rec_table, rec_id, y, m, d) VALUES (?, 9, ?, ?, ?, ?)', [7, 9, person.id, birthYear, birthMonth, birthDay]); // 7 is birth date
        }
      }
      if (person.deathDate) {
        const [deathYear, deathMonth, deathDay] = person.deathDate.split('-').map(Number);
        if (!isNaN(deathYear) && !isNaN(deathMonth) && !isNaN(deathDay)) {
          db.run('INSERT INTO ValuesDates (f_id, rec_table, rec_id, y, m, d) VALUES (?, 9, ?, ?, ?, ?)', [8, 9, person.id, deathYear, deathMonth, deathDay]); // 8 is death date
        }
      }

      // Additionally, handle birth and death dates through the EventDetails and EventRoles pathway
      // First, check if EventDetails and EventRoles tables exist (they might not in all databases)
      const eventDetailsExists = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='EventDetails';").length > 0;
      const eventRolesExists = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='EventRoles';").length > 0;

      if (eventDetailsExists && eventRolesExists) {
        // EventDetails and EventRoles tables exist, handle birth and death dates through Events pathway
        // This approach ensures compatibility with systems that expect dates in the EventDetails pathway

        // Find or create birth event for this person
        if (person.birthDate) {
          // Check if there's already an EventDetails record for a birth event (where EventRoles.et_id = 1) for this person
          const existingBirthEvent = db.exec(`
            SELECT ed.e_id as eventId, ed.er_id as eventRoleId
            FROM EventDetails ed
            JOIN EventRoles er ON ed.er_id = er.id
            WHERE ed.p_id = ? AND er.et_id = 1
          `, [person.id]);

          let birthEventId, birthEventRoleId;
          if (existingBirthEvent.length > 0) {
            // Use existing event and event role IDs
            birthEventId = existingBirthEvent[0].values[0][0];
            birthEventRoleId = existingBirthEvent[0].values[0][1];
          } else {
            // Create a new EventRoles entry for birth (et_id = 1)
            db.run('INSERT INTO EventRoles (et_id) VALUES (1)'); // 1 means birth event
            const lastRowResult = db.exec('SELECT last_insert_rowid()');
            birthEventRoleId = lastRowResult.length > 0 ? lastRowResult[0].values[0][0] : null;

            if (birthEventRoleId !== null) {
              // Create a new event entry
              db.run('INSERT INTO Events (et_id) VALUES (1)'); // 1 for birth event reference
              const lastEventRowResult = db.exec('SELECT last_insert_rowid()');
              birthEventId = lastEventRowResult.length > 0 ? lastEventRowResult[0].values[0][0] : null;

              if (birthEventId !== null) {
                // Link person to the new birth event in EventDetails with the event role
                db.run('INSERT INTO EventDetails (p_id, e_id, er_id) VALUES (?, ?, ?)', [person.id, birthEventId, birthEventRoleId]);
              }
            }
          }

          // Now update the birth date in ValuesDates with rec_table = 7 (EventDetails)
          if (birthEventId) {
            const [birthYear, birthMonth, birthDay] = person.birthDate.split('-').map(Number);
            if (!isNaN(birthYear) && !isNaN(birthMonth) && !isNaN(birthDay)) {
              // Remove any existing birth date for this event
              db.run('DELETE FROM ValuesDates WHERE rec_table = 7 AND rec_id = ? AND y IS NOT NULL', [birthEventId]);
              // Insert the new birth date value (f_id can be a general date field identifier)
              db.run('INSERT INTO ValuesDates (f_id, rec_table, rec_id, y, m, d) VALUES (1, 7, ?, ?, ?, ?)',
                    [birthEventId, birthYear, birthMonth, birthDay]);
            }
          }
        }

        // Find or create death event for this person
        if (person.deathDate) {
          // Check if there's already an EventDetails record for a death event (where EventRoles.et_id = 2) for this person
          const existingDeathEvent = db.exec(`
            SELECT ed.e_id as eventId, ed.er_id as eventRoleId
            FROM EventDetails ed
            JOIN EventRoles er ON ed.er_id = er.id
            WHERE ed.p_id = ? AND er.et_id = 2
          `, [person.id]);

          let deathEventId, deathEventRoleId;
          if (existingDeathEvent.length > 0) {
            // Use existing event and event role IDs
            deathEventId = existingDeathEvent[0].values[0][0];
            deathEventRoleId = existingDeathEvent[0].values[0][1];
          } else {
            // Create a new EventRoles entry for death (et_id = 2)
            db.run('INSERT INTO EventRoles (et_id) VALUES (2)'); // 2 means death event
            const lastRowResult = db.exec('SELECT last_insert_rowid()');
            deathEventRoleId = lastRowResult.length > 0 ? lastRowResult[0].values[0][0] : null;

            if (deathEventRoleId !== null) {
              // Create a new event entry
              db.run('INSERT INTO Events (et_id) VALUES (2)'); // 2 for death event reference
              const lastEventRowResult = db.exec('SELECT last_insert_rowid()');
              deathEventId = lastEventRowResult.length > 0 ? lastEventRowResult[0].values[0][0] : null;

              if (deathEventId !== null) {
                // Link person to the new death event in EventDetails with the event role
                db.run('INSERT INTO EventDetails (p_id, e_id, er_id) VALUES (?, ?, ?)', [person.id, deathEventId, deathEventRoleId]);
              }
            }
          }

          // Now update the death date in ValuesDates with rec_table = 7 (EventDetails)
          if (deathEventId) {
            const [deathYear, deathMonth, deathDay] = person.deathDate.split('-').map(Number);
            if (!isNaN(deathYear) && !isNaN(deathMonth) && !isNaN(deathDay)) {
              // Remove any existing death date for this event
              db.run('DELETE FROM ValuesDates WHERE rec_table = 7 AND rec_id = ? AND y IS NOT NULL', [deathEventId]);
              // Insert the new death date value (f_id can be a general date field identifier)
              db.run('INSERT INTO ValuesDates (f_id, rec_table, rec_id, y, m, d) VALUES (2, 7, ?, ?, ?, ?)',
                    [deathEventId, deathYear, deathMonth, deathDay]);
            }
          }
        }
      }

      // Delete existing linked values in ValuesLinks table for this person
      db.run('DELETE FROM ValuesLinks WHERE rec_table = 9 AND rec_id = ?', [person.id]);

      // Insert updated linked values (relationships)
      if (person.fatherId) {
        db.run('INSERT INTO ValuesLinks (f_id, rec_table, rec_id, vlink_table, vlink_id) VALUES (?, 9, ?, 9, ?)', [9, 9, person.id, person.fatherId]); // 9 is father ID (link to Person table)
      }
      if (person.motherId) {
        db.run('INSERT INTO ValuesLinks (f_id, rec_table, rec_id, vlink_table, vlink_id) VALUES (?, 9, ?, 9, ?)', [10, 9, person.id, person.motherId]); // 10 is mother ID (link to Person table)
      }

      // Additionally, handle parent relationships through the EventDetails pathway
      // This ensures compatibility with systems that expect parent relationships in the EventDetails pathway
      if (eventDetailsExists && eventRolesExists) {
        // Find or create birth event for this person
        // First, check if there's already an EventDetails record for a birth event (where EventRoles.et_id = 1) for this person with role 1 (the person born)
        const existingBirthEvent = db.exec(`
          SELECT ed.e_id as eventId, ed.er_id as eventRoleId
          FROM EventDetails ed
          JOIN EventRoles er ON ed.er_id = er.id
          WHERE ed.p_id = ? AND er.et_id = 1
        `, [person.id]);

        let birthEventId, birthEventRoleId;
        if (existingBirthEvent.length > 0) {
          // Use existing event ID (we'll update the roles)
          birthEventId = existingBirthEvent[0].values[0][0];
        } else {
          // Create a new EventRoles entry for the person being born (er_id = 1) with event type 1 (birth)
          db.run('INSERT INTO EventRoles (et_id) VALUES (1)'); // 1 means birth event
          const lastRowResult = db.exec('SELECT last_insert_rowid()');
          birthEventRoleId = lastRowResult.length > 0 ? lastRowResult[0].values[0][0] : null;

          if (birthEventRoleId !== null) {
            // Create a new event entry
            db.run('INSERT INTO Events (et_id) VALUES (1)'); // 1 for birth event reference
            const lastEventRowResult = db.exec('SELECT last_insert_rowid()');
            birthEventId = lastEventRowResult.length > 0 ? lastEventRowResult[0].values[0][0] : null;

            if (birthEventId !== null) {
              // Link person to the new birth event in EventDetails as "the one born" (er_id = 1)
              db.run('INSERT INTO EventDetails (p_id, e_id, er_id) VALUES (?, ?, ?)', [person.id, birthEventId, 1]);
            }
          }
        }

        // Now handle father (er_id = 2) and mother (er_id = 3) roles in the same event
        if (birthEventId) {
          // First, delete existing parent roles for this birth event
          db.run(`
            DELETE FROM EventDetails
            WHERE e_id = ? AND er_id IN (2, 3)
          `, [birthEventId]);

          // Add father to the event (er_id = 2)
          if (person.fatherId) {
            db.run('INSERT INTO EventDetails (p_id, e_id, er_id) VALUES (?, ?, 2)', [person.fatherId, birthEventId]);
          }

          // Add mother to the event (er_id = 3)
          if (person.motherId) {
            db.run('INSERT INTO EventDetails (p_id, e_id, er_id) VALUES (?, ?, 3)', [person.motherId, birthEventId]);
          }
        }
      }
    }

    // Update families data - delete old values and insert new ones
    // Also handle any spouse relationships from Person objects that need family records
    // First, make sure all spouse relationships from Person objects are reflected in families
    for (const person of data.persons) {
      if (person.spouseIds && person.spouseIds.length > 0) {
        for (const spouseId of person.spouseIds) {
          // Check if there's already a family connecting these two people
          const existingFamily = data.families.find(family =>
            (family.husbandId === person.id && family.wifeId === spouseId) ||
            (family.wifeId === person.id && family.husbandId === spouseId) ||
            (family.husbandId === spouseId && family.wifeId === person.id) ||
            (family.wifeId === spouseId && family.husbandId === person.id)
          );

          // If no family exists for this couple, create one
          if (!existingFamily) {
            const spouse = data.persons.find(p => p.id === spouseId);
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
                const duplicateFamily = data.families.find(f =>
                  (f.husbandId === newFamily.husbandId && f.wifeId === newFamily.wifeId) ||
                  (f.husbandId === newFamily.wifeId && f.wifeId === newFamily.husbandId)
                );

                if (!duplicateFamily) {
                  data.families.push(newFamily);
                }
              }
            }
          }
        }
      }
    }

    // Update families data - delete old values and insert new ones
    for (const family of data.families) {
      // Update the color field in the Families table if it exists
      if (typeof family.color !== 'undefined') {
        db.run('UPDATE Families SET color = ? WHERE id = ?', [family.color, family.id]);
      }

      // Delete existing linked values in ValuesLinks table for this family (table code 9 for Families according to requirements)
      db.run('DELETE FROM ValuesLinks WHERE rec_table = 9 AND rec_id = ?', [family.id]);

      // Insert updated linked values
      if (family.husbandId) {
        db.run('INSERT INTO ValuesLinks (f_id, rec_table, rec_id, vlink_table, vlink_id) VALUES (?, 9, ?, 9, ?)', [1, 9, family.id, family.husbandId]); // 1 is husband ID (link to Person table)
      }
      if (family.wifeId) {
        db.run('INSERT INTO ValuesLinks (f_id, rec_table, rec_id, vlink_table, vlink_id) VALUES (?, 9, ?, 9, ?)', [2, 9, family.id, family.wifeId]); // 2 is wife ID (link to Person table)
      }
      for (const childId of family.childrenIds) {
        db.run('INSERT INTO ValuesLinks (f_id, rec_table, rec_id, vlink_table, vlink_id) VALUES (?, 9, ?, 9, ?)', [3, 9, family.id, childId]); // 3 is child ID (link to Person table)
      }

      // Delete existing date values in ValuesDates table for this family
      db.run('DELETE FROM ValuesDates WHERE rec_table = 9 AND rec_id = ?', [family.id]);

      // Insert updated date values
      if (family.marriedDate) {
        const [marYear, marMonth, marDay] = family.marriedDate.split('-').map(Number);
        if (!isNaN(marYear) && !isNaN(marMonth) && !isNaN(marDay)) {
          db.run('INSERT INTO ValuesDates (f_id, rec_table, rec_id, y, m, d) VALUES (?, 9, ?, ?, ?, ?)', [4, 9, family.id, marYear, marMonth, marDay]); // 4 is marriage date
        }
      }
      if (family.divorcedDate) {
        const [divYear, divMonth, divDay] = family.divorcedDate.split('-').map(Number);
        if (!isNaN(divYear) && !isNaN(divMonth) && !isNaN(divDay)) {
          db.run('INSERT INTO ValuesDates (f_id, rec_table, rec_id, y, m, d) VALUES (?, 9, ?, ?, ?, ?)', [5, 9, family.id, divYear, divMonth, divDay]); // 5 is divorce date
        }
      }

      // Delete existing string values in ValuesStr table for this family
      db.run('DELETE FROM ValuesStr WHERE rec_table = 9 AND rec_id = ?', [family.id]);

      // Insert updated string values
      if (family.familyName) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [50, 9, family.id, family.familyName]); // 50 is family name
      }
      if (family.husbandLastName) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [48, 9, family.id, family.husbandLastName]); // 48 is husband surname
      }
      if (family.wifeLastName) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [49, 9, family.id, family.wifeLastName]); // 49 is wife surname
      }
      if (family.comment) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [52, 9, family.id, family.comment]); // 52 is comment
      }
      if (family.notes) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 9, ?, ?)', [6, 9, family.id, family.notes]); // 6 is notes for family
      }
    }

    // Update places data - delete old values and insert new ones
    if (data.places && data.places.length > 0) {
      for (const place of data.places) {
        // Delete existing string values in ValuesStr table for this place (table code 14 for Places)
        db.run('DELETE FROM ValuesStr WHERE rec_table = 14 AND rec_id = ?', [place.id]);

        // Insert updated string values for the place
        if (place.name) {
          db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 14, ?, ?)', [93, 14, place.id, place.name]); // 93 is place name
        }
        if (place.shortName) {
          db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 14, ?, ?)', [94, 14, place.id, place.shortName]); // 94 is short name
        }
        if (place.comment) {
          db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 14, ?, ?)', [104, 14, place.id, place.comment]); // 104 is comment
        }

        // If the place doesn't exist in the Places table, add it
        const placeExists = db.prepare('SELECT id FROM Places WHERE id = ?');
        placeExists.bind([place.id]);
        if (!placeExists.step()) {
          // Place doesn't exist, so add it
          db.run('INSERT INTO Places (id) VALUES (?)', [place.id]);
        }
        placeExists.free();
      }
    }

    // Update events data - delete old values and insert new ones
    for (const event of data.events) {
      // Update the event type in the Events table
      let eventTypeValue = 1; // default
      if (typeof event.eventType === 'string' && event.eventType.startsWith('EventType')) {
        const match = event.eventType.match(/EventType(\d+)/);
        if (match) {
          eventTypeValue = parseInt(match[1]) || 1;
        }
      } else if (typeof event.eventType === 'number') {
        eventTypeValue = event.eventType;
      } else if (typeof event.eventType === 'string') {
        // If it's a descriptive string, we'd need to look up the corresponding ID
        // For now, default to 1
        eventTypeValue = 1;
      }

      db.run('UPDATE Events SET et_id = ? WHERE id = ?', [eventTypeValue, event.id]);

      // Delete existing linked values in ValuesLinks table for this event (table code 11 for Events)
      db.run('DELETE FROM ValuesLinks WHERE rec_table = 11 AND rec_id = ?', [event.id]);

      // Insert updated linked values
      // Note: We're using the old method for backward compatibility with some databases
      // but the main event-person relationships are handled through EventDetails
      if (event.personIds && event.personIds.length > 0) {
        // Use the first person ID for the old structure (for backward compatibility)
        const firstPersonId = event.personIds[0];
        if (firstPersonId) {
          db.run('INSERT INTO ValuesLinks (f_id, rec_table, rec_id, vlink_table, vlink_id) VALUES (?, 11, ?, 9, ?)', [1, 11, event.id, firstPersonId]); // 1 is person ID (link to Person table)
        }
      }

      // Delete existing date values in ValuesDates table for this event
      db.run('DELETE FROM ValuesDates WHERE rec_table = 11 AND rec_id = ?', [event.id]);

      // Insert updated date values
      if (event.date) {
        const [year, month, day] = event.date.split('-').map(Number);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          db.run('INSERT INTO ValuesDates (f_id, rec_table, rec_id, y, m, d) VALUES (?, 11, ?, ?, ?, ?)', [3, 11, event.id, year, month, day]); // 3 is event date
        }
      }

      // Delete existing string values in ValuesStr table for this event
      db.run('DELETE FROM ValuesStr WHERE rec_table = 11 AND rec_id = ?', [event.id]);

      // Insert updated string values
      if (event.place) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 11, ?, ?)', [4, 11, event.id, event.place]); // 4 is event place
      }
      if (event.description) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 11, ?, ?)', [5, 11, event.id, event.description]); // 5 is event description
      }

      // Handle EventDetails relationships for the current event
      if (event.personIds && event.personIds.length > 0) {
        // First, delete existing EventDetails records for this event
        db.run('DELETE FROM EventDetails WHERE e_id = ?', [event.id]);

        // Add each person to the event with proper order (p_ord)
        let order = 1;
        for (const personId of event.personIds) {
          // For now we'll use a default role ID of 1 (the person involved in the event)
          // In a more sophisticated system, we would determine the actual role from context
          db.run('INSERT INTO EventDetails (p_id, e_id, er_id, p_ord) VALUES (?, ?, 1, ?)', [personId, event.id, order]);
          order++;
        }
      }
    }

    // Now handle birth and death place links through EventDetails pathway
    // First, check if required tables exist
    const eventDetailsExists = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='EventDetails';").length > 0;
    const eventRolesExists = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='EventRoles';").length > 0;

    if (eventDetailsExists && eventRolesExists) {
      // Process each person to create/update event details for birth/death with places
      for (const person of data.persons) {
        // Handle birth place
        if (person.birthPlaceId) {
          // Find any existing birth event for this person
          const existingBirthEvent = db.exec(`
            SELECT ed.e_id as eventId, ed.er_id as eventRoleId
            FROM EventDetails ed
            JOIN EventRoles er ON ed.er_id = er.id
            WHERE ed.p_id = ? AND er.et_id = 1
          `, [person.id]);

          let birthEventId, birthEventRoleId;
          if (existingBirthEvent.length > 0) {
            // Use existing event and event role IDs
            birthEventId = existingBirthEvent[0].values[0][0];
            birthEventRoleId = existingBirthEvent[0].values[0][1];
          } else {
            // Create a new EventRoles entry for birth (et_id = 1)
            db.run('INSERT INTO EventRoles (et_id) VALUES (1)'); // 1 means birth event
            const lastRowResult = db.exec('SELECT last_insert_rowid()');
            birthEventRoleId = lastRowResult.length > 0 ? lastRowResult[0].values[0][0] : null;

            if (birthEventRoleId !== null) {
              // Create a new event entry
              db.run('INSERT INTO Events (et_id) VALUES (1)'); // 1 for birth event reference
              const lastEventRowResult = db.exec('SELECT last_insert_rowid()');
              birthEventId = lastEventRowResult.length > 0 ? lastEventRowResult[0].values[0][0] : null;

              if (birthEventId !== null) {
                // Link person to the new birth event in EventDetails with the event role
                db.run('INSERT INTO EventDetails (p_id, e_id, er_id) VALUES (?, ?, ?)', [person.id, birthEventId, birthEventRoleId]);
              }
            }
          }

          // Create or update the link from birth event to place
          if (birthEventId) {
            // Remove any existing place link for this event
            db.run('DELETE FROM ValuesLinks WHERE rec_table = 7 AND rec_id = ? AND vlink_table = 14', [birthEventId]);
            // Add the new place link (vlink_table = 14 for Places)
            db.run('INSERT INTO ValuesLinks (f_id, rec_table, rec_id, vlink_table, vlink_id) VALUES (1, 7, ?, 14, ?)', [birthEventId, person.birthPlaceId]);
          }
        }

        // Handle death place
        if (person.deathPlaceId) {
          // Find any existing death event for this person
          const existingDeathEvent = db.exec(`
            SELECT ed.e_id as eventId, ed.er_id as eventRoleId
            FROM EventDetails ed
            JOIN EventRoles er ON ed.er_id = er.id
            WHERE ed.p_id = ? AND er.et_id = 2
          `, [person.id]);

          let deathEventId, deathEventRoleId;
          if (existingDeathEvent.length > 0) {
            // Use existing event and event role IDs
            deathEventId = existingDeathEvent[0].values[0][0];
            deathEventRoleId = existingDeathEvent[0].values[0][1];
          } else {
            // Create a new EventRoles entry for death (et_id = 2)
            db.run('INSERT INTO EventRoles (et_id) VALUES (2)'); // 2 means death event
            const lastRowResult = db.exec('SELECT last_insert_rowid()');
            deathEventRoleId = lastRowResult.length > 0 ? lastRowResult[0].values[0][0] : null;

            if (deathEventRoleId !== null) {
              // Create a new event entry
              db.run('INSERT INTO Events (et_id) VALUES (2)'); // 2 for death event reference
              const lastEventRowResult = db.exec('SELECT last_insert_rowid()');
              deathEventId = lastEventRowResult.length > 0 ? lastEventRowResult[0].values[0][0] : null;

              if (deathEventId !== null) {
                // Link person to the new death event in EventDetails with the event role
                db.run('INSERT INTO EventDetails (p_id, e_id, er_id) VALUES (?, ?, ?)', [person.id, deathEventId, deathEventRoleId]);
              }
            }
          }

          // Create or update the link from death event to place
          if (deathEventId) {
            // Remove any existing place link for this event
            db.run('DELETE FROM ValuesLinks WHERE rec_table = 7 AND rec_id = ? AND vlink_table = 14', [deathEventId]);
            // Add the new place link (vlink_table = 14 for Places)
            db.run('INSERT INTO ValuesLinks (f_id, rec_table, rec_id, vlink_table, vlink_id) VALUES (1, 7, ?, 14, ?)', [deathEventId, person.deathPlaceId]);
          }
        }
      }
    }

    // Export the modified database to a buffer
    const dataArray = db.export();
    return dataArray; // Return Uint8Array directly
  } finally {
    // Close the database to free memory
    db.close();
  }
}