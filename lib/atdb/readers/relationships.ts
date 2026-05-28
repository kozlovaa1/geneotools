import type { Family, Person, Place } from '../../types';

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
  for (const person of persons) {
    if (person.birthPlaceId !== undefined) {
      const birthPlace = places.find(p => p.id === person.birthPlaceId);
      if (birthPlace && birthPlace.name) {
        person.birthPlace = birthPlace.name;
      }
    }

    if (person.deathPlaceId !== undefined) {
      const deathPlace = places.find(p => p.id === person.deathPlaceId);
      if (deathPlace && deathPlace.name) {
        person.deathPlace = deathPlace.name;
      }
    }
  }
}
