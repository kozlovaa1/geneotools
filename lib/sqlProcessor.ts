// This file handles sql.js operations and is designed to be imported dynamically
// to avoid server-side rendering issues

import { readFieldDefinitions } from './atdb/fieldDefinitions';
import { readEvents } from './atdb/readers/eventsReader';
import { readFamilies } from './atdb/readers/familiesReader';
import { readMetadata } from './atdb/readers/metadataReader';
import { readPersons } from './atdb/readers/personsReader';
import { readPlaces } from './atdb/readers/placesReader';
import { populatePersonPlaceNames, populateSpouseRelationships } from './atdb/readers/relationships';
import { validateSqliteHeader } from './atdb/sqlHelpers';
import { writeEvents } from './atdb/writers/eventsWriter';
import { deriveFamiliesFromSpouseRelationships, writeFamilies } from './atdb/writers/familiesWriter';
import { writeLifeEventPlaceLinks } from './atdb/writers/lifeEventWriter';
import { writeMetadata } from './atdb/writers/metadataWriter';
import { writePersons } from './atdb/writers/personsWriter';
import { writePlaces } from './atdb/writers/placesWriter';
import type { ParsedAtdb } from './types';

export type { Event, Family, ParsedAtdb, Person, Place } from './types';

export async function parseAtdb(buffer: Uint8Array | Buffer): Promise<ParsedAtdb> {
  const normalizedBuffer = buffer instanceof Buffer ? new Uint8Array(buffer) : buffer;
  validateSqliteHeader(normalizedBuffer);

  const { createDbFromBuffer } = await import('./initSqlJs');
  const db = await createDbFromBuffer(normalizedBuffer);

  try {
    const fieldDefinitions = readFieldDefinitions(db);
    const metadata = readMetadata(db);
    const persons = readPersons(db, fieldDefinitions);
    const families = readFamilies(db);
    const events = readEvents(db);
    populateSpouseRelationships(persons, families);
    const places = readPlaces(db);
    populatePersonPlaceNames(persons, places);

    return {
      persons,
      families,
      events,
      places,
      metadata
    };
  } finally {
    db.close();
  }
}

export async function buildAtdb(data: ParsedAtdb, originalBuffer: Uint8Array | Buffer): Promise<Uint8Array> {
  const { createDbFromBuffer } = await import('./initSqlJs');
  const db = await createDbFromBuffer(originalBuffer instanceof Buffer ? new Uint8Array(originalBuffer) : originalBuffer);

  try {
    writeMetadata(db, data.metadata);
    writePersons(db, data.persons);
    deriveFamiliesFromSpouseRelationships(data.persons, data.families);
    writeFamilies(db, data.families);
    writePlaces(db, data.places);
    writeEvents(db, data.events);
    writeLifeEventPlaceLinks(db, data.persons);

    return db.export();
  } finally {
    db.close();
  }
}
