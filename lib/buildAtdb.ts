import type { ParsedAtdb } from './types';

/**
 * Validates the structure of ParsedAtdb before building an .atdb file
 * @param data - The ParsedAtdb object to validate
 * @returns true if the data is valid, false otherwise
 */
export function validateAtdbData(data: ParsedAtdb): boolean {
  // Perform basic validation
  if (!Array.isArray(data.persons) || !Array.isArray(data.families) || !Array.isArray(data.events)) {
    console.error('Invalid data structure: persons, families, or events is not an array');
    return false;
  }
  
  // Validate person structure
  for (const person of data.persons) {
    if (typeof person.id !== 'number') {
      console.error(`Invalid person: id must be a number, got ${typeof person.id}`);
      return false;
    }
    
    if (typeof person.firstName !== 'string' && person.firstName !== undefined) {
      console.error(`Invalid person: firstName must be a string or undefined, got ${typeof person.firstName}`);
      return false;
    }
    
    if (typeof person.lastName !== 'string' && person.lastName !== undefined) {
      console.error(`Invalid person: lastName must be a string or undefined, got ${typeof person.lastName}`);
      return false;
    }
    
    if (person.gender !== 'M' && person.gender !== 'F' && person.gender !== 'Unknown' && person.gender !== undefined) {
      console.error(`Invalid person: gender must be 'M', 'F', 'Unknown', or undefined, got ${person.gender}`);
      return false;
    }
  }
  
  // Validate family structure
  for (const family of data.families) {
    if (typeof family.id !== 'number') {
      console.error(`Invalid family: id must be a number, got ${typeof family.id}`);
      return false;
    }
  }
  
  // Validate event structure
  for (const event of data.events) {
    if (typeof event.id !== 'number') {
      console.error(`Invalid event: id must be a number, got ${typeof event.id}`);
      return false;
    }
  }
  
  return true;
}