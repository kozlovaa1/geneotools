export const roundtripInvariantKeys = [
  'persons-with-father',
  'persons-with-mother',
  'persons-with-birth-date',
  'persons-with-death-date',
  'persons-with-birth-place',
  'persons-with-death-place',
  'events-with-date',
  'events-with-participants',
];

export function collectAtdbRoundtripInvariants(parsed) {
  return {
    'persons-with-father': countRows(parsed.persons, (person) => person.fatherId !== undefined),
    'persons-with-mother': countRows(parsed.persons, (person) => person.motherId !== undefined),
    'persons-with-birth-date': countRows(parsed.persons, (person) => Boolean(person.birthDate)),
    'persons-with-death-date': countRows(parsed.persons, (person) => Boolean(person.deathDate)),
    'persons-with-birth-place': countRows(parsed.persons, (person) => person.birthPlaceId !== undefined),
    'persons-with-death-place': countRows(parsed.persons, (person) => person.deathPlaceId !== undefined),
    'events-with-date': countRows(parsed.events, (event) => Boolean(event.date)),
    'events-with-participants': countRows(parsed.events, (event) => (event.personIds?.length ?? 0) > 0),
  };
}

export function diffAtdbRoundtripInvariants(before, after) {
  const beforeInvariants = collectAtdbRoundtripInvariants(before);
  const afterInvariants = collectAtdbRoundtripInvariants(after);

  return Object.fromEntries(
    roundtripInvariantKeys.map((key) => [key, afterInvariants[key] - beforeInvariants[key]]),
  );
}

function countRows(rows, predicate) {
  return rows.reduce((count, row) => count + (predicate(row) ? 1 : 0), 0);
}
