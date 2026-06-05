import { ATDB_MAPPING } from './mapping';

export const SQLITE_HEADER_PREFIX = 'SQLite format 3';
export const SQLITE_HEADER_LENGTH = 16;

export const TABLE_CODES = {
  events: ATDB_MAPPING.tableCodes.events.code,
  families: ATDB_MAPPING.tableCodes.families.code,
  persons: ATDB_MAPPING.tableCodes.persons.code,
  places: ATDB_MAPPING.tableCodes.places.code,
} as const;

export const EVENT_TYPE_IDS = {
  birth: ATDB_MAPPING.eventTypes.birth.id,
  death: ATDB_MAPPING.eventTypes.death.id,
} as const;

export const FAMILY_FIELD_IDS = {
  husbandLastName: ATDB_MAPPING.fields.familyHusbandLastName.id,
  wifeLastName: ATDB_MAPPING.fields.familyWifeLastName.id,
  familyName: ATDB_MAPPING.fields.familyName.id,
  comment: ATDB_MAPPING.fields.familyComment.id,
} as const;

export const PLACE_FIELD_IDS = {
  name: ATDB_MAPPING.fields.placeName.id,
  shortName: ATDB_MAPPING.fields.placeShortName.id,
  comment: ATDB_MAPPING.fields.placeComment.id,
} as const;
