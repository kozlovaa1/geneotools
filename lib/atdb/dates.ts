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
