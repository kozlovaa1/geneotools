import type { ParsedAtdb } from '../../types';
import type { SqlJsDatabase } from '../dbTypes';

export function writeMetadata(db: SqlJsDatabase, metadata: ParsedAtdb['metadata'] | undefined): void {
  if (!metadata) {
    return;
  }

    // First, delete any existing metadata
    db.run('DELETE FROM Global');

    // Then insert the updated metadata
    db.run(
      'INSERT INTO Global (version, guid, srcguid, mainlang, params) VALUES (?, ?, ?, ?, ?)',
      [
        metadata.version || null,
        metadata.guid || null,
        metadata.sourceGuid || null,
        metadata.mainLanguage || null,
        metadata.parameters || null
      ]
    );
}
