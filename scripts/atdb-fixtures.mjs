import path from 'node:path';

export const defaultFixtureLabel = 'yaman';

export const fixtureRegistry = [
  {
    label: 'yaman',
    fileName: 'yaman-test.atdb',
    tracked: true,
    snapshotMode: 'tracked',
    defaultSnapshotRelativePath: 'docs/atdb_schema_yaman.snapshot.json',
  },
  {
    label: 'yaman-full',
    fileName: 'yaman-test-full.atdb',
    tracked: false,
    snapshotMode: 'local-only',
    defaultSnapshotRelativePath: 'docs/atdb_experiments/local/yaman-full.local.snapshot.json',
  },
  {
    label: 'family',
    fileName: 'family-test.atdb',
    tracked: false,
    snapshotMode: 'local-only',
    defaultSnapshotRelativePath: 'docs/atdb_experiments/local/family.local.snapshot.json',
  },
];

export function getFixtureRegistry() {
  return fixtureRegistry.map((fixture) => ({ ...fixture }));
}

export function resolveFixtureLabel(label) {
  return fixtureRegistry.find((fixture) => fixture.label === label) ?? null;
}

export function resolveFixtureByLabel(projectRoot, label) {
  const fixture = resolveFixtureLabel(label);
  if (!fixture) {
    return null;
  }

  return {
    ...fixture,
    relativePath: fixture.fileName,
    absolutePath: path.join(projectRoot, fixture.fileName),
    defaultSnapshotPath: path.join(projectRoot, fixture.defaultSnapshotRelativePath),
  };
}

export function resolveFixtureByFileName(projectRoot, fileName) {
  const normalizedFileName = path.basename(fileName);
  const fixture = fixtureRegistry.find((entry) => entry.fileName === normalizedFileName);
  if (!fixture) {
    return null;
  }

  return resolveFixtureByLabel(projectRoot, fixture.label);
}

export function safeRelativePath(projectRoot, absolutePath) {
  return path.relative(projectRoot, absolutePath) || '.';
}
