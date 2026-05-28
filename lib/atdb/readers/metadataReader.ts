import type { ParsedAtdb } from '../../types';
import type { SqlJsDatabase } from '../dbTypes';

export function readMetadata(db: SqlJsDatabase): ParsedAtdb['metadata'] {
  let metadata: ParsedAtdb['metadata'] = {
    version: undefined,
    guid: undefined,
    sourceGuid: undefined,
    mainLanguage: undefined,
    parameters: undefined
  };

  try {
    const globalStmt = db.prepare("SELECT version, guid, srcguid as sourceGuid, mainlang as mainLanguage, params as parameters FROM Global LIMIT 1");
    if (globalStmt.step()) {
      const globalRow = globalStmt.getAsObject();
      metadata = {
        version: globalRow.version as number | undefined,
        guid: globalRow.guid as string | undefined,
        sourceGuid: globalRow.sourceGuid as string | undefined,
        mainLanguage: globalRow.mainLanguage as string | undefined,
        parameters: globalRow.parameters as string | undefined
      };
    }
    globalStmt.free();
  } catch (err) {
    console.warn('Could not read Global table:', err);
  }

  return metadata;
}
