export interface Person {
  id: number;
  firstName?: string;
  lastName?: string;
  patronymic?: string;
  gender: 'M' | 'F' | 'Unknown';
  birthDate?: string;
  deathDate?: string;
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
  familyName?: string;
  husbandLastName?: string;
  wifeLastName?: string;
  comment?: string;
  husbandId?: number;
  wifeId?: number;
  childrenIds: number[];
  marriedDate?: string;
  divorcedDate?: string;
  notes?: string;
  color?: number;
}

export interface Event {
  id: number;
  personIds?: number[];
  eventType: string;
  date?: string;
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
