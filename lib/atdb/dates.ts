export function formatAtdbDate(year: number, month: number, day: number): string | null {
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
  const [year, month, day] = date.split('-').map(Number);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
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
