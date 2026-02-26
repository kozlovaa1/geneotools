import { parseAtdb } from './lib/sqlProcessor';

// Test the parsing functionality
async function testParsing() {
  try {
    // Read the sample .atdb file
    const fs = require('fs');
    const buffer = fs.readFileSync('./yaman-test.atdb');
    console.log(`Loaded file with size: ${buffer.length} bytes`);
    
    // Parse the .atdb file
    const parsedData = await parseAtdb(new Uint8Array(buffer));
    
    console.log('Parsing completed successfully!');
    console.log(`Persons: ${parsedData.persons.length}`);
    console.log(`Families: ${parsedData.families.length}`);
    console.log(`Events: ${parsedData.events.length}`);
    console.log(`Places: ${parsedData.places.length}`);
    
    // Print first few persons with their fatherId and motherId
    console.log('\nFirst 5 persons with parent information:');
    parsedData.persons.slice(0, 5).forEach(person => {
      console.log(`ID: ${person.id}, Name: ${person.firstName} ${person.lastName}, Father ID: ${person.fatherId}, Mother ID: ${person.motherId}`);
    });
    
    console.log('\nSample complete.');
  } catch (error) {
    console.error('Error during parsing:', error);
  }
}

testParsing();