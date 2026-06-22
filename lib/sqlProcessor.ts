// This file handles sql.js operations and is designed to be imported dynamically
// to avoid server-side rendering issues

import { readEvents } from './atdb/readers/eventsReader';
import { readFamilies } from './atdb/readers/familiesReader';
import { readMetadata } from './atdb/readers/metadataReader';
import { readPersons } from './atdb/readers/personsReader';
import { readPlaces } from './atdb/readers/placesReader';
import { populatePersonPlaceNames, populateSpouseRelationships } from './atdb/readers/relationships';
import { createAtdbSchemaContext } from './atdb/schemaContext';
import { silentAtdbLogger, type AtdbDiagnosticLogger } from './atdb/diagnostics';
import { validateSqliteHeader } from './atdb/sqlHelpers';
import {
  type AtdbBuildOptions,
  type AtdbChangeSet,
  AtdbBuildError,
  formatAtdbBuildError,
} from './atdb/rebuildContract';
import { createCompatibilityChangeSet } from './atdb/rebuildDiff';
import {
  collectProtectedFingerprints,
  validateAtdbChangeSetPreflight,
  validateAtdbPostBuild,
} from './atdb/rebuildValidation';
import { runAtdbTransaction } from './atdb/transaction';
import { writeFamilyChanges } from './atdb/writers/familiesWriter';
import { writeLifeEventPlaceLinkChanges } from './atdb/writers/lifeEventWriter';
import { writePersonChanges } from './atdb/writers/personsWriter';
import { writePlaceChanges } from './atdb/writers/placesWriter';
import type { SqlJsDatabase } from './atdb/dbTypes';
import type { ParsedAtdb } from './types';

export type { Event, Family, ParsedAtdb, Person, Place } from './types';
export type {
  AtdbBuildIssue,
  AtdbBuildOptions,
  AtdbBuildReport,
  AtdbChangeSet,
  AtdbEntityChange,
  AtdbFieldChange,
  SafeAtdbBuildError,
} from './atdb/rebuildContract';
export { AtdbBuildError, formatAtdbBuildError };

export interface AtdbProcessorOptions extends AtdbBuildOptions {
  logger?: AtdbDiagnosticLogger;
}

function readParsedAtdbFromDb(db: SqlJsDatabase, logger: AtdbDiagnosticLogger): ParsedAtdb {
  const schema = createAtdbSchemaContext(db, logger);
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
    metadata,
  };
}

export async function parseAtdb(buffer: Uint8Array | Buffer, options: AtdbProcessorOptions = {}): Promise<ParsedAtdb> {
  const normalizedBuffer = buffer instanceof Buffer ? new Uint8Array(buffer) : buffer;
  validateSqliteHeader(normalizedBuffer);

  const { createDbFromBuffer } = await import('./initSqlJs');
  const db = await createDbFromBuffer(normalizedBuffer);

  try {
    return readParsedAtdbFromDb(db, options.logger ?? silentAtdbLogger);
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
  const original = await parseAtdb(normalizedBuffer, options);
  const { changeSet } = createCompatibilityChangeSet(data, original, options);
  return applyAtdbChanges(normalizedBuffer, changeSet, options);
}

export async function applyAtdbChanges(
  originalBuffer: Uint8Array | Buffer,
  changeSet: AtdbChangeSet,
  options: AtdbProcessorOptions = {},
): Promise<Uint8Array> {
  const normalizedBuffer = originalBuffer instanceof Buffer ? new Uint8Array(originalBuffer) : originalBuffer;
  validateSqliteHeader(normalizedBuffer);

  const { createDbFromBuffer } = await import('./initSqlJs');
  const db = await createDbFromBuffer(normalizedBuffer);
  const logger = options.logger ?? silentAtdbLogger;

  try {
    const schema = createAtdbSchemaContext(db, logger);
    const original = readParsedAtdbFromDb(db, logger);
    validateAtdbChangeSetPreflight(db, changeSet, schema, options);
    const beforeFingerprints = collectProtectedFingerprints(db, changeSet, schema);

    await runAtdbTransaction(db, 'strict-rebuild', logger, async () => {
      writePersonChanges(db, changeSet, schema);
      writeFamilyChanges(db, changeSet, schema);
      writePlaceChanges(db, changeSet, schema);
      writeLifeEventPlaceLinkChanges(db, changeSet, schema);
    });

    const rebuiltBuffer = db.export();
    const rebuilt = await parseAtdb(rebuiltBuffer, options);
    validateAtdbPostBuild(db, original, rebuilt, changeSet, beforeFingerprints, schema, options);
    return rebuiltBuffer;
  } finally {
    db.close();
  }
}
