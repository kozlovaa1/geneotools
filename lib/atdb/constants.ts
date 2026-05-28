export const SQLITE_HEADER_PREFIX = 'SQLite format 3';
export const SQLITE_HEADER_LENGTH = 16;

export const TABLE_CODES = {
  eventDetails: 7,
  persons: 9,
  events: 11,
  families: 13,
  places: 14,
} as const;

export const EVENT_TYPE_IDS = {
  birth: 1,
  death: 2,
} as const;

export const EVENT_DETAIL_ROLE_IDS = {
  bornPerson: 1,
  father: 2,
  mother: 3,
} as const;

export const FAMILY_FIELD_IDS = {
  husbandLastName: 48,
  wifeLastName: 49,
  familyName: 50,
  comment: 52,
} as const;

export const PLACE_FIELD_IDS = {
  name: 93,
  shortName: 94,
  comment: 104,
} as const;
