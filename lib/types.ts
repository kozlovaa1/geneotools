export interface AtdbDateMetadata {
  y: number | null;
  m: number | null;
  d: number | null;
  y2?: number | null;
  m2?: number | null;
  d2?: number | null;
  calendar?: number | null;
  calendar2?: number | null;
  type?: number | null;
  sortY?: number | null;
  sortM?: number | null;
  sortD?: number | null;
  sortY2?: number | null;
  sortM2?: number | null;
  sortD2?: number | null;
  lconf?: number | null;
  ltrust?: number | null;
}

export interface AtdbDateValue {
  value?: string;
  display: string;
  metadata: AtdbDateMetadata;
  isSimple: boolean;
  diagnosticCode?: string;
}

export interface Person {
  id: number;
  firstName?: string;
  lastName?: string;
  birthLastName?: string;
  patronymic?: string;
  gender: 'M' | 'F' | 'Unknown';
  birthDate?: string;
  birthDateInfo?: AtdbDateValue;
  deathDate?: string;
  deathDateInfo?: AtdbDateValue;
  birthPlace?: string;
  deathPlace?: string;
  birthPlaceId?: number;
  deathPlaceId?: number;
  birthEventId?: number;
  deathEventId?: number;
  notes?: string;
  fatherId?: number;
  motherId?: number;
  spouseIds?: number[];
  occupation?: string;
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
  dateInfo?: AtdbDateValue;
  place?: string;
  placeId?: number;
  description?: string;
}

export interface Place {
  id: number;
  name?: string;
  shortName?: string;
  comment?: string;
  parentId?: number;
  parentPath?: string;
  placeNamingDate?: string;
  placeNamingDateInfo?: AtdbDateValue;
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
