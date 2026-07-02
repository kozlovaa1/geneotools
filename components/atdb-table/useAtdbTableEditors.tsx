import React from 'react';
import {
  getDraftValue,
  isFieldDirty,
  type AtdbDraftFieldKey,
  type AtdbEditDraftState,
} from '@/lib/atdbEditDraft';
import { parseAtdbIntegerInput } from '@/lib/atdbIntegerInput';
import {
  formatAtdbPlaceLabel,
  getAtdbPlaceDescendantIds,
} from '@/lib/atdbPlaceLabels';
import type { AtdbFieldName, AtdbWritableEntity } from '@/lib/sqlProcessor';
import type { ParsedAtdb, Person, Place } from '@/lib/types';
import {
  EditableDateCell,
  EditableNumberCell,
  EditableSelectCell,
  EditableTextCell,
  type EditableSelectOption,
} from '../EditableCell';

interface UseAtdbTableEditorsOptions {
  allPlaces: readonly Place[];
  draft?: AtdbEditDraftState;
  sourceData?: ParsedAtdb;
  onDraftFieldChange?: (key: AtdbDraftFieldKey, value: unknown) => void;
  onDraftFieldReset?: (key: AtdbDraftFieldKey) => void;
}

export interface AtdbTableEditors {
  renderTextEditor: (
    entityType: AtdbWritableEntity,
    id: number,
    field: AtdbFieldName,
    ariaLabel: string,
    fallback: unknown,
  ) => React.ReactNode;
  renderNumberEditor: (
    entityType: AtdbWritableEntity,
    id: number,
    field: AtdbFieldName,
    ariaLabel: string,
    fallback: unknown,
  ) => React.ReactNode;
  renderDateEditor: (
    entityType: AtdbWritableEntity,
    id: number,
    field: AtdbFieldName,
    ariaLabel: string,
    fallback: unknown,
    editable: boolean,
  ) => React.ReactNode;
  renderGenderEditor: (person: Person) => React.ReactNode;
  renderPlaceLinkEditor: (
    entityType: AtdbWritableEntity,
    id: number,
    field: AtdbFieldName,
    label: string,
    currentPlaceId: number | null | undefined,
    fallback: unknown,
    options?: {
      editable?: boolean;
      excludeSelfAndDescendantsOf?: number;
    },
  ) => React.ReactNode;
  formatReadOnlyValue: (value: unknown) => string;
}

export function createDraftKey(
  entityType: AtdbWritableEntity,
  id: number,
  field: AtdbFieldName,
): AtdbDraftFieldKey {
  return {
    entityType,
    id,
    field,
  };
}

export function useAtdbTableEditors({
  allPlaces,
  draft,
  sourceData,
  onDraftFieldChange,
  onDraftFieldReset,
}: UseAtdbTableEditorsOptions): AtdbTableEditors {
  const canEdit = Boolean(draft && sourceData && onDraftFieldChange && onDraftFieldReset);
  const createPlaceOptions = React.useCallback((excludeSelfAndDescendantsOf?: number): EditableSelectOption[] => {
    const excludedIds =
      sourceData && typeof excludeSelfAndDescendantsOf === 'number'
        ? new Set([excludeSelfAndDescendantsOf, ...getAtdbPlaceDescendantIds(sourceData, excludeSelfAndDescendantsOf, draft)])
        : new Set<number>();

    return [
      { value: '', label: 'Очистить' },
      ...allPlaces
        .filter((place) => !excludedIds.has(place.id))
        .map((place) => ({
          value: String(place.id),
          label: sourceData ? formatAtdbPlaceLabel(sourceData, place.id, { draft }) : formatPlaceLabel(place),
        })),
    ];
  }, [allPlaces, draft, sourceData]);

  const getDraftAwareValue = React.useCallback((key: AtdbDraftFieldKey): unknown => {
    if (!draft || !sourceData) return undefined;
    return getDraftValue(draft, sourceData, key);
  }, [draft, sourceData]);

  const dirty = React.useCallback((key: AtdbDraftFieldKey): boolean => {
    return Boolean(draft && sourceData && isFieldDirty(draft, sourceData, key));
  }, [draft, sourceData]);

  const updateField = React.useCallback((key: AtdbDraftFieldKey, value: unknown) => {
    onDraftFieldChange?.(key, value);
  }, [onDraftFieldChange]);

  const resetField = React.useCallback((key: AtdbDraftFieldKey) => {
    onDraftFieldReset?.(key);
  }, [onDraftFieldReset]);

  const formatReadOnlyValue = React.useCallback((value: unknown): string => {
    if (value === null || value === undefined || value === '') return '-';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  }, []);

  const renderTextEditor: AtdbTableEditors['renderTextEditor'] = (
    entityType,
    id,
    field,
    ariaLabel,
    fallback,
  ) => {
    const key = createDraftKey(entityType, id, field);
    if (!canEdit) {
      return formatReadOnlyValue(fallback);
    }

    const value = getDraftAwareValue(key);
    return (
      <EditableTextCell
        value={typeof value === 'string' ? value : ''}
        dirty={dirty(key)}
        ariaLabel={ariaLabel}
        onChange={(nextValue) => updateField(key, nextValue)}
        onReset={() => resetField(key)}
      />
    );
  };

  const renderNumberEditor: AtdbTableEditors['renderNumberEditor'] = (
    entityType,
    id,
    field,
    ariaLabel,
    fallback,
  ) => {
    const key = createDraftKey(entityType, id, field);
    if (!canEdit) {
      return formatReadOnlyValue(fallback);
    }

    const value = getDraftAwareValue(key);
    return (
      <EditableNumberCell
        value={typeof value === 'number' ? value : null}
        dirty={dirty(key)}
        ariaLabel={ariaLabel}
        onChange={(nextValue) => updateField(key, nextValue)}
        onReset={() => resetField(key)}
      />
    );
  };

  const renderDateEditor: AtdbTableEditors['renderDateEditor'] = (
    entityType,
    id,
    field,
    ariaLabel,
    fallback,
    editable,
  ) => {
    const key = createDraftKey(entityType, id, field);
    if (!canEdit || !editable) {
      return formatReadOnlyValue(fallback);
    }

    const value = getDraftAwareValue(key);
    return (
      <EditableDateCell
        value={typeof value === 'string' ? value : ''}
        dirty={dirty(key)}
        ariaLabel={ariaLabel}
        onChange={(nextValue) => updateField(key, nextValue)}
        onReset={() => resetField(key)}
      />
    );
  };

  const renderGenderEditor = (person: Person) => {
    const key = createDraftKey('person', person.id, 'gender');
    if (!canEdit) {
      return formatReadOnlyValue(person.gender);
    }

    const value = getDraftAwareValue(key);
    return (
      <EditableSelectCell
        value={value === null ? '' : String(value ?? person.gender)}
        options={[
          { value: '', label: 'Очистить' },
          { value: 'M', label: 'М' },
          { value: 'F', label: 'Ж' },
          { value: 'Unknown', label: 'Неизвестно' },
        ]}
        dirty={dirty(key)}
        ariaLabel="Пол"
        onChange={(nextValue) => updateField(key, nextValue === '' ? null : nextValue)}
        onReset={() => resetField(key)}
      />
    );
  };

  const renderPlaceLinkEditor: AtdbTableEditors['renderPlaceLinkEditor'] = (
    entityType,
    id,
    field,
    label,
    currentPlaceId,
    fallback,
    options = {},
  ) => {
    if (!canEdit || options.editable === false) {
      return formatReadOnlyValue(fallback);
    }

    if (allPlaces.length === 0) {
      return <span className="text-amber-700">Список мест недоступен</span>;
    }

    const key = createDraftKey(entityType, id, field);
    const value = getDraftAwareValue(key);
    return (
      <EditableSelectCell
        value={value === null ? '' : String(value ?? currentPlaceId ?? '')}
        options={createPlaceOptions(options.excludeSelfAndDescendantsOf)}
        dirty={dirty(key)}
        ariaLabel={label}
        onChange={(nextValue) => {
          updateField(key, nextValue === '' ? null : parseAtdbIntegerInput(nextValue));
        }}
        onReset={() => resetField(key)}
      />
    );
  };

  return {
    renderTextEditor,
    renderNumberEditor,
    renderDateEditor,
    renderGenderEditor,
    renderPlaceLinkEditor,
    formatReadOnlyValue,
  };
}

function formatPlaceLabel(place: Place): string {
  return place.name || place.shortName || `ID ${place.id}`;
}
