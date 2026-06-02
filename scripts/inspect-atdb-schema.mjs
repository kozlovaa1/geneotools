#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import initSqlJs from 'sql.js';
import {
  defaultFixtureLabel,
  resolveFixtureByFileName,
  resolveFixtureByLabel,
  safeRelativePath,
} from './atdb-fixtures.mjs';

const projectRoot = process.cwd();
const args = process.argv.slice(2);
const outputFlagIndex = args.findIndex((arg) => arg === '--output');
const outputFlagValue = outputFlagIndex >= 0 ? args[outputFlagIndex + 1] : undefined;
const inlineOutputArg = args.find((arg) => arg.startsWith('--output='));
const fixtureFlagIndex = args.findIndex((arg) => arg === '--fixture');
const fixtureFlagValue = fixtureFlagIndex >= 0 ? args[fixtureFlagIndex + 1] : undefined;
const inlineFixtureArg = args.find((arg) => arg.startsWith('--fixture='));
const checkOnly = args.includes('--check');
const checkYaman = args.includes('--check-yaman');
const snapshotCheck = args.includes('--snapshot-check');
const verbose = args.includes('--verbose') || args.includes('--debug') || process.env.LOG_LEVEL === 'debug';
const positionalArgs = args.filter((arg, index) => {
  if (arg.startsWith('--')) {
    return false;
  }
  return !(
    (outputFlagIndex >= 0 && index === outputFlagIndex + 1) ||
    (fixtureFlagIndex >= 0 && index === fixtureFlagIndex + 1)
  );
});
const fixtureLabel = process.env.ATDB_SCHEMA_FIXTURE_LABEL || fixtureFlagValue || inlineFixtureArg?.slice('--fixture='.length);
const defaultFixture = resolveFixtureByLabel(projectRoot, defaultFixtureLabel);
const manualFixturePath = process.env.ATDB_SCHEMA_FIXTURE || positionalArgs[0];
const hasManualFixtureInput = Boolean(manualFixturePath);
const hasExplicitFixtureLabel = Boolean(fixtureLabel);
const hasExplicitOutput = Boolean(
  process.env.ATDB_SCHEMA_OUTPUT || outputFlagValue || inlineOutputArg?.slice('--output='.length),
);
const registeredFixture = hasExplicitFixtureLabel
  ? resolveFixtureByLabel(projectRoot, fixtureLabel)
  : hasManualFixtureInput
    ? resolveFixtureByFileName(projectRoot, manualFixturePath)
    : defaultFixture;
const fixturePath = manualFixturePath || registeredFixture?.absolutePath || defaultFixture.absolutePath;
const normalizePathForCompare = (filePath) => {
  const resolvedPath = path.resolve(projectRoot, filePath);
  return process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath;
};
const usesDefaultFixture = normalizePathForCompare(fixturePath) === normalizePathForCompare(defaultFixture.absolutePath);
const snapshotPath =
  process.env.ATDB_SCHEMA_OUTPUT ||
  outputFlagValue ||
  inlineOutputArg?.slice('--output='.length) ||
  (!hasManualFixtureInput ? registeredFixture?.defaultSnapshotPath : undefined) ||
  defaultFixture.defaultSnapshotPath;
const artifactVersion = 1;
const requiredSections = [
  'tables',
  'globalMeta',
  'recTableDistribution',
  'valuesDistribution',
  'valuesLinksTargets',
  'eventTypes',
  'eventRoles',
  'eventUsage',
  'fieldCatalog',
  'orphanChecks',
];
const redactionExcludes = [
  'ValuesStr.vstr',
  'Recs.guid',
  'Global.guid',
  'Global.params',
  'document paths',
  'source text',
  'names',
  'places',
  'notes',
  'private/debug/raw artifacts',
];

const safeLog = (message) => {
  console.log(`[safe-atdb-schema] ${message}`);
};

const debugLog = (message) => {
  if (verbose) {
    safeLog(`debug: ${message}`);
  }
};

function safeErrorMessage(error) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

function assertSafeOutputSelection() {
  if (snapshotCheck || checkOnly) {
    return;
  }

  if (!hasManualFixtureInput) {
    return;
  }

  if (usesDefaultFixture) {
    return;
  }

  if (hasExplicitOutput) {
    return;
  }

  safeLog('[FIX:atdb-schema-output] blocked manual fixture input without explicit output before reading fixture');
  throw new Error('manual fixture input requires --output or ATDB_SCHEMA_OUTPUT');
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function firstResultRows(result) {
  if (!result.length) {
    return [];
  }

  const [first] = result;
  return first.values.map((row) =>
    Object.fromEntries(first.columns.map((column, index) => [column, row[index]])),
  );
}

function selectRows(db, sql) {
  return firstResultRows(db.exec(sql));
}

function tableExists(tableNames, tableName) {
  return tableNames.includes(tableName);
}

function hasColumns(schema, tableName, columnNames) {
  const columns = new Set((schema[tableName]?.columns || []).map((column) => column.name));
  return columnNames.every((columnName) => columns.has(columnName));
}

function countRows(db, tableName) {
  const [row] = selectRows(db, `SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`);
  return row?.count ?? 0;
}

function getTables(db) {
  return selectRows(
    db,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).map((row) => row.name);
}

function getTableInfo(db, tableName) {
  return selectRows(db, `PRAGMA table_info(${quoteIdentifier(tableName)})`).map((column) => ({
    cid: column.cid,
    name: column.name,
    type: column.type,
    notnull: column.notnull,
    pk: column.pk,
    dflt_value: column.dflt_value,
  }));
}

function getSchema(db, tableNames) {
  return Object.fromEntries(
    tableNames.map((tableName) => [
      tableName,
      {
        columns: getTableInfo(db, tableName),
        rowCount: countRows(db, tableName),
      },
    ]),
  );
}

function shortHash(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function getGlobalMeta(db, tableNames, schema) {
  if (!tableExists(tableNames, 'Global')) {
    return null;
  }

  const baseColumns = ['id', 'version', 'mainlang'];
  const optionalColumns = ['guid', 'srcguid', 'params'];
  const availableColumns = new Set((schema.Global?.columns || []).map((column) => column.name));
  const selectColumns = [
    ...baseColumns.filter((column) => availableColumns.has(column)),
    ...optionalColumns.filter((column) => availableColumns.has(column)),
  ];

  if (!selectColumns.length) {
    return null;
  }

  const [row] = selectRows(db, `SELECT ${selectColumns.map(quoteIdentifier).join(', ')} FROM Global ORDER BY id LIMIT 1`);
  if (!row) {
    return null;
  }

  return {
    id: row.id ?? null,
    version: row.version ?? null,
    mainlang: row.mainlang ?? null,
    guidHash: shortHash(row.guid),
    srcGuidHash: shortHash(row.srcguid),
    paramsLength: row.params == null ? null : String(row.params).length,
    paramsHash: shortHash(row.params),
  };
}

function getRecTableDistribution(db, tableNames, schema) {
  if (!tableExists(tableNames, 'Recs') || !hasColumns(schema, 'Recs', ['rec_table', 'rec_id'])) {
    return [];
  }

  return selectRows(
    db,
    `SELECT rec_table, COUNT(*) AS count, COUNT(DISTINCT rec_id) AS distinct_rec_ids
     FROM Recs
     GROUP BY rec_table
     ORDER BY rec_table`,
  );
}

function getValuesDistribution(db, tableNames, schema, tableName) {
  if (!tableExists(tableNames, tableName) || !hasColumns(schema, tableName, ['rec_table', 'f_id'])) {
    return [];
  }

  return selectRows(
    db,
    `SELECT rec_table, f_id, COUNT(*) AS count
     FROM ${quoteIdentifier(tableName)}
     GROUP BY rec_table, f_id
     ORDER BY rec_table, f_id`,
  );
}

function getValuesLinksTargets(db, tableNames, schema) {
  if (!tableExists(tableNames, 'ValuesLinks') || !hasColumns(schema, 'ValuesLinks', ['rec_table', 'f_id'])) {
    return [];
  }

  const targetSelect = hasColumns(schema, 'ValuesLinks', ['vlink_table', 'vlink_id'])
    ? ', vlink_table, COUNT(DISTINCT vlink_id) AS distinct_target_ids'
    : '';
  const targetGroup = hasColumns(schema, 'ValuesLinks', ['vlink_table', 'vlink_id']) ? ', vlink_table' : '';

  return selectRows(
    db,
    `SELECT rec_table, f_id${targetSelect}, COUNT(*) AS count
     FROM ValuesLinks
     GROUP BY rec_table, f_id${targetGroup}
     ORDER BY rec_table, f_id${targetGroup}`,
  );
}

function getEventStructuralRows(db, tableNames, schema, tableName) {
  if (!tableExists(tableNames, tableName)) {
    return [];
  }

  const columns = schema[tableName].columns
    .filter((column) => {
      const declaredType = String(column.type || '').toUpperCase();
      return column.pk || declaredType.includes('INT') || declaredType.includes('REAL') || declaredType.includes('NUM');
    })
    .map((column) => column.name);

  if (!columns.length) {
    return [];
  }

  const selectList = columns.map(quoteIdentifier).join(', ');
  const orderColumn = columns.includes('id') ? 'id' : columns[0];
  return selectRows(db, `SELECT ${selectList} FROM ${quoteIdentifier(tableName)} ORDER BY ${quoteIdentifier(orderColumn)}`);
}

function getFieldCatalog(db, tableNames, schema) {
  if (!tableExists(tableNames, 'Fields')) {
    return [];
  }

  const fields = selectRows(
    db,
    `SELECT id, tablecode, datatype,
            CASE WHEN area IS NULL THEN 0 ELSE 1 END AS area_present,
            defval, noautofill, et_id, et_ord
     FROM Fields
     ORDER BY id`,
  );

  const usageTables = ['ValuesStr', 'ValuesNum', 'ValuesDates', 'ValuesLinks'].filter(
    (tableName) => tableExists(tableNames, tableName) && hasColumns(schema, tableName, ['f_id', 'rec_table']),
  );
  const usageByField = new Map();

  for (const tableName of usageTables) {
    const rows = selectRows(
      db,
      `SELECT f_id, rec_table, COUNT(*) AS count
       FROM ${quoteIdentifier(tableName)}
       GROUP BY f_id, rec_table
       ORDER BY f_id, rec_table`,
    );

    for (const row of rows) {
      const usage = usageByField.get(row.f_id) || [];
      usage.push({
        valueTable: tableName,
        rec_table: row.rec_table,
        count: row.count,
      });
      usageByField.set(row.f_id, usage);
    }
  }

  return fields.map((field) => ({
    ...field,
    usage: usageByField.get(field.id) || [],
  }));
}

function getEventUsage(db, tableNames, schema) {
  const eventsByType =
    tableExists(tableNames, 'Events') && hasColumns(schema, 'Events', ['et_id'])
      ? selectRows(
          db,
          `SELECT et_id, COUNT(*) AS count
           FROM Events
           GROUP BY et_id
           ORDER BY et_id`,
        )
      : [];

  const detailsByRole =
    tableExists(tableNames, 'EventDetails') && hasColumns(schema, 'EventDetails', ['er_id'])
      ? selectRows(
          db,
          `SELECT er_id, COUNT(*) AS count
           FROM EventDetails
           GROUP BY er_id
           ORDER BY er_id`,
        )
      : [];

  const rolesByEventType =
    tableExists(tableNames, 'EventRoles') && hasColumns(schema, 'EventRoles', ['id', 'et_id'])
      ? selectRows(
          db,
          `SELECT roles.id, roles.et_id, roles.ord, roles.roletype, roles.ismain, roles.maxcount,
                  COUNT(details.id) AS event_detail_count
           FROM EventRoles roles
           LEFT JOIN EventDetails details ON details.er_id = roles.id
           GROUP BY roles.id, roles.et_id, roles.ord, roles.roletype, roles.ismain, roles.maxcount
           ORDER BY roles.et_id, roles.ord, roles.id`,
        )
      : [];

  return {
    eventsByType,
    detailsByRole,
    rolesByEventType,
  };
}

function getOrphanChecks(db, tableNames, schema) {
  const checks = [];

  for (const tableName of ['ValuesStr', 'ValuesNum', 'ValuesDates', 'ValuesLinks']) {
    if (
      !tableExists(tableNames, tableName) ||
      !tableExists(tableNames, 'Recs') ||
      !hasColumns(schema, tableName, ['rec_table', 'rec_id']) ||
      !hasColumns(schema, 'Recs', ['rec_table', 'rec_id'])
    ) {
      continue;
    }

    const [row] = selectRows(
      db,
      `SELECT COUNT(*) AS count
       FROM ${quoteIdentifier(tableName)} values_table
       LEFT JOIN Recs recs
         ON recs.rec_table = values_table.rec_table
        AND recs.rec_id = values_table.rec_id
       WHERE recs.id IS NULL`,
    );
    checks.push({ table: tableName, missing_recs: row?.count ?? 0 });
  }

  return checks;
}

function writeSnapshot(outputPath, snapshot) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
}

function assertSnapshot(snapshot) {
  const requiredTableCounts = {
    Persons: 294,
    Families: 11,
    Events: 665,
    EventDetails: 1059,
    Places: 23,
  };
  const requiredRecTableCounts = {
    7: 665,
    9: 11,
    13: 294,
    14: 23,
  };
  const requiredFieldUsage = [
    { tableName: 'ValuesDates', rec_table: 7, f_id: 29 },
    { tableName: 'ValuesLinks', rec_table: 7, f_id: 28 },
    { tableName: 'ValuesStr', rec_table: 9, f_id: 50 },
    { tableName: 'ValuesStr', rec_table: 13, f_id: 66 },
    { tableName: 'ValuesStr', rec_table: 14, f_id: 93 },
  ];

  for (const [tableName, expectedCount] of Object.entries(requiredTableCounts)) {
    const actualCount = snapshot.tables[tableName]?.rowCount;
    if (actualCount !== expectedCount) {
      throw new Error(`required table count mismatch: ${tableName} expected ${expectedCount}, got ${actualCount}`);
    }
  }

  for (const [recTable, expectedCount] of Object.entries(requiredRecTableCounts)) {
    const actual = snapshot.recTableDistribution.find((row) => row.rec_table === Number(recTable));
    if (!actual || actual.count !== expectedCount) {
      throw new Error(`required rec_table count mismatch: ${recTable} expected ${expectedCount}, got ${actual?.count ?? 'missing'}`);
    }
  }

  for (const usage of requiredFieldUsage) {
    const rows = snapshot.valuesDistribution[usage.tableName] || [];
    const found = rows.some((row) => row.rec_table === usage.rec_table && row.f_id === usage.f_id && row.count > 0);
    if (!found) {
      throw new Error(`required field usage missing: ${usage.tableName} rec_table=${usage.rec_table} f_id=${usage.f_id}`);
    }
  }
}

function assertGenericSnapshot(snapshot) {
  if (snapshot.artifactVersion !== artifactVersion) {
    throw new Error(`unsupported artifact version: ${snapshot.artifactVersion ?? 'missing'}`);
  }

  if (snapshot.generatedBy !== 'scripts/inspect-atdb-schema.mjs') {
    throw new Error(`unsupported artifact generator: ${snapshot.generatedBy ?? 'missing'}`);
  }

  const tableCount = Object.keys(snapshot.tables || {}).length;
  if (!tableCount) {
    throw new Error('schema inspection produced no user tables');
  }

  if (snapshot.safety?.redacted !== true) {
    throw new Error('schema snapshot is not marked as redacted');
  }

  if (!Array.isArray(snapshot.orphanChecks)) {
    throw new Error('schema snapshot missing orphan checks section');
  }

  for (const section of requiredSections) {
    if (!(section in snapshot)) {
      throw new Error(`schema snapshot missing required section: ${section}`);
    }
  }

  if (!Array.isArray(snapshot.sections) || !requiredSections.every((section) => snapshot.sections.includes(section))) {
    throw new Error('schema snapshot does not list all required sections');
  }
}

function readSnapshot(inputPath) {
  const content = fs.readFileSync(inputPath, 'utf8');
  return JSON.parse(content);
}

function assertTrackedSnapshot(inputPath) {
  const snapshot = readSnapshot(inputPath);
  debugLog(`snapshot-check path: ${safeRelativePath(projectRoot, inputPath)}`);
  debugLog(`snapshot-check sections: ${(snapshot.sections || []).join(',')}`);
  assertGenericSnapshot(snapshot);
  safeLog(`artifact-version: ${snapshot.artifactVersion}`);
  safeLog(`snapshot-sections: ${snapshot.sections.length}`);
  safeLog('tracked-snapshot-check: ok');
}

async function createDatabase(buffer) {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(projectRoot, 'node_modules/sql.js/dist', file),
  });
  return new SQL.Database(buffer);
}

async function main() {
  safeLog('status: start');
  const fixtureLabelForLog = registeredFixture?.label ?? 'manual';
  const snapshotMode = registeredFixture?.snapshotMode ?? (usesDefaultFixture ? 'tracked' : 'manual');
  const fixtureTrackedState =
    registeredFixture == null ? 'manual' : registeredFixture.tracked ? 'tracked' : 'local-only';
  debugLog(`fixture-label: ${fixtureLabelForLog}`);
  debugLog(`fixture-path: ${safeRelativePath(projectRoot, fixturePath)}`);
  debugLog(`fixture-status: ${fixtureTrackedState}`);
  debugLog(`snapshot-mode: ${snapshotMode}`);
  debugLog(`snapshot-output-path: ${safeRelativePath(projectRoot, snapshotPath)}`);
  debugLog('redaction-mode: structural-only');
  debugLog(`included-sections: ${requiredSections.join(',')}`);

  if (snapshotCheck) {
    try {
      assertTrackedSnapshot(snapshotPath);
      safeLog('status: success');
    } catch (error) {
      safeLog('status: failure');
      safeLog(`error: ${safeErrorMessage(error)}`);
      process.exitCode = 1;
    }
    return;
  }

  try {
    assertSafeOutputSelection();
  } catch (error) {
    safeLog('status: failure');
    safeLog(`error: ${safeErrorMessage(error)}`);
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(fixturePath)) {
    safeLog('status: skipped');
    safeLog(`fixture-label: ${fixtureLabelForLog}`);
    safeLog('fixture-bytes: 0');
    safeLog(`artifact-version: ${artifactVersion}`);
    safeLog('reason: fixture missing');
    return;
  }

  const buffer = fs.readFileSync(fixturePath);
  safeLog(`fixture-label: ${fixtureLabelForLog}`);
  safeLog(`fixture-bytes: ${buffer.length}`);
  safeLog(`artifact-version: ${artifactVersion}`);

  let db;
  try {
    db = await createDatabase(buffer);
    const tableNames = getTables(db);
    const schema = getSchema(db, tableNames);
    const snapshot = {
      artifactVersion,
      generatedBy: 'scripts/inspect-atdb-schema.mjs',
      fixture: {
        label: fixtureLabelForLog,
        tracked: fixtureTrackedState,
        snapshotMode,
      },
      safety: {
        redacted: true,
        excludes: redactionExcludes,
      },
      redactionPolicy: {
        mode: 'structural-only',
        allowedFields: ['table names', 'counts', 'rec_table', 'rec_id shape', 'f_id', 'datatype', 'link targets'],
        confidenceLabels: ['confirmed', 'observed', 'needs more samples', 'unknown'],
      },
      sections: requiredSections,
      tables: schema,
      globalMeta: getGlobalMeta(db, tableNames, schema),
      recTableDistribution: getRecTableDistribution(db, tableNames, schema),
      valuesDistribution: Object.fromEntries(
        ['ValuesStr', 'ValuesNum', 'ValuesDates', 'ValuesLinks'].map((tableName) => [
          tableName,
          getValuesDistribution(db, tableNames, schema, tableName),
        ]),
      ),
      valuesLinksTargets: getValuesLinksTargets(db, tableNames, schema),
      eventTypes: getEventStructuralRows(db, tableNames, schema, 'EventTypes'),
      eventRoles: getEventStructuralRows(db, tableNames, schema, 'EventRoles'),
      eventUsage: getEventUsage(db, tableNames, schema),
      fieldCatalog: getFieldCatalog(db, tableNames, schema),
      orphanChecks: getOrphanChecks(db, tableNames, schema),
    };

    safeLog(`tables: ${tableNames.length}`);
    safeLog(`rec-table-codes: ${snapshot.recTableDistribution.length}`);
    safeLog(`values-link-groups: ${snapshot.valuesLinksTargets.length}`);
    safeLog(`orphan-checks: ${snapshot.orphanChecks.length}`);
    debugLog(`tables: ${tableNames.join(',')}`);
    assertGenericSnapshot(snapshot);
    safeLog('generic-structure-check: ok');

    if (checkYaman || (checkOnly && usesDefaultFixture)) {
      assertSnapshot(snapshot);
      safeLog('yaman-mapping-check: ok');
    } else if (checkOnly) {
      safeLog('yaman-mapping-check: skipped for non-default fixture');
    }
    if (!checkOnly) {
      writeSnapshot(snapshotPath, snapshot);
      safeLog(`snapshot-output: ${safeRelativePath(projectRoot, snapshotPath)}`);
    } else {
      safeLog('snapshot-output: skipped in check mode');
    }
    safeLog(`snapshot-sections: ${Object.keys(snapshot).length}`);
    safeLog('status: success');
  } catch (error) {
    safeLog('status: failure');
    safeLog(`error: ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  } finally {
    db?.close();
  }
}

await main();
