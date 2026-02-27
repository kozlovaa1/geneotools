import fs from 'node:fs';
import { parseAtdb } from './lib/sqlProcessor';

async function testParsing() {
  try {
    const buffer = fs.readFileSync('./yaman-test.atdb');
    console.log(`Loaded file with size: ${buffer.length} bytes`);

    const parsedData = await parseAtdb(new Uint8Array(buffer));

    console.log('Parsing completed successfully!');
    console.log(`Persons: ${parsedData.persons.length}`);
    console.log(`Families: ${parsedData.families.length}`);
    console.log(`Events: ${parsedData.events.length}`);
    console.log(`Places: ${parsedData.places.length}`);

    console.log('\nFirst 5 persons with parent information:');
    parsedData.persons.slice(0, 5).forEach((person) => {
      console.log(`ID: ${person.id}, Name: ${person.firstName} ${person.lastName}, Father ID: ${person.fatherId}, Mother ID: ${person.motherId}`);
    });

    console.log('\nSample complete.');
  } catch (error) {
    console.error('Error during parsing:', error);
  }
}

void testParsing();
