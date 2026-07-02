#!/usr/bin/env node

import assert from 'node:assert/strict';
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
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geneotools-rebuild-contract-'));
const requireFromScript = createRequire(import.meta.url);
const syntheticText = 'GeneoToolsContractValue';

function safeLog(message) {
  console.log(`[safe-atdb-rebuild-contract] ${message}`);
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

function scalar(db, sql, params = []) {
  return db.exec(sql, params)[0]?.values[0]?.[0];
}

function columnExists(db, tableName, columnName) {
  const result = db.exec(`PRAGMA table_info(${tableName})`);
  const nameIndex = result[0]?.columns.indexOf('name') ?? -1;
  if (nameIndex === -1) return false;
  return result[0].values.some((row) => row[nameIndex] === columnName);
}

function cloneParsed(parsed) {
  return structuredClone(parsed);
}

async function expectBuildFailure(label, action) {
  await assert.rejects(
    action,
    (error) => error?.name === 'AtdbBuildError' && error?.code === 'atdb.rebuild.failed',
    `${label} should fail with AtdbBuildError`,
  );
  safeLog(`${label}: blocked`);
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
  const parsed = await processor.parseAtdb(original);

  assert.ok(parsed.persons.length > 0, 'fixture has no persons');
  assert.ok(parsed.families.length > 0, 'fixture has no families');
  assert.ok(parsed.places.length > 1, 'fixture has too few places');
  assert.ok(parsed.events.length > 0, 'fixture has no events');

  const noop = await processor.buildAtdb(parsed, original);
  const noopParsed = await processor.parseAtdb(noop);
  assert.equal(noopParsed.persons.length, parsed.persons.length, 'noop person count changed');
  assert.equal(noopParsed.families.length, parsed.families.length, 'noop family count changed');
  assert.equal(noopParsed.events.length, parsed.events.length, 'noop event count changed');
  assert.equal(noopParsed.places.length, parsed.places.length, 'noop place count changed');
  safeLog('noop-build: ok');

  const db = new SQL.Database(original);
  const ownedLink = db.exec(
    `SELECT ed.p_id, ed.e_id, er.et_id, vl.vlink_id
     FROM EventDetails ed
     JOIN EventRoles er ON er.id = ed.er_id
     JOIN ValuesLinks vl ON vl.rec_table = ? AND vl.rec_id = ed.e_id AND vl.f_id = ? AND vl.vlink_table = ?
     WHERE er.ismain = 1 AND er.et_id IN (?, ?)
     LIMIT 1`,
    [
      mapping.tableCodes.events.code,
      mapping.fields.eventPlaceLink.id,
      mapping.tableCodes.places.code,
      mapping.eventTypes.birth.id,
      mapping.eventTypes.death.id,
    ],
  )[0]?.values[0];
  assert.ok(ownedLink, 'fixture has no primary life-event place link');
  const replacementPlaceId = scalar(db, 'SELECT id FROM Places WHERE id <> ? LIMIT 1', [ownedLink[3]]);
  assert.equal(typeof replacementPlaceId, 'number', 'fixture has no replacement place');
  const ownedDateType = scalar(
    db,
    'SELECT type FROM ValuesDates WHERE rec_table = ? AND rec_id = ? AND f_id = ? LIMIT 1',
    [mapping.tableCodes.events.code, ownedLink[1], mapping.fields.eventDate.id],
  );
  const ownedDateRowExists = scalar(
    db,
    'SELECT COUNT(*) FROM ValuesDates WHERE rec_table = ? AND rec_id = ? AND f_id = ?',
    [mapping.tableCodes.events.code, ownedLink[1], mapping.fields.eventDate.id],
  ) === 1;
  const canRunDateMetadataBlock = ownedDateRowExists && columnExists(db, 'ValuesDates', 'calendar');
  const canChangeOwnedDate = ownedDateType === undefined || ownedDateType === null || ownedDateType === 0;
  db.close();

  const personId = parsed.persons[0].id;
  const familyId = parsed.families[0].id;
  const placeId = parsed.places[0].id;
  const placeLinkField = ownedLink[2] === mapping.eventTypes.birth.id ? 'birthPlaceId' : 'deathPlaceId';
  const lifeEventDateField = ownedLink[2] === mapping.eventTypes.birth.id ? 'birthDate' : 'deathDate';
  const syntheticDate = '1801-02-03';
  const personFields = [
    { field: 'firstName', value: syntheticText },
    { field: 'birthLastName', value: `${syntheticText}Birth` },
    { field: 'gender', value: 'Unknown' },
  ];
  const ownedLinkPersonFields = [{ field: placeLinkField, value: replacementPlaceId }];
  if (canChangeOwnedDate) {
    ownedLinkPersonFields.push({ field: lifeEventDateField, value: syntheticDate });
  }
  const changeSet = {
    changes: [
      {
        entityType: 'person',
        id: personId,
        fields: personFields,
      },
      {
        entityType: 'family',
        id: familyId,
        fields: [
          { field: 'familyName', value: syntheticText },
          { field: 'color', value: 7 },
        ],
      },
      {
        entityType: 'place',
        id: placeId,
        fields: [
          { field: 'name', value: syntheticText },
          { field: 'shortName', value: '' },
          { field: 'parentId', value: null },
        ],
      },
      {
        entityType: 'event',
        id: ownedLink[1],
        fields: [{ field: 'placeId', value: replacementPlaceId }],
      },
      {
        entityType: 'person',
        id: ownedLink[0],
        fields: ownedLinkPersonFields,
      },
    ],
  };
  const explicitDiagnostics = [];
  let changed;
  try {
    changed = await processor.applyAtdbChanges(original, changeSet, {
      logger: (diagnostic) => explicitDiagnostics.push(diagnostic),
    });
  } catch (error) {
    safeLog(
      `explicit-change-set-diagnostics: ${explicitDiagnostics
        .filter((diagnostic) => diagnostic.level !== 'DEBUG')
        .map((diagnostic) => diagnostic.details?.reasonCode ?? diagnostic.code)
        .join(',')}`,
    );
    throw error;
  }
  const changedParsed = await processor.parseAtdb(changed);
  assert.equal(changedParsed.persons.find((person) => person.id === personId)?.firstName, syntheticText);
  assert.equal(changedParsed.persons.find((person) => person.id === personId)?.birthLastName, `${syntheticText}Birth`);
  assert.equal(changedParsed.persons.find((person) => person.id === personId)?.gender, 'Unknown');
  assert.equal(changedParsed.families.find((family) => family.id === familyId)?.familyName, syntheticText);
  assert.equal(changedParsed.families.find((family) => family.id === familyId)?.color, 7);
  assert.equal(changedParsed.places.find((place) => place.id === placeId)?.name, syntheticText);
  assert.equal(changedParsed.places.find((place) => place.id === placeId)?.shortName, '');
  assert.equal(changedParsed.places.find((place) => place.id === placeId)?.parentId, undefined);
  assert.equal(changedParsed.events.find((event) => event.id === ownedLink[1])?.placeId, replacementPlaceId);
  assert.equal(changedParsed.persons.find((person) => person.id === ownedLink[0])?.[placeLinkField], replacementPlaceId);
  if (canChangeOwnedDate) {
    assert.equal(changedParsed.persons.find((person) => person.id === ownedLink[0])?.[lifeEventDateField], syntheticDate);
  }
  safeLog('explicit-change-set: ok');

  const genderPerson = parsed.persons.find((person) => person.gender !== 'Unknown') ?? parsed.persons[0];
  assert.ok(genderPerson, 'fixture has no person for gender clear');
  const nullGender = await processor.applyAtdbChanges(original, {
    changes: [
      {
        entityType: 'person',
        id: genderPerson.id,
        fields: [{ field: 'gender', value: null }],
      },
    ],
  });
  const nullGenderParsed = await processor.parseAtdb(nullGender);
  assert.equal(nullGenderParsed.persons.find((person) => person.id === genderPerson.id)?.gender, 'Unknown');
  const undefinedGender = await processor.applyAtdbChanges(original, {
    changes: [
      {
        entityType: 'person',
        id: genderPerson.id,
        fields: [{ field: 'gender', value: undefined }],
      },
    ],
  });
  const undefinedGenderParsed = await processor.parseAtdb(undefinedGender);
  assert.equal(undefinedGenderParsed.persons.find((person) => person.id === genderPerson.id)?.gender, 'Unknown');
  safeLog('gender-clear: ok');

  await expectBuildFailure('create-entity', async () => {
    const candidate = cloneParsed(parsed);
    candidate.persons.push({ id: Number.MAX_SAFE_INTEGER, gender: 'Unknown', spouseIds: [] });
    await processor.buildAtdb(candidate, original);
  });

  await expectBuildFailure('delete-entity', async () => {
    const candidate = cloneParsed(parsed);
    candidate.persons.pop();
    await processor.buildAtdb(candidate, original);
  });

  await expectBuildFailure('event-type-change', async () => {
    const candidate = cloneParsed(parsed);
    candidate.events[0].eventType = 'EventType999999';
    await processor.buildAtdb(candidate, original);
  });

  await expectBuildFailure('metadata-change', async () => {
    const candidate = cloneParsed(parsed);
    candidate.metadata.version = (candidate.metadata.version ?? 0) + 1;
    await processor.buildAtdb(candidate, original);
  });

  await expectBuildFailure('unsupported-field-change', async () => {
    const candidate = cloneParsed(parsed);
    candidate.persons[0].notes = syntheticText;
    await processor.buildAtdb(candidate, original);
  });

  await expectBuildFailure('invalid-place-link', async () => {
    const candidate = cloneParsed(parsed);
    const targetPerson = candidate.persons.find((person) => person.id === ownedLink[0]);
    assert.ok(targetPerson, 'linked person missing');
    targetPerson[placeLinkField] = Number.MAX_SAFE_INTEGER;
    await processor.buildAtdb(candidate, original);
  });

  await expectBuildFailure('invalid-scalar-value', async () => {
    const candidate = cloneParsed(parsed);
    candidate.persons[0].gender = 'invalid';
    await processor.buildAtdb(candidate, original);
  });

  if (canRunDateMetadataBlock) {
    await expectBuildFailure('date-metadata-edit', async () => {
      const metadataDb = new SQL.Database(original);
      metadataDb.run(
        'UPDATE ValuesDates SET calendar = ? WHERE rec_table = ? AND rec_id = ? AND f_id = ?',
        [1, mapping.tableCodes.events.code, ownedLink[1], mapping.fields.eventDate.id],
      );
      const metadataBuffer = metadataDb.export();
      metadataDb.close();
      await processor.applyAtdbChanges(metadataBuffer, {
        changes: [
          {
            entityType: 'person',
            id: ownedLink[0],
            fields: [{ field: lifeEventDateField, value: syntheticDate }],
          },
        ],
      });
    });
  } else {
    safeLog('date-metadata-edit: skipped');
  }

  await expectBuildFailure('duplicate-ids', async () => {
    const candidate = cloneParsed(parsed);
    candidate.persons.push({ ...candidate.persons[0] });
    await processor.buildAtdb(candidate, original);
  });

  await expectBuildFailure('duplicate-field-changes', async () => {
    await processor.applyAtdbChanges(original, {
      changes: [
        {
          entityType: 'person',
          id: personId,
          fields: [
            { field: 'firstName', value: syntheticText },
            { field: 'firstName', value: `${syntheticText}2` },
          ],
        },
      ],
    });
  });

  await expectBuildFailure('invalid-entity-type', async () => {
    await processor.applyAtdbChanges(original, {
      changes: [
        {
          entityType: 'event',
          id: placeId,
          fields: [{ field: 'name', value: syntheticText }],
        },
      ],
    });
  });

  await expectBuildFailure('incompatible-fields-catalog', async () => {
    const mismatchDb = new SQL.Database(original);
    mismatchDb.run('UPDATE Fields SET tablecode = ? WHERE id = ?', [
      mapping.tableCodes.events.code,
      mapping.fields.personFirstName.id,
    ]);
    const mismatchBuffer = mismatchDb.export();
    mismatchDb.close();
    await processor.applyAtdbChanges(mismatchBuffer, {
      changes: [
        {
          entityType: 'person',
          id: personId,
          fields: [{ field: 'firstName', value: syntheticText }],
        },
      ],
    });
  });

  safeLog('status: success');
} catch (error) {
  safeLog('status: failure');
  safeLog(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
