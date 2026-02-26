import initSqlJs, { Database } from 'sql.js';

// Define the type for the initialized SQL module
export type SqlModule = Awaited<ReturnType<typeof initSqlJs>>;

let sqlModule: SqlModule | null = null;

// Initialize SQL.js with the WASM file from CDN
export const getSqlModule = async (): Promise<SqlModule> => {
  if (!sqlModule) {
    sqlModule = await initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${file}`
    });
  }
  return sqlModule;
};

// Helper function to create a database instance from buffer
export const createDbFromBuffer = async (buffer: Uint8Array): Promise<Database> => {
  const SQL = await getSqlModule();
  return new SQL.Database(buffer);
};

// Helper function to create a new empty database instance
export const createNewDb = async (): Promise<Database> => {
  const SQL = await getSqlModule();
  return new SQL.Database();
};