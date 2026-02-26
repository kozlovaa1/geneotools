import React, { useState, useEffect } from 'react';
import { parseAtdb } from '@/lib/sqlProcessor';

// Simple debug component to analyze the yaman-test.atdb file
const DebugAnalyzer: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  useEffect(() => {
    const analyzeFile = async () => {
      try {
        // Load the test file
        const response = await fetch('/yaman-test.atdb');
        const buffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);

        // Parse the file
        const parsedData = await parseAtdb(uint8Array);
        
        // Get the first person
        if (parsedData.persons.length > 0) {
          const firstPerson = parsedData.persons[0];
          
          let debugStr = `First Person (ID: ${firstPerson.id}):\n`;
          debugStr += `Gender: ${firstPerson.gender}\n`;
          debugStr += `First Name: ${firstPerson.firstName || 'N/A'}\n`;
          debugStr += `Last Name: ${firstPerson.lastName || 'N/A'}\n`;
          debugStr += `Patronymic: ${firstPerson.patronymic || 'N/A'}\n`;
          debugStr += `Birth Date: ${firstPerson.birthDate || 'N/A'}\n`;
          debugStr += `Death Date: ${firstPerson.deathDate || 'N/A'}\n`;
          debugStr += `Birth Place: ${firstPerson.birthPlace || 'N/A'}\n`;
          debugStr += `Death Place: ${firstPerson.deathPlace || 'N/A'}\n`;
          debugStr += `Notes: ${firstPerson.notes || 'N/A'}\n`;
          debugStr += `Father ID: ${firstPerson.fatherId || 'N/A'}\n`;
          debugStr += `Mother ID: ${firstPerson.motherId || 'N/A'}\n`;
          
          setDebugInfo(debugStr);
        } else {
          setDebugInfo("No persons found in the file");
        }
      } catch (error) {
        setDebugInfo(`Error analyzing file: ${error}`);
        console.error('Error analyzing file:', error);
      }
    };

    // Only run analysis if debugging is enabled
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === 'true') {
      analyzeFile();
    }
  }, []);

  if (!debugInfo) return null;

  return (
    <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 p-4 rounded-lg mb-4">
      <h3 className="font-bold mb-2">Debug Information:</h3>
      <pre className="whitespace-pre-wrap break-words text-xs">{debugInfo}</pre>
    </div>
  );
};

export default DebugAnalyzer;