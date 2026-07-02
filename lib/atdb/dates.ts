import type { AtdbDateMetadata, AtdbDateValue } from '../types';
import type { SqlJsDatabase, SqlValue } from './dbTypes';
import type { AtdbDiagnosticLogger } from './diagnostics';
import { silentAtdbLogger } from './diagnostics';
import { tableExists } from './sqlHelpers';

type ValuesDateRow = Record<string, SqlValue | undefined>;

const OPTIONAL_VALUES_DATES_COLUMNS = [
  'd2',
  'm2',
  'y2',
  'calendar',
  'calendar2',
  'type',
  'sorty',
  'sortm',
  'sortd',
  'sorty2',
  'sortm2',
  'sortd2',
  'lconf',
  'ltrust',
] as const;

const SIMPLE_DATE_TYPES = new Set([0]);
const KNOWN_DATE_TYPE_LABELS: Record<number, 'before' | 'after' | 'about' | 'between' | 'from-to'> = {
  1: 'before',
  2: 'after',
  3: 'about',
  4: 'between',
  5: 'from-to',
};

export interface ReadAtdbDateValueOptions {
  fieldId: number;
  recTable: number;
  recId: number;
  logger?: AtdbDiagnosticLogger;
}

export function formatAtdbDate(year: number, month: number, day: number): string | null {
  if (!isValidAtdbDateParts(year, month, day)) {
    return null;
  }

  if (year && month && day) {
    return year.toString().padStart(4, '0') + '-' + month.toString().padStart(2, '0') + '-' + day.toString().padStart(2, '0');
  }

  if (year && month && !day) {
    return year.toString().padStart(4, '0') + '-' + month.toString().padStart(2, '0') + '-00';
  }

  if (year && !month && !day) {
    return year.toString().padStart(4, '0') + '-00-00';
  }

  return null;
}

export function splitAtdbDate(date: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return null;
  }

  const [, yearPart, monthPart, dayPart] = match;
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  if (!isValidAtdbDateParts(year, month, day)) {
    return null;
  }

  return [year, month, day];
}

export function readAtdbDateValue(db: SqlJsDatabase, options: ReadAtdbDateValueOptions): AtdbDateValue | null {
  if (!tableExists(db, 'ValuesDates')) return null;

  const columns = getValuesDatesColumns(db);
  const selectColumns = ['y', 'm', 'd', ...OPTIONAL_VALUES_DATES_COLUMNS.filter((column) => columns.has(column))];
  const statement = db.prepare(
    `SELECT ${selectColumns.join(', ')}
     FROM ValuesDates
     WHERE f_id = ? AND rec_table = ? AND rec_id = ?
     ORDER BY id
     LIMIT 1`,
  );
  statement.bind([options.fieldId, options.recTable, options.recId]);

  try {
    if (!statement.step()) return null;
    return createAtdbDateValue(statement.getAsObject(), {
      fieldId: options.fieldId,
      recTable: options.recTable,
      logger: options.logger ?? silentAtdbLogger,
    });
  } finally {
    statement.free();
  }
}

export function createAtdbDateValue(
  row: ValuesDateRow,
  options: { fieldId?: number; recTable?: number; logger?: AtdbDiagnosticLogger } = {},
): AtdbDateValue {
  const logger = options.logger ?? silentAtdbLogger;
  const metadata = createAtdbDateMetadata(row);
  const value =
    metadata.y !== null && metadata.m !== null && metadata.d !== null
      ? formatAtdbDate(metadata.y, metadata.m, metadata.d) ?? undefined
      : undefined;
  const secondaryValue =
    hasCompleteSecondaryDate(metadata)
      ? formatOptionalAtdbDate(metadata.y2, metadata.m2, metadata.d2)
      : undefined;
  const isSimple = isSimpleAtdbDateMetadata(metadata);
  const diagnosticCode = isSimple || isKnownDateType(metadata.type) ? undefined : 'date.type.unknown';

  if (diagnosticCode) {
    logger({
      level: 'WARN',
      code: diagnosticCode,
      details: {
        fieldId: options.fieldId ?? 'unknown',
        recTable: options.recTable ?? 'unknown',
        type: metadata.type ?? 'none',
      },
    });
  }

  return {
    value,
    display: formatAtdbDateForDisplay(value, secondaryValue, metadata.type),
    metadata,
    isSimple,
    diagnosticCode,
  };
}

export function isSimpleAtdbDateValue(value: AtdbDateValue | null | undefined): boolean {
  return !value || value.isSimple;
}

export function isSimpleAtdbDateMetadata(metadata: AtdbDateMetadata): boolean {
  const dateType = metadata.type ?? 0;
  const hasSecondaryDate = hasPresentDatePart(metadata.y2)
    || hasPresentDatePart(metadata.m2)
    || hasPresentDatePart(metadata.d2);
  return SIMPLE_DATE_TYPES.has(dateType) && !hasSecondaryDate && !hasNonEditableDateMetadata(metadata);
}

export function createSimpleAtdbDateMetadata(date: string): AtdbDateMetadata | null {
  const parts = splitAtdbDate(date);
  if (!parts) return null;
  const [y, m, d] = parts;
  return {
    y,
    m,
    d,
    type: 0,
  };
}

export function isNewDateMoreHistoricallyAccurate(currentDate: string, newDate: string): boolean {
  if (!currentDate) return true;

  const currentYear = parseInt(currentDate.split('-')[0]);
  const newYear = parseInt(newDate.split('-')[0]);

  if (currentYear > 1950 && newYear < currentYear && newYear > 1500) {
    return true;
  }

  const currentYearAsNumber = parseInt(currentDate.split('-')[0]);
  const newYearAsNumber = parseInt(newDate.split('-')[0]);
  const currentIsFuture = currentYearAsNumber > new Date().getFullYear();
  const newIsPast = newYearAsNumber <= new Date().getFullYear();

  if (currentIsFuture && newIsPast && newYearAsNumber > 1500) {
    return true;
  }

  return false;
}

function getValuesDatesColumns(db: SqlJsDatabase): Set<string> {
  const result = db.exec('PRAGMA table_info(ValuesDates)');
  if (!result[0]) return new Set(['y', 'm', 'd']);

  const nameIndex = result[0].columns.indexOf('name');
  if (nameIndex === -1) return new Set(['y', 'm', 'd']);

  return new Set(
    result[0].values
      .map((row) => row[nameIndex])
      .filter((value): value is string => typeof value === 'string'),
  );
}

function createAtdbDateMetadata(row: ValuesDateRow): AtdbDateMetadata {
  return {
    y: numberOrNull(row.y),
    m: numberOrNull(row.m),
    d: numberOrNull(row.d),
    y2: optionalNumber(row.y2),
    m2: optionalNumber(row.m2),
    d2: optionalNumber(row.d2),
    calendar: optionalNumber(row.calendar),
    calendar2: optionalNumber(row.calendar2),
    type: optionalNumber(row.type),
    sortY: optionalNumber(row.sorty),
    sortM: optionalNumber(row.sortm),
    sortD: optionalNumber(row.sortd),
    sortY2: optionalNumber(row.sorty2),
    sortM2: optionalNumber(row.sortm2),
    sortD2: optionalNumber(row.sortd2),
    lconf: optionalNumber(row.lconf),
    ltrust: optionalNumber(row.ltrust),
  };
}

function formatAtdbDateForDisplay(primary: string | undefined, secondary: string | undefined, type: number | null | undefined): string {
  if (!primary) return '';
  const kind = type === null || type === undefined || SIMPLE_DATE_TYPES.has(type) ? 'simple' : KNOWN_DATE_TYPE_LABELS[type];

  if (kind === 'before') return `до ${primary}`;
  if (kind === 'after') return `после ${primary}`;
  if (kind === 'about') return `около ${primary}`;
  if (kind === 'between' && secondary) return `между ${primary} и ${secondary}`;
  if (kind === 'from-to' && secondary) return `с ${primary} по ${secondary}`;
  return primary;
}

function formatOptionalAtdbDate(year: number | null, month: number | null, day: number | null): string | undefined {
  if (year === null || month === null || day === null) return undefined;
  return formatAtdbDate(year, month, day) ?? undefined;
}

function hasCompleteSecondaryDate(
  metadata: AtdbDateMetadata,
): metadata is AtdbDateMetadata & { y2: number | null; m2: number | null; d2: number | null } {
  return metadata.y2 !== undefined && metadata.m2 !== undefined && metadata.d2 !== undefined;
}

function hasPresentDatePart(value: number | null | undefined): boolean {
  return value !== null && value !== undefined;
}

function hasNonEditableDateMetadata(metadata: AtdbDateMetadata): boolean {
  return [
    metadata.calendar,
    metadata.calendar2,
    metadata.sortY,
    metadata.sortM,
    metadata.sortD,
    metadata.sortY2,
    metadata.sortM2,
    metadata.sortD2,
    metadata.lconf,
    metadata.ltrust,
  ].some(hasPresentDatePart);
}

function isKnownDateType(type: number | null | undefined): boolean {
  return type === null || type === undefined || SIMPLE_DATE_TYPES.has(type) || KNOWN_DATE_TYPE_LABELS[type] !== undefined;
}

function numberOrNull(value: SqlValue | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function optionalNumber(value: SqlValue | undefined): number | null | undefined {
  return value === undefined ? undefined : numberOrNull(value);
}

function isValidAtdbDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  if (year <= 0 || month < 0 || month > 12 || day < 0 || day > 31) {
    return false;
  }

  if (month === 0 && day !== 0) {
    return false;
  }

  return true;
}
