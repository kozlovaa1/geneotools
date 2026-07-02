#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { createAtdbScriptHarness, withQuietProjectLogs } from './atdb-test-harness.mjs';

const projectRoot = process.cwd();
const mapping = JSON.parse(fs.readFileSync(path.join(projectRoot, 'lib/atdb/mapping.json'), 'utf8'));

function safeLog(message) {
  console.log(`[safe-atdb-parser-contract] ${message}`);
}

function runScenario(label, assertion) {
  try {
    assertion();
    safeLog(`scenario ${label}: success`);
  } catch {
    throw new Error(`scenario ${label}: failure`);
  }
}

function execStatements(db, statements) {
  for (const statement of statements) {
    db.run(statement);
  }
}

function insertRows(db, sql, rows) {
  for (const row of rows) {
    db.run(sql, row);
  }
}

function createSyntheticDatabase(SQL, roleIds) {
  const db = new SQL.Database();
  const tableCodes = mapping.tableCodes;
  const fields = mapping.fields;
  const eventTypes = mapping.eventTypes;

  execStatements(db, [
    'CREATE TABLE Global (id INTEGER PRIMARY KEY, version INTEGER, guid TEXT, srcguid TEXT, mainlang TEXT, params TEXT)',
    'CREATE TABLE Persons (id INTEGER PRIMARY KEY, sex INTEGER)',
    'CREATE TABLE Families (id INTEGER PRIMARY KEY, color INTEGER)',
    'CREATE TABLE Events (id INTEGER PRIMARY KEY, et_id INTEGER NOT NULL)',
    'CREATE TABLE EventDetails (id INTEGER PRIMARY KEY, p_id INTEGER NOT NULL, e_id INTEGER NOT NULL, er_id INTEGER NOT NULL, e_ord INTEGER, p_ord INTEGER)',
    'CREATE TABLE EventTypes (id INTEGER PRIMARY KEY, ord INTEGER NOT NULL)',
    'CREATE TABLE EventRoles (id INTEGER PRIMARY KEY, et_id INTEGER, maxcount INTEGER, ord INTEGER, roletype INTEGER, ismain INTEGER)',
    'CREATE TABLE Fields (id INTEGER PRIMARY KEY, tablecode INTEGER NOT NULL, datatype INTEGER, area TEXT, defval INTEGER, noautofill INTEGER, et_id INTEGER, et_ord INTEGER)',
    'CREATE TABLE ValuesDates (id INTEGER PRIMARY KEY, f_id INTEGER NOT NULL, rec_table INTEGER NOT NULL, rec_id INTEGER NOT NULL, y INTEGER, m INTEGER, d INTEGER, d2 INTEGER, m2 INTEGER, y2 INTEGER, calendar INTEGER, calendar2 INTEGER, type INTEGER, sorty INTEGER, sortm INTEGER, sortd INTEGER, sorty2 INTEGER, sortm2 INTEGER, sortd2 INTEGER, lconf INTEGER, ltrust INTEGER)',
    'CREATE TABLE ValuesLinks (id INTEGER PRIMARY KEY, f_id INTEGER NOT NULL, rec_table INTEGER NOT NULL, rec_id INTEGER NOT NULL, vlink_table INTEGER NOT NULL, vlink_id INTEGER NOT NULL)',
    'CREATE TABLE Places (id INTEGER PRIMARY KEY, parent_id INTEGER)',
    'CREATE TABLE ValuesStr (id INTEGER PRIMARY KEY, f_id INTEGER NOT NULL, rec_table INTEGER NOT NULL, rec_id INTEGER NOT NULL, vstr TEXT)',
  ]);

  insertRows(db, 'INSERT INTO Global (id, version, mainlang) VALUES (?, ?, ?)', [[1, 6, 'synthetic']]);
  insertRows(db, 'INSERT INTO EventTypes (id, ord) VALUES (?, ?)', [
    [eventTypes.birth.id, 1],
    [eventTypes.death.id, 2],
  ]);
  insertRows(db, 'INSERT INTO EventRoles (id, et_id, maxcount, ord, roletype, ismain) VALUES (?, ?, ?, ?, ?, ?)', [
    [roleIds.born, eventTypes.birth.id, 1, 1, 1, 1],
    [roleIds.father, eventTypes.birth.id, 1, 2, 2, 0],
    [roleIds.mother, eventTypes.birth.id, 1, 3, 2, 0],
    [roleIds.birthSecondary, eventTypes.birth.id, 0, 4, 3, 0],
    [roleIds.deceased, eventTypes.death.id, 1, 1, 1, 1],
  ]);

  insertRows(db, 'INSERT INTO Fields (id, tablecode, datatype, area, defval, noautofill, et_id, et_ord) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
    [fields.eventDate.id, tableCodes.events.code, fields.eventDate.datatype, null, null, null, eventTypes.birth.id, 1],
    [fields.eventPlaceLink.id, tableCodes.events.code, fields.eventPlaceLink.datatype, null, null, null, eventTypes.birth.id, 1],
    [fields.eventPlaceLinkAlternate.id, tableCodes.events.code, fields.eventPlaceLinkAlternate.datatype, null, null, null, eventTypes.birth.id, 2],
    [fields.placeName.id, tableCodes.places.code, fields.placeName.datatype, null, null, null, null, null],
    [fields.placeNamingDate.id, tableCodes.places.code, fields.placeNamingDate.datatype, null, null, null, null, null],
    [fields.personBirthLastName.id, tableCodes.persons.code, fields.personBirthLastName.datatype, null, null, null, null, null],
    [fields.personFirstName.id, tableCodes.persons.code, fields.personFirstName.datatype, null, null, null, null, null],
    [fields.personLastName.id, tableCodes.persons.code, fields.personLastName.datatype, null, null, null, null, null],
  ]);

  insertRows(db, 'INSERT INTO Persons (id, sex) VALUES (?, ?)', [
    [10, 1],
    [20, 1],
    [30, 2],
    [40, 0],
    [50, 2],
    [60, 1],
  ]);
  insertRows(db, 'INSERT INTO Families (id, color) VALUES (?, ?)', [[90, 3]]);
  insertRows(db, 'INSERT INTO Places (id, parent_id) VALUES (?, ?)', [[100, null], [200, 100]]);
  insertRows(db, 'INSERT INTO Events (id, et_id) VALUES (?, ?)', [
    [1000, eventTypes.birth.id],
    [2000, eventTypes.death.id],
    [3000, eventTypes.birth.id],
  ]);
  insertRows(db, 'INSERT INTO EventDetails (id, p_id, e_id, er_id, e_ord, p_ord) VALUES (?, ?, ?, ?, ?, ?)', [
    [1, 10, 1000, roleIds.born, 1, 1],
    [2, 20, 1000, roleIds.father, 1, 2],
    [3, 30, 1000, roleIds.mother, 1, 3],
    [4, 40, 1000, roleIds.birthSecondary, 1, 4],
    [5, 50, 2000, roleIds.deceased, 1, 1],
    [6, 60, 3000, roleIds.born, 1, 1],
  ]);
  insertRows(db, 'INSERT INTO ValuesDates (id, f_id, rec_table, rec_id, y, m, d, d2, m2, y2, calendar, calendar2, type, sorty, sortm, sortd, sorty2, sortm2, sortd2, lconf, ltrust) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
    [1, fields.eventDate.id, tableCodes.events.code, 1000, 1901, 2, 3, null, null, null, null, null, 0, null, null, null, null, null, null, null, null],
    [2, fields.eventDate.id, tableCodes.events.code, 2000, 1950, 0, 0, null, null, null, null, null, 0, null, null, null, null, null, null, null, null],
    [3, fields.placeNamingDate.id, tableCodes.places.code, 100, 1800, 0, 0, null, null, null, null, null, 0, null, null, null, null, null, null, null, null],
    [4, fields.eventDate.id, tableCodes.events.code, 3000, null, null, null, null, null, null, null, null, 3, null, null, null, null, null, null, null, null],
  ]);
  insertRows(db, 'INSERT INTO ValuesLinks (id, f_id, rec_table, rec_id, vlink_table, vlink_id) VALUES (?, ?, ?, ?, ?, ?)', [
    [1, fields.eventPlaceLink.id, tableCodes.events.code, 1000, tableCodes.places.code, 100],
    [2, fields.eventPlaceLink.id, tableCodes.events.code, 2000, tableCodes.places.code, 200],
  ]);
  insertRows(db, 'INSERT INTO ValuesStr (id, f_id, rec_table, rec_id, vstr) VALUES (?, ?, ?, ?, ?)', [
    [1, fields.placeName.id, tableCodes.places.code, 100, 'SyntheticBirthPlace'],
    [2, fields.placeName.id, tableCodes.places.code, 200, 'SyntheticDeathPlace'],
    [3, fields.personFirstName.id, tableCodes.persons.code, 10, 'SyntheticChild'],
    [4, fields.personLastName.id, tableCodes.persons.code, 10, 'SyntheticLine'],
    [5, fields.personBirthLastName.id, tableCodes.persons.code, 10, 'SyntheticBirthLine'],
  ]);

  return db;
}

function findById(rows, id) {
  const row = rows.find((entry) => entry.id === id);
  assert.ok(row, 'synthetic record missing');
  return row;
}

function assertParsedContract(parsed, diagnostics) {
  const child = findById(parsed.persons, 10);
  const secondary = findById(parsed.persons, 40);
  const deceased = findById(parsed.persons, 50);
  const nonSimpleDatePerson = findById(parsed.persons, 60);
  const birthEvent = findById(parsed.events, 1000);
  const deathEvent = findById(parsed.events, 2000);
  const birthPlace = findById(parsed.places, 100);
  const deathPlace = findById(parsed.places, 200);

  assert.equal(child.fatherId, 20, 'father role mismatch');
  assert.equal(child.motherId, 30, 'mother role mismatch');
  assert.equal(child.birthLastName, 'SyntheticBirthLine', 'birth last name mismatch');
  assert.equal(child.birthEventId, 1000, 'birth event id mismatch');
  assert.equal(deceased.deathEventId, 2000, 'death event id mismatch');
  assert.equal(child.birthDate, '1901-02-03', 'birth date mismatch');
  assert.equal(child.birthDateInfo?.isSimple, true, 'birth date null secondary metadata mismatch');
  assert.equal(child.birthPlaceId, 100, 'birth place mismatch');
  assert.equal(secondary.birthDate, undefined, 'secondary participant date mismatch');
  assert.equal(secondary.birthPlaceId, undefined, 'secondary participant place mismatch');
  assert.equal(deceased.deathDate, '1950-00-00', 'death date mismatch');
  assert.equal(deceased.deathDateInfo?.isSimple, true, 'death date null secondary metadata mismatch');
  assert.equal(deceased.deathPlaceId, 200, 'death place mismatch');
  assert.equal(nonSimpleDatePerson.birthEventId, 3000, 'non-simple date event id mismatch');
  assert.equal(nonSimpleDatePerson.birthDate, undefined, 'non-simple date value mismatch');
  assert.equal(nonSimpleDatePerson.birthDateInfo?.isSimple, false, 'non-simple date metadata mismatch');
  assert.deepEqual(birthEvent.personIds, [10, 20, 30, 40], 'birth participants mismatch');
  assert.equal(birthEvent.date, '1901-02-03', 'event birth date mismatch');
  assert.equal(birthEvent.placeId, 100, 'event birth place id mismatch');
  assert.equal(birthEvent.place, 'SyntheticBirthPlace (1800-00-00)', 'event birth place mismatch');
  assert.equal(deathEvent.date, '1950-00-00', 'event death date mismatch');
  assert.equal(deathEvent.placeId, 200, 'event death place id mismatch');
  assert.equal(deathEvent.place, 'SyntheticDeathPlace, SyntheticBirthPlace (1800-00-00)', 'event death place mismatch');
  assert.equal(birthPlace.placeNamingDate, '1800-00-00', 'place naming date mismatch');
  assert.equal(birthPlace.placeNamingDateInfo?.isSimple, true, 'place naming date null secondary metadata mismatch');
  assert.equal(deathPlace.parentId, 100, 'place parent id mismatch');
  assert.equal(deathPlace.parentPath, 'SyntheticBirthPlace (1800-00-00)', 'place parent path mismatch');

  for (const fieldName of ['eventDate', 'eventPlaceLink', 'placeName', 'placeNamingDate', 'personBirthLastName']) {
    assert.ok(
      diagnostics.some(
        (diagnostic) =>
          diagnostic.code === 'mapping.rule.resolved' &&
          diagnostic.details?.kind === 'field' &&
          diagnostic.details?.name === fieldName,
      ),
      `field rule did not resolve: ${fieldName}`,
    );
  }
}

async function parseSynthetic(SQL, parseAtdb, roleIds) {
  const db = createSyntheticDatabase(SQL, roleIds);
  const buffer = db.export();
  db.close();
  const diagnostics = [];
  const parsed = await withQuietProjectLogs(() => parseAtdb(buffer, { logger: (diagnostic) => diagnostics.push(diagnostic) }));
  return { parsed, diagnostics };
}

const harness = createAtdbScriptHarness({ tempPrefix: 'geneotools-atdb-parser-contract-' });

try {
  safeLog('status: start');
  harness.compileLib();
  const { parseAtdb } = harness.requireCompiled('lib/sqlProcessor.js');
  const SQL = await initSqlJs({ locateFile: (file) => path.join(projectRoot, 'node_modules/sql.js/dist', file) });

  const primary = await parseSynthetic(SQL, parseAtdb, {
    born: 101,
    father: 202,
    mother: 303,
    birthSecondary: 404,
    deceased: 505,
  });
  runScenario('primary-life-event-contract', () => assertParsedContract(primary.parsed, primary.diagnostics));

  const remapped = await parseSynthetic(SQL, parseAtdb, {
    born: 7001,
    father: 7002,
    mother: 7003,
    birthSecondary: 7004,
    deceased: 7005,
  });
  runScenario('remapped-role-ids', () => assertParsedContract(remapped.parsed, remapped.diagnostics));

  safeLog(`counts: persons=${primary.parsed.persons.length},events=${primary.parsed.events.length},places=${primary.parsed.places.length}`);
  safeLog('status: success');
} catch (error) {
  safeLog('status: failure');
  safeLog(`error: ${error instanceof Error ? error.message : 'unknown'}`);
  process.exitCode = 1;
} finally {
  harness.cleanup();
}
