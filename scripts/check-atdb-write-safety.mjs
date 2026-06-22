#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import initSqlJs from 'sql.js';
import { createRequire } from 'node:module';
import { resolveFixtureByLabel } from './atdb-fixtures.mjs';

const projectRoot = process.cwd();
const fixture = resolveFixtureByLabel(projectRoot, 'yaman');
const mapping = JSON.parse(fs.readFileSync(path.join(projectRoot, 'lib/atdb/mapping.json'), 'utf8'));
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geneotools-write-safety-'));
const requireFromScript = createRequire(import.meta.url);

function safeLog(message) {
  console.log(`[safe-atdb-write-safety] ${message}`);
}

function compileTree(sourceDir, outputDir) {
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const output = path.join(outputDir, entry.name);
    if (entry.isDirectory()) compileTree(source, output);
    else if (entry.name.endsWith('.ts')) {
      const compiled = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
        compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      });
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output.replace(/\.ts$/, '.js'), compiled.outputText);
    } else if (entry.name.endsWith('.json')) {
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.copyFileSync(source, output);
    }
  }
}

function hashUnknownValues(db) {
  const owned = new Set(
    Object.values(mapping.fields)
      .filter((rule) => rule.write && rule.confidence === 'invariant')
      .map((rule) => {
        const target = rule.linkTarget ? `:${mapping.tableCodes[rule.linkTarget].code}` : '';
        return `${rule.valueTable}:${mapping.tableCodes[rule.entity].code}:${rule.id}${target}`;
      }),
  );
  const hash = crypto.createHash('sha256');
  let count = 0;
  for (const table of ['ValuesStr', 'ValuesNum', 'ValuesDates', 'ValuesLinks']) {
    const result = db.exec(`SELECT * FROM ${table} ORDER BY id`);
    if (!result[0]) continue;
    const columns = result[0].columns;
    for (const values of result[0].values) {
      const row = Object.fromEntries(columns.map((column, index) => [column, values[index]]));
      const target = table === 'ValuesLinks' ? `:${row.vlink_table}` : '';
      if (!owned.has(`${table}:${row.rec_table}:${row.f_id}${target}`)) {
        hash.update(JSON.stringify(row));
        count++;
      }
    }
  }
  return { count, digest: hash.digest('hex') };
}

function hashRows(db, table, whereClause, params) {
  const hash = crypto.createHash('sha256');
  const result = db.exec(`SELECT * FROM ${table} WHERE ${whereClause} ORDER BY id`, params);
  let count = 0;
  if (result[0]) {
    for (const values of result[0].values) {
      hash.update(JSON.stringify(values));
      count++;
    }
  }
  return { count, digest: hash.digest('hex') };
}

function scalar(db, sql, params = []) {
  return db.exec(sql, params)[0]?.values[0]?.[0];
}

try {
  safeLog('status: start');
  if (!fs.existsSync(fixture.absolutePath)) {
    safeLog('status: skipped');
    safeLog('reason: fixture missing');
    process.exit(0);
  }
  fs.symlinkSync(path.join(projectRoot, 'node_modules'), path.join(tempDir, 'node_modules'), 'dir');
  compileTree(path.join(projectRoot, 'lib'), path.join(tempDir, 'lib'));
  const processor = requireFromScript(path.join(tempDir, 'lib/sqlProcessor.js'));
  const SQL = await initSqlJs({ locateFile: (file) => path.join(projectRoot, 'node_modules/sql.js/dist', file) });
  const original = new Uint8Array(fs.readFileSync(fixture.absolutePath));
  const beforeDb = new SQL.Database(original);
  const beforeUnknown = hashUnknownValues(beforeDb);
  const beforeRoles = beforeDb.exec('SELECT COUNT(*) FROM EventRoles')[0].values[0][0];
  const beforeOwnedEventPlaces = hashRows(
    beforeDb,
    'ValuesLinks',
    'f_id = ? AND rec_table = ? AND vlink_table = ?',
    [mapping.fields.eventPlaceLink.id, mapping.tableCodes.events.code, mapping.tableCodes.places.code],
  );
  beforeDb.close();

  const mappingDiagnostics = [];
  const parsed = await processor.parseAtdb(original, { logger: (diagnostic) => mappingDiagnostics.push(diagnostic) });
  assert.ok(
    mappingDiagnostics.some(
      (diagnostic) => diagnostic.code === 'mapping.rule.resolved' && diagnostic.details?.confidence === 'invariant',
    ),
    'missing invariant mapping resolution diagnostic',
  );
  assert.equal(
    mappingDiagnostics.filter((diagnostic) => diagnostic.code === 'mapping.legacy-fallback.used').length,
    3,
    'legacy fallback diagnostics were not cached per schema context',
  );
  const rebuilt = await processor.buildAtdb(parsed, original);
  const afterDb = new SQL.Database(rebuilt);
  const afterUnknown = hashUnknownValues(afterDb);
  const afterRoles = afterDb.exec('SELECT COUNT(*) FROM EventRoles')[0].values[0][0];
  const afterOwnedEventPlaces = hashRows(
    afterDb,
    'ValuesLinks',
    'f_id = ? AND rec_table = ? AND vlink_table = ?',
    [mapping.fields.eventPlaceLink.id, mapping.tableCodes.events.code, mapping.tableCodes.places.code],
  );
  afterDb.close();

  assert.equal(afterUnknown.count, beforeUnknown.count, 'unknown Values* count changed');
  assert.equal(afterUnknown.digest, beforeUnknown.digest, 'unknown Values* content changed');
  assert.equal(afterRoles, beforeRoles, 'EventRoles count changed');
  assert.deepEqual(afterOwnedEventPlaces, beforeOwnedEventPlaces, 'unchanged owned event places changed');

  const remappedRolesDb = new SQL.Database(original);
  remappedRolesDb.run('UPDATE EventDetails SET er_id = er_id + 1000 WHERE er_id IN (1, 2, 3)');
  remappedRolesDb.run('UPDATE EventRoles SET id = id + 1000 WHERE id IN (1, 2, 3)');
  const remappedParsed = await processor.parseAtdb(remappedRolesDb.export());
  remappedRolesDb.close();
  assert.deepEqual(
    remappedParsed.persons.map((person) => [person.id, person.fatherId ?? null, person.motherId ?? null]),
    parsed.persons.map((person) => [person.id, person.fatherId ?? null, person.motherId ?? null]),
    'parent role semantics depend on numeric role IDs',
  );

  const secondaryParticipantDb = new SQL.Database(original);
  const secondaryParticipant = secondaryParticipantDb.exec(
    `SELECT ed.p_id, ed.e_id
     FROM EventDetails ed
     JOIN EventRoles er ON er.id = ed.er_id
     JOIN ValuesLinks vl ON vl.rec_table = ? AND vl.rec_id = ed.e_id AND vl.f_id = ? AND vl.vlink_table = ?
     WHERE er.et_id = ? AND (er.ismain IS NULL OR er.ismain <> 1)
     LIMIT 1`,
    [mapping.tableCodes.events.code, mapping.fields.eventPlaceLink.id, mapping.tableCodes.places.code, mapping.eventTypes.birth.id],
  )[0]?.values[0];
  assert.ok(secondaryParticipant, 'fixture has no secondary birth participant with a place');
  secondaryParticipantDb.run(
    `DELETE FROM EventDetails
     WHERE p_id = ? AND er_id IN (SELECT id FROM EventRoles WHERE et_id = ? AND ismain = 1)`,
    [secondaryParticipant[0], mapping.eventTypes.birth.id],
  );
  const secondaryParticipantBuffer = secondaryParticipantDb.export();
  secondaryParticipantDb.close();
  const secondaryParticipantParsed = await processor.parseAtdb(secondaryParticipantBuffer);
  const secondaryPerson = secondaryParticipantParsed.persons.find((person) => person.id === secondaryParticipant[0]);
  assert.ok(secondaryPerson, 'secondary birth participant was not parsed');
  assert.equal(secondaryPerson.birthPlaceId, undefined, 'secondary birth participant inherited child event place');
  const secondaryReplacementDb = new SQL.Database(original);
  secondaryPerson.birthPlaceId = scalar(
    secondaryReplacementDb,
    'SELECT id FROM Places WHERE id <> (SELECT vlink_id FROM ValuesLinks WHERE rec_table = ? AND rec_id = ? AND f_id = ? AND vlink_table = ? LIMIT 1) LIMIT 1',
    [mapping.tableCodes.events.code, secondaryParticipant[1], mapping.fields.eventPlaceLink.id, mapping.tableCodes.places.code],
  );
  secondaryReplacementDb.close();
  assert.equal(typeof secondaryPerson.birthPlaceId, 'number', 'fixture has no replacement place for secondary participant');
  await assert.rejects(
    () => processor.buildAtdb(secondaryParticipantParsed, secondaryParticipantBuffer),
    (error) => error?.name === 'AtdbBuildError' && error?.code === 'atdb.rebuild.failed',
    'secondary birth participant write should be blocked',
  );

  const foreignLinkDb = new SQL.Database(original);
  const eventPlace = mapping.fields.eventPlaceLink;
  const eventTable = mapping.tableCodes.events.code;
  const placeTable = mapping.tableCodes.places.code;
  const linkRow = foreignLinkDb.exec(
    'SELECT rec_id, vlink_id FROM ValuesLinks WHERE f_id = ? AND rec_table = ? AND vlink_table = ? LIMIT 1',
    [eventPlace.id, eventTable, placeTable],
  )[0]?.values[0];
  assert.ok(linkRow, 'fixture has no event place link for target ownership regression');
  foreignLinkDb.run(
    'INSERT INTO ValuesLinks (f_id, rec_table, rec_id, vlink_table, vlink_id) VALUES (?, ?, ?, ?, ?)',
    [eventPlace.id, eventTable, linkRow[0], eventTable, linkRow[0]],
  );
  const foreignLinkBefore = hashRows(
    foreignLinkDb,
    'ValuesLinks',
    'f_id = ? AND rec_table = ? AND rec_id = ? AND vlink_table = ?',
    [eventPlace.id, eventTable, linkRow[0], eventTable],
  );
  const foreignLinkBuffer = foreignLinkDb.export();
  foreignLinkDb.close();
  const foreignLinkParsed = await processor.parseAtdb(foreignLinkBuffer);
  const foreignLinkRebuilt = await processor.buildAtdb(foreignLinkParsed, foreignLinkBuffer);
  const foreignLinkAfterDb = new SQL.Database(foreignLinkRebuilt);
  const foreignLinkAfter = hashRows(
    foreignLinkAfterDb,
    'ValuesLinks',
    'f_id = ? AND rec_table = ? AND rec_id = ? AND vlink_table = ?',
    [eventPlace.id, eventTable, linkRow[0], eventTable],
  );
  foreignLinkAfterDb.close();
  assert.deepEqual(foreignLinkAfter, foreignLinkBefore, 'foreign ValuesLinks target was changed');

  const ownedLinkDb = new SQL.Database(original);
  const ownedLink = ownedLinkDb.exec(
    `SELECT ed.p_id, ed.e_id, er.et_id, vl.vlink_id
     FROM EventDetails ed
     JOIN EventRoles er ON er.id = ed.er_id
     JOIN ValuesLinks vl ON vl.rec_table = ? AND vl.rec_id = ed.e_id AND vl.f_id = ? AND vl.vlink_table = ?
     WHERE er.ismain = 1 AND er.et_id IN (?, ?)
     LIMIT 1`,
    [eventTable, eventPlace.id, placeTable, mapping.eventTypes.birth.id, mapping.eventTypes.death.id],
  )[0]?.values[0];
  assert.ok(ownedLink, 'fixture has no primary life-event place link');
  const replacementPlaceId = scalar(ownedLinkDb, 'SELECT id FROM Places WHERE id <> ? LIMIT 1', [ownedLink[3]]);
  assert.equal(typeof replacementPlaceId, 'number', 'fixture has no replacement place');
  ownedLinkDb.close();

  const updatedPlaceParsed = await processor.parseAtdb(original);
  const updatedPlacePerson = updatedPlaceParsed.persons.find((person) => person.id === ownedLink[0]);
  assert.ok(updatedPlacePerson, 'primary life-event person was not parsed');
  const placeProperty = ownedLink[2] === mapping.eventTypes.birth.id ? 'birthPlaceId' : 'deathPlaceId';
  updatedPlacePerson[placeProperty] = replacementPlaceId;
  const updatedPlaceBuffer = await processor.buildAtdb(updatedPlaceParsed, original);
  const updatedPlaceDb = new SQL.Database(updatedPlaceBuffer);
  assert.equal(
    scalar(
      updatedPlaceDb,
      'SELECT vlink_id FROM ValuesLinks WHERE rec_table = ? AND rec_id = ? AND f_id = ? AND vlink_table = ? LIMIT 1',
      [eventTable, ownedLink[1], eventPlace.id, placeTable],
    ),
    replacementPlaceId,
    'primary life-event place was not updated',
  );
  updatedPlaceDb.close();

  const removedPlaceParsed = await processor.parseAtdb(original);
  const removedPlacePerson = removedPlaceParsed.persons.find((person) => person.id === ownedLink[0]);
  assert.ok(removedPlacePerson, 'primary life-event person was not parsed for removal');
  removedPlacePerson[placeProperty] = undefined;
  const removedPlaceBuffer = await processor.buildAtdb(removedPlaceParsed, original);
  const removedPlaceDb = new SQL.Database(removedPlaceBuffer);
  assert.equal(
    scalar(
      removedPlaceDb,
      'SELECT COUNT(*) FROM ValuesLinks WHERE rec_table = ? AND rec_id = ? AND f_id = ? AND vlink_table = ?',
      [eventTable, ownedLink[1], eventPlace.id, placeTable],
    ),
    0,
    'primary life-event place was not removed',
  );
  removedPlaceDb.close();

  const personFirstName = mapping.fields.personFirstName;
  for (const [column, incompatibleValue] of [['tablecode', mapping.tableCodes.events.code], ['datatype', 12]]) {
    const mismatchDb = new SQL.Database(original);
    mismatchDb.run(`UPDATE Fields SET ${column} = ? WHERE id = ?`, [incompatibleValue, personFirstName.id]);
    const mismatchBuffer = mismatchDb.export();
    mismatchDb.close();
    const diagnostics = [];
    await assert.rejects(
      () => processor.buildAtdb(parsed, mismatchBuffer, { logger: (diagnostic) => diagnostics.push(diagnostic) }),
      (error) => error?.name === 'AtdbBuildError' && error?.code === 'atdb.rebuild.failed',
      `incompatible Fields.${column} mapping should be blocked`,
    );
    assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 'field.write.skipped'), `missing Fields.${column} skip diagnostic`);
  }

  const optionalSchemaDb = new SQL.Database(original);
  optionalSchemaDb.run('DROP TABLE EventDetails');
  optionalSchemaDb.run('DROP TABLE ValuesDates');
  optionalSchemaDb.run('DROP TABLE ValuesLinks');
  const optionalSchemaParsed = await processor.parseAtdb(optionalSchemaDb.export());
  optionalSchemaDb.close();
  assert.equal(optionalSchemaParsed.persons.length, parsed.persons.length, 'optional tables changed person count');
  assert.equal(optionalSchemaParsed.events.length, parsed.events.length, 'optional tables changed event count');

  safeLog(`unknown-values: ${afterUnknown.count}`);
  safeLog(`event-roles: ${afterRoles}`);
  safeLog('remapped-role-ids: ok');
  safeLog('secondary-life-event-role: blocked');
  safeLog('foreign-link-target: preserved');
  safeLog('owned-life-event-place: update-and-remove-ok');
  safeLog('incompatible-field-mapping: blocked');
  safeLog('optional-schema-read: ok');
  safeLog('mapping-diagnostics: ok');
  safeLog('status: success');
} catch (error) {
  safeLog('status: failure');
  safeLog(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
