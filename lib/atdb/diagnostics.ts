export type AtdbDiagnosticLevel = 'DEBUG' | 'WARN' | 'ERROR';

export interface AtdbDiagnostic {
  level: AtdbDiagnosticLevel;
  code: string;
  details?: Readonly<Record<string, string | number | boolean>>;
}

export type AtdbDiagnosticLogger = (diagnostic: AtdbDiagnostic) => void;

export const silentAtdbLogger: AtdbDiagnosticLogger = () => undefined;
