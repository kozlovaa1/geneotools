/**
 * Parses .atdb files (Ancestral Tree database format used by "Древо Жизни 6" / Agelong Tree 6 program)
 * The .atdb format is actually an uncompressed SQLite database, not a proprietary binary format.
 */

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
}

export interface Place {
  id: number;
  name?: string;
  shortName?: string;
  comment?: string;
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
}

export interface Event {
  id: number;
  personIds?: number[];
  eventType: string; // Birth, Death, Marriage, etc.
  date?: string; // Format: YYYY-MM-DD
  place?: string;
  description?: string;
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