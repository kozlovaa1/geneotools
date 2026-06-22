import type { AtdbDiagnosticLogger } from './diagnostics';

export type AtdbWritableEntity = 'person' | 'family' | 'place';

export type AtdbPersonField =
  | 'firstName'
  | 'lastName'
  | 'patronymic'
  | 'gender'
  | 'birthPlaceId'
  | 'deathPlaceId';

export type AtdbFamilyField =
  | 'familyName'
  | 'husbandLastName'
  | 'wifeLastName'
  | 'comment'
  | 'color';

export type AtdbPlaceField = 'name' | 'shortName' | 'comment';

export type AtdbFieldName = AtdbPersonField | AtdbFamilyField | AtdbPlaceField;
export type AtdbFieldValue = string | number | null | undefined;

export interface AtdbFieldChange<FieldName extends AtdbFieldName = AtdbFieldName> {
  field: FieldName;
  value: AtdbFieldValue;
}

export interface AtdbEntityChange {
  entityType: AtdbWritableEntity;
  id: number;
  fields: AtdbFieldChange[];
}

export interface AtdbChangeSet {
  changes: AtdbEntityChange[];
}

export interface AtdbBuildOptions {
  logger?: AtdbDiagnosticLogger;
  strict?: boolean;
}

export interface AtdbBuildIssue {
  code: string;
  message: string;
  entityType?: string;
  field?: string;
  count?: number;
}

export interface AtdbBuildReport {
  ok: boolean;
  changes: number;
  noopChanges: number;
  issues: AtdbBuildIssue[];
  counts: {
    persons: number;
    families: number;
    events: number;
    places: number;
  };
}

export interface SafeAtdbBuildError {
  code: string;
  message: string;
  issueCount: number;
  changes: number;
}

export const ATDB_BUILD_ERROR_CODE = 'atdb.rebuild.failed';

const DEFAULT_COUNTS = {
  persons: 0,
  families: 0,
  events: 0,
  places: 0,
} as const;

export class AtdbBuildError extends Error {
  readonly code = ATDB_BUILD_ERROR_CODE;
  readonly report: AtdbBuildReport;

  constructor(report: AtdbBuildReport, message = 'Не удалось безопасно собрать .atdb файл') {
    super(message);
    this.name = 'AtdbBuildError';
    this.report = report;
  }
}

export function createAtdbBuildReport(partial: Partial<AtdbBuildReport> = {}): AtdbBuildReport {
  const issues = partial.issues ?? [];
  return {
    ok: issues.length === 0,
    changes: partial.changes ?? 0,
    noopChanges: partial.noopChanges ?? 0,
    issues,
    counts: partial.counts ?? { ...DEFAULT_COUNTS },
  };
}

export function summarizeChangeSet(changeSet: AtdbChangeSet): { changes: number; entities: number } {
  let changes = 0;
  for (const entityChange of changeSet.changes) {
    changes += entityChange.fields.length;
  }
  return { changes, entities: changeSet.changes.length };
}

export function shouldUseStrictMode(options: AtdbBuildOptions = {}): boolean {
  return options.strict !== false;
}

export function throwAtdbBuildError(report: AtdbBuildReport, options: AtdbBuildOptions = {}): void {
  if (report.issues.length === 0 || !shouldUseStrictMode(options)) {
    return;
  }

  options.logger?.({
    level: 'ERROR',
    code: 'rebuild.strict.validation.failed',
    details: { issues: report.issues.length, changes: report.changes },
  });
  throw new AtdbBuildError(report);
}

export function formatAtdbBuildError(error: unknown): SafeAtdbBuildError {
  if (error instanceof AtdbBuildError) {
    return {
      code: error.code,
      message: error.message,
      issueCount: error.report.issues.length,
      changes: error.report.changes,
    };
  }

  if (error instanceof Error) {
    return {
      code: 'atdb.error',
      message: error.message,
      issueCount: 1,
      changes: 0,
    };
  }

  return {
    code: 'atdb.error',
    message: 'Неизвестная ошибка обработки .atdb файла',
    issueCount: 1,
    changes: 0,
  };
}
