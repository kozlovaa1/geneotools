export type SqlValue = string | number | Uint8Array | null;
export type SqlParameter = string | number | Uint8Array | null;

export interface SqlJsStatement {
  bind(values: SqlParameter[]): void;
  step(): boolean;
  getAsObject(): Record<string, SqlValue | undefined>;
  free(): void;
}

export interface SqlJsExecResult {
  columns: string[];
  values: SqlValue[][];
}

export interface SqlJsDatabase {
  prepare(sql: string): SqlJsStatement;
  run(sql: string, params?: SqlParameter[]): void;
  exec(sql: string, params?: SqlParameter[]): SqlJsExecResult[];
  export(): Uint8Array;
  close(): void;
}
