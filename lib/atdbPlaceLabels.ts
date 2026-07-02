import {
  getDraftValue,
  type AtdbEditDraftState,
} from './atdbEditDraft';
import type { ParsedAtdb, Place } from './types';
import type { AtdbDiagnosticLogger } from './atdb/diagnostics';

const MAX_PLACE_PATH_DEPTH = 16;

export interface AtdbPlaceLabelOptions {
  draft?: AtdbEditDraftState | null;
  logger?: AtdbDiagnosticLogger;
  maxDepth?: number;
}

export function formatAtdbPlaceLabel(
  data: ParsedAtdb,
  placeId: number,
  options: AtdbPlaceLabelOptions = {},
): string {
  const path = collectPlacePath(data, placeId, options);
  if (path.length === 0) return `ID ${placeId}`;
  return path.map((place) => formatPlaceSegment(data, place, options.draft)).join(', ');
}

export function formatAtdbPlaceParentPath(
  data: ParsedAtdb,
  placeId: number,
  options: AtdbPlaceLabelOptions = {},
): string {
  const place = data.places.find((candidate) => candidate.id === placeId);
  const parentId = place ? getDraftAwarePlaceParentId(data, place, options.draft) : undefined;
  if (typeof parentId !== 'number') return '';
  return formatAtdbPlaceLabel(data, parentId, options);
}

export function getAtdbPlaceDescendantIds(
  data: ParsedAtdb,
  placeId: number,
  draft?: AtdbEditDraftState | null,
): Set<number> {
  const descendants = new Set<number>();
  let changed = true;

  while (changed) {
    changed = false;
    for (const place of data.places) {
      if (place.id === placeId || descendants.has(place.id)) continue;
      const parentId = getDraftAwarePlaceParentId(data, place, draft);
      if (parentId === placeId || (typeof parentId === 'number' && descendants.has(parentId))) {
        descendants.add(place.id);
        changed = true;
      }
    }
  }

  return descendants;
}

export function wouldCreateAtdbPlaceCycle(
  data: ParsedAtdb,
  placeId: number,
  parentId: number | null | undefined,
  draft?: AtdbEditDraftState | null,
): boolean {
  if (parentId === null || parentId === undefined) return false;
  if (parentId === placeId) return true;
  return getAtdbPlaceDescendantIds(data, placeId, draft).has(parentId);
}

function collectPlacePath(
  data: ParsedAtdb,
  placeId: number,
  options: AtdbPlaceLabelOptions,
): Place[] {
  const maxDepth = options.maxDepth ?? MAX_PLACE_PATH_DEPTH;
  const placeById = new Map(data.places.map((place) => [place.id, place]));
  const path: Place[] = [];
  const seen = new Set<number>();
  let current = placeById.get(placeId);
  let depth = 0;

  while (current && depth < maxDepth) {
    if (seen.has(current.id)) {
      options.logger?.({ level: 'WARN', code: 'place.path.cycle', details: { count: seen.size, depth } });
      return path.length > 0 ? path : [{ id: placeId }];
    }

    path.push(current);
    seen.add(current.id);
    const parentId = getDraftAwarePlaceParentId(data, current, options.draft);
    current = typeof parentId === 'number' ? placeById.get(parentId) : undefined;
    depth++;
  }

  if (current) {
    options.logger?.({ level: 'WARN', code: 'place.path.truncated', details: { count: path.length, depth } });
  }

  return path;
}

function formatPlaceSegment(data: ParsedAtdb, place: Place, draft?: AtdbEditDraftState | null): string {
  const name = getDraftAwarePlaceText(data, place, 'name', draft);
  const shortName = getDraftAwarePlaceText(data, place, 'shortName', draft);
  const base = name || shortName || `ID ${place.id}`;
  const namingDate = place.placeNamingDateInfo?.display || place.placeNamingDate;
  return namingDate ? `${base} (${namingDate})` : base;
}

function getDraftAwarePlaceText(
  data: ParsedAtdb,
  place: Place,
  field: 'name' | 'shortName',
  draft?: AtdbEditDraftState | null,
): string {
  if (!draft) return getText(place[field]);
  const value = getDraftValue(draft, data, { entityType: 'place', id: place.id, field });
  return getText(value);
}

function getDraftAwarePlaceParentId(
  data: ParsedAtdb,
  place: Place,
  draft?: AtdbEditDraftState | null,
): number | undefined {
  if (!draft) return place.parentId;
  const value = getDraftValue(draft, data, { entityType: 'place', id: place.id, field: 'parentId' });
  return typeof value === 'number' ? value : undefined;
}

function getText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
