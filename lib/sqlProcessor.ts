// This file handles sql.js operations and is designed to be imported dynamically
// to avoid server-side rendering issues

import { readEvents } from './atdb/readers/eventsReader';
import { readFamilies } from './atdb/readers/familiesReader';
import { readMetadata } from './atdb/readers/metadataReader';
import { readPersons } from './atdb/readers/personsReader';
import { readPlaces } from './atdb/readers/placesReader';
import { populatePersonPlaceNames, populateSpouseRelationships } from './atdb/readers/relationships';
import { createAtdbSchemaContext } from './atdb/schemaContext';
import type { AtdbDiagnosticLogger } from './atdb/diagnostics';
import { validateSqliteHeader } from './atdb/sqlHelpers';
import { writeEvents } from './atdb/writers/eventsWriter';
import { deriveFamiliesFromSpouseRelationships, writeFamilies } from './atdb/writers/familiesWriter';
import { writeLifeEventPlaceLinks } from './atdb/writers/lifeEventWriter';
import { writeMetadata } from './atdb/writers/metadataWriter';
import { writePersons } from './atdb/writers/personsWriter';
import { writePlaces } from './atdb/writers/placesWriter';
import type { ParsedAtdb } from './types';

export type { Event, Family, ParsedAtdb, Person, Place } from './types';

export interface AtdbProcessorOptions {
  logger?: AtdbDiagnosticLogger;
}

export async function parseAtdb(buffer: Uint8Array | Buffer, options: AtdbProcessorOptions = {}): Promise<ParsedAtdb> {
  const normalizedBuffer = buffer instanceof Buffer ? new Uint8Array(buffer) : buffer;
  validateSqliteHeader(normalizedBuffer);

  const { createDbFromBuffer } = await import('./initSqlJs');
  const db = await createDbFromBuffer(normalizedBuffer);

  try {
    const schema = createAtdbSchemaContext(db, options.logger);
    const metadata = readMetadata(db);
    const persons = readPersons(db, schema);
    const families = readFamilies(db, schema);
    const events = readEvents(db, schema);
    populateSpouseRelationships(persons, families);
    const places = readPlaces(db, schema);
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

export async function buildAtdb(
  data: ParsedAtdb,
  originalBuffer: Uint8Array | Buffer,
  options: AtdbProcessorOptions = {},
): Promise<Uint8Array> {
  const normalizedBuffer = originalBuffer instanceof Buffer ? new Uint8Array(originalBuffer) : originalBuffer;
  validateSqliteHeader(normalizedBuffer);
  const { createDbFromBuffer } = await import('./initSqlJs');
  const db = await createDbFromBuffer(normalizedBuffer);

  try {
    const schema = createAtdbSchemaContext(db, options.logger);
    writeMetadata(db, data.metadata);
    writePersons(db, data.persons, schema);
    deriveFamiliesFromSpouseRelationships(data.persons, data.families);
    writeFamilies(db, data.families, schema);
    writePlaces(db, data.places, schema);
    writeEvents(db, data.events, schema);
    writeLifeEventPlaceLinks(db, data.persons, schema);

    return db.export();
  } finally {
    db.close();
  }
}
