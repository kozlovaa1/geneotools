import { formatAtdbPlaceLabel, formatAtdbPlaceParentPath } from '../../atdbPlaceLabels';
import type { Event, Family, ParsedAtdb, Person, Place } from '../../types';

export function populateSpouseRelationships(persons: Person[], families: Family[]): void {
  for (const family of families) {
    if (family.husbandId && family.wifeId) {
      const husband = persons.find(p => p.id === family.husbandId);
      if (husband) {
        if (!husband.spouseIds) {
          husband.spouseIds = [];
        }
        if (!husband.spouseIds.includes(family.wifeId)) {
          husband.spouseIds.push(family.wifeId);
        }
      }

      const wife = persons.find(p => p.id === family.wifeId);
      if (wife) {
        if (!wife.spouseIds) {
          wife.spouseIds = [];
        }
        if (!wife.spouseIds.includes(family.husbandId)) {
          wife.spouseIds.push(family.husbandId);
        }
      }
    }
  }
}

export function populatePersonPlaceNames(persons: Person[], places: Place[]): void {
  const data = createRelationshipData(persons, [], [], places);
  for (const person of persons) {
    if (person.birthPlaceId !== undefined) {
      person.birthPlace = formatAtdbPlaceLabel(data, person.birthPlaceId);
    }

    if (person.deathPlaceId !== undefined) {
      person.deathPlace = formatAtdbPlaceLabel(data, person.deathPlaceId);
    }
  }
}

export function populateEventPlaceNames(events: Event[], places: Place[]): void {
  const data = createRelationshipData([], [], events, places);
  for (const event of events) {
    if (event.placeId !== undefined) {
      event.place = formatAtdbPlaceLabel(data, event.placeId);
    }
  }
}

export function populatePlaceParentPaths(places: Place[]): void {
  const data = createRelationshipData([], [], [], places);
  for (const place of places) {
    place.parentPath = formatAtdbPlaceParentPath(data, place.id);
  }
}

function createRelationshipData(
  persons: Person[],
  families: Family[],
  events: Event[],
  places: Place[],
): ParsedAtdb {
  return {
    persons,
    families,
    events,
    places,
    metadata: {},
  };
}
