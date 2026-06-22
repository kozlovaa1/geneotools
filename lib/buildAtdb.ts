/**
 * Shared `.atdb` build API.
 * Kept as a compatibility layer for older imports.
 */

export {
  AtdbBuildError,
  applyAtdbChanges,
  buildAtdb,
  formatAtdbBuildError,
} from './sqlProcessor';
export type {
  AtdbBuildIssue,
  AtdbBuildOptions,
  AtdbBuildReport,
  AtdbChangeSet,
  AtdbEntityChange,
  AtdbFieldChange,
  SafeAtdbBuildError,
} from './sqlProcessor';
