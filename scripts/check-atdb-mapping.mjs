#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { getFixtureRegistry, resolveFixtureByLabel } from './atdb-fixtures.mjs';

const projectRoot = process.cwd();
const verbose = process.argv.includes('--verbose') || process.env.LOG_LEVEL === 'debug';
const mappingPath = path.join(projectRoot, 'lib/atdb/mapping.json');
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
const confidences = new Set(['invariant', 'fixture-specific', 'legacy-fallback']);
const entities = new Set(['events', 'families', 'persons', 'places']);
const valuesTables = new Set(['ValuesStr', 'ValuesNum', 'ValuesDates', 'ValuesLinks']);

function safeLog(message) {
  console.log(`[safe-atdb-mapping] ${message}`);
}

function fail(message) {
  throw new Error(message);
}

function validateScopedRule(name, rule) {
  if (!rule || !confidences.has(rule.confidence) || typeof rule.read !== 'boolean' || typeof rule.write !== 'boolean') {
    fail(`invalid scoped rule: ${name}`);
  }
  if (rule.write && rule.confidence !== 'invariant') fail(`non-invariant rule is write-safe: ${name}`);
}

function validateRegistry() {
  if (mapping.version !== 1) fail('unsupported registry version');
  for (const [name, rule] of Object.entries(mapping.tableCodes)) {
    validateScopedRule(name, rule);
    if (!Number.isInteger(rule.code)) fail(`invalid table code: ${name}`);
  }
  for (const [name, rule] of Object.entries(mapping.eventTypes)) {
    validateScopedRule(name, rule);
    if (!Number.isInteger(rule.id)) fail(`invalid event type: ${name}`);
  }
  for (const [name, rule] of Object.entries(mapping.eventRoles)) {
    validateScopedRule(name, rule);
    if (
      !Number.isInteger(rule.id) ||
      !Number.isInteger(rule.roleType) ||
      !Number.isInteger(rule.order) ||
      !mapping.eventTypes[rule.eventType]
    ) fail(`invalid event role: ${name}`);
  }
  const invariantCodes = Object.values(mapping.tableCodes)
    .filter((rule) => rule.confidence === 'invariant')
    .map((rule) => rule.code);
  if (new Set(invariantCodes).size !== invariantCodes.length) fail('conflicting invariant table codes');
  for (const [name, rule] of Object.entries(mapping.fields)) {
    validateScopedRule(name, rule);
    if (!mapping.tableCodes[rule.entity]) fail(`unknown field entity: ${name}`);
    if (!entities.has(rule.entity) || !valuesTables.has(rule.valueTable)) fail(`invalid field target: ${name}`);
    if (rule.datatype !== null && !Number.isInteger(rule.datatype)) fail(`invalid field datatype: ${name}`);
    if (rule.linkTarget !== undefined && !entities.has(rule.linkTarget)) fail(`invalid field link target: ${name}`);
  }
  safeLog(`registry-rules: ${Object.keys(mapping.fields).length}`);
}

function validateFixtures() {
  const baselineCodes = new Set(
    [...entities].map((entity) => mapping.tableCodes[entity]).filter((rule) => rule.confidence === 'invariant').map((rule) => rule.code),
  );
  for (const entry of getFixtureRegistry()) {
    const fixture = resolveFixtureByLabel(projectRoot, entry.label);
    if (!fs.existsSync(fixture.defaultSnapshotPath)) {
      safeLog(`warning: fixture ${fixture.label} skipped (local snapshot missing)`);
      continue;
    }
    const snapshot = JSON.parse(fs.readFileSync(fixture.defaultSnapshotPath, 'utf8'));
    const codes = new Set(snapshot.recTableDistribution.map((row) => row.rec_table));
    for (const code of baselineCodes) if (!codes.has(code)) fail(`fixture ${fixture.label} missing invariant rec_table ${code}`);
    if (snapshot.safety?.redacted !== true) fail(`fixture ${fixture.label} snapshot is not redacted`);

    const fieldCatalog = new Map(snapshot.fieldCatalog.map((field) => [field.id, field]));
    for (const [name, rule] of Object.entries(mapping.fields).filter(([, rule]) => rule.confidence === 'invariant')) {
      const field = fieldCatalog.get(rule.id);
      const tableCode = mapping.tableCodes[rule.entity].code;
      if (!field || field.tablecode !== tableCode || field.datatype !== rule.datatype) {
        fail(`fixture ${fixture.label} incompatible invariant field: ${name}`);
      }
      const incompatibleUsage = field.usage.some(
        (usage) => usage.valueTable !== rule.valueTable || usage.rec_table !== tableCode,
      );
      if (incompatibleUsage) fail(`fixture ${fixture.label} incompatible invariant field usage: ${name}`);
    }

    const eventTypeIds = new Set(snapshot.eventTypes.map((eventType) => eventType.id));
    for (const [name, rule] of Object.entries(mapping.eventTypes).filter(([, rule]) => rule.confidence === 'invariant')) {
      if (!eventTypeIds.has(rule.id)) fail(`fixture ${fixture.label} missing invariant event type: ${name}`);
    }

    const eventRoles = new Map(snapshot.eventRoles.map((role) => [role.id, role]));
    for (const [name, rule] of Object.entries(mapping.eventRoles)) {
      const role = eventRoles.get(rule.id);
      if (
        !role ||
        role.et_id !== mapping.eventTypes[rule.eventType].id ||
        role.roletype !== rule.roleType ||
        role.ord !== rule.order
      ) {
        fail(`fixture ${fixture.label} incompatible event role: ${name}`);
      }
    }

    for (const [name, rule] of Object.entries(mapping.fields).filter(([, rule]) => rule.linkTarget)) {
      const sourceTable = mapping.tableCodes[rule.entity].code;
      const targetTable = mapping.tableCodes[rule.linkTarget].code;
      const incompatibleTarget = snapshot.valuesLinksTargets.some(
        (target) => target.rec_table === sourceTable && target.f_id === rule.id && target.vlink_table !== targetTable,
      );
      if (incompatibleTarget) fail(`fixture ${fixture.label} incompatible link target: ${name}`);
    }

    const orphanCount = snapshot.orphanChecks.reduce((total, check) => total + check.missing_recs, 0);
    if (orphanCount !== 0) fail(`fixture ${fixture.label} contains orphan value references`);
    safeLog(
      `fixture: ${fixture.label},recTables:${codes.size},fields:${fieldCatalog.size},eventTypes:${eventTypeIds.size},eventRoles:${eventRoles.size},orphans:${orphanCount}`,
    );
  }
}

function validateSourceLiterals() {
  const roots = ['lib/atdb/readers', 'lib/atdb/writers'];
  const conflicts = [];
  for (const root of roots) {
    for (const file of fs.readdirSync(path.join(projectRoot, root)).filter((name) => name.endsWith('.ts'))) {
      const relative = `${root}/${file}`;
      const content = fs.readFileSync(path.join(projectRoot, relative), 'utf8');
      if (
        /rec_table\s*=\s*\d+\b/.test(content) ||
        /vlink_table\s*=\s*\d+\b/.test(content) ||
        /f_id\s*=\s*\d+\b/.test(content) ||
        /er_id\s*=\s*\d+\b/.test(content)
      ) {
        conflicts.push(relative);
      }
    }
  }
  if (conflicts.length > 0) fail(`hard-coded mapping literals: ${conflicts.join(',')}`);
  safeLog('source-literals: ok');
}

try {
  safeLog('status: start');
  validateRegistry();
  validateFixtures();
  validateSourceLiterals();
  if (verbose) safeLog('debug: event drift remains a separate diagnostic');
  safeLog('status: success');
} catch (error) {
  safeLog('status: failure');
  safeLog(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
