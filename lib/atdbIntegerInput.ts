export function parseAtdbIntegerInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) return undefined;

  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}
