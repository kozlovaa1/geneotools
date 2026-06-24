'use client';

import React from 'react';
import { Check, Eye, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  createAtdbBatchEditFingerprint,
  getAtdbBatchEditableField,
  getAtdbBatchEditableFields,
  parseAtdbBatchIntegerInput,
  type AtdbBatchEditableField,
  type AtdbBatchEditAction,
  type AtdbBatchEditOperation,
  type AtdbBatchEditPreview,
  type AtdbBatchEditScopeType,
  type AtdbBatchPredicateOperator,
  type AtdbBatchPreviewReason,
} from '@/lib/atdbBatchEdit';
import type { AtdbEditDraftState } from '@/lib/atdbEditDraft';
import type { AtdbFieldName, AtdbWritableEntity } from '@/lib/sqlProcessor';
import type { ParsedAtdb, Place } from '@/lib/types';
import {
  checkboxClassName,
  dialogPanelClassName,
  iconButtonClassName,
  inputClassName,
  primaryButtonClassName,
  statusSurfaceClassName,
  successButtonClassName,
} from './uiStyles';

interface BulkEditDialogProps {
  isOpen: boolean;
  activeEntity: AtdbWritableEntity;
  data: ParsedAtdb;
  draft: AtdbEditDraftState;
  selectedIds: readonly number[];
  preview: AtdbBatchEditPreview | null;
  isExportPending: boolean;
  isPreviewPending: boolean;
  isApplyPending: boolean;
  onPreview: (operation: AtdbBatchEditOperation) => void;
  onApply: (preview: AtdbBatchEditPreview) => void;
  onClose: () => void;
}

const ENTITY_LABELS: Record<AtdbWritableEntity, string> = {
  person: 'Персоны',
  family: 'Роды',
  place: 'Места',
};

const OPERATOR_LABELS: Record<AtdbBatchPredicateOperator, string> = {
  contains: 'содержит',
  equals: 'равно',
  empty: 'пусто',
  'not-empty': 'не пусто',
};

const REASON_LABELS: Record<AtdbBatchPreviewReason, string> = {
  'invalid-action': 'недоступное действие',
  'invalid-scope': 'недоступная область',
  'invalid-value': 'недоступное значение',
  'unsupported-entity': 'тип записей недоступен',
  'unsupported-field': 'поле недоступно',
  'unsupported-operation': 'операция недоступна',
  'replace-not-supported': 'замена недоступна для поля',
  'empty-search': 'строка поиска не задана',
  'missing-record': 'запись не найдена',
  'predicate-miss': 'условие не совпало',
  'place-not-found': 'место не найдено',
  'not-editable-link': 'ссылка недоступна для записи',
  'no-change': 'нет изменения',
  'stale-preview': 'предпросмотр устарел',
};

function fieldOptionKey(field: AtdbBatchEditableField): string {
  return `${field.entityType}:${field.field}`;
}

function firstField(fields: readonly AtdbBatchEditableField[]): AtdbFieldName {
  return fields[0]?.field ?? 'firstName';
}

function placeLabel(place: Place): string {
  return place.name || place.shortName || `ID ${place.id}`;
}

function formatValue(value: unknown, field: AtdbBatchEditableField | null, places: readonly Place[]): string {
  if (value === null || value === undefined) return '-';
  if (value === '') return 'пустая строка';
  if (field?.valueKind === 'place-link' && typeof value === 'number') {
    return places.find((place) => place.id === value) ? placeLabel(places.find((place) => place.id === value)!) : `ID ${value}`;
  }
  return String(value);
}

export default function BulkEditDialog({
  isOpen,
  activeEntity,
  data,
  draft,
  selectedIds,
  preview,
  isExportPending,
  isPreviewPending,
  isApplyPending,
  onPreview,
  onApply,
  onClose,
}: BulkEditDialogProps) {
  const titleId = React.useId();
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = React.useRef<HTMLElement | null>(null);
  const onCloseRef = React.useRef(onClose);
  const fields = React.useMemo(() => getAtdbBatchEditableFields(activeEntity), [activeEntity]);
  const [fieldName, setFieldName] = React.useState<AtdbFieldName>(() => firstField(fields));
  const [scopeType, setScopeType] = React.useState<AtdbBatchEditScopeType>('selected');
  const [predicateField, setPredicateField] = React.useState<AtdbFieldName>(() => firstField(fields));
  const [predicateOperator, setPredicateOperator] = React.useState<AtdbBatchPredicateOperator>('contains');
  const [predicateValue, setPredicateValue] = React.useState('');
  const [predicateCaseSensitive, setPredicateCaseSensitive] = React.useState(false);
  const [action, setAction] = React.useState<AtdbBatchEditAction>('fill');
  const [textValue, setTextValue] = React.useState('');
  const [numberValue, setNumberValue] = React.useState('');
  const [genderValue, setGenderValue] = React.useState('Unknown');
  const [placeValue, setPlaceValue] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [replacementText, setReplacementText] = React.useState('');
  const [replaceCaseSensitive, setReplaceCaseSensitive] = React.useState(false);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousActiveElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElementRef.current?.focus();
    };
  }, [isOpen]);

  React.useEffect(() => {
    const nextField = firstField(fields);
    setFieldName((currentField) =>
      fields.some((field) => field.field === currentField) ? currentField : nextField,
    );
    setPredicateField((currentField) =>
      fields.some((field) => field.field === currentField) ? currentField : nextField,
    );
  }, [fields]);

  const selectedField = getAtdbBatchEditableField(activeEntity, fieldName);

  React.useEffect(() => {
    if (selectedField && action === 'replace' && !selectedField.supportsReplace) {
      setAction('fill');
    }
  }, [action, selectedField]);

  const operation = React.useMemo<AtdbBatchEditOperation | null>(() => {
    const field = getAtdbBatchEditableField(activeEntity, fieldName);
    if (!field) return null;

    const scope =
      scopeType === 'selected'
        ? { type: 'selected' as const, ids: selectedIds }
        : scopeType === 'predicate'
          ? {
              type: 'predicate' as const,
              predicate: {
                field: predicateField,
                operator: predicateOperator,
                value: predicateValue,
                caseSensitive: predicateCaseSensitive,
              },
            }
          : { type: 'all' as const };

    if (action === 'replace') {
      return {
        entityType: activeEntity,
        field: fieldName,
        action,
        scope,
        searchText,
        replacementText,
        caseSensitive: replaceCaseSensitive,
      };
    }

    if (action === 'clear') {
      return {
        entityType: activeEntity,
        field: fieldName,
        action,
        scope,
      };
    }

    return {
      entityType: activeEntity,
      field: fieldName,
      action,
      scope,
      value: valueForField(field, textValue, numberValue, genderValue, placeValue),
    };
  }, [
    activeEntity,
    action,
    fieldName,
    genderValue,
    numberValue,
    placeValue,
    predicateCaseSensitive,
    predicateField,
    predicateOperator,
    predicateValue,
    replaceCaseSensitive,
    replacementText,
    scopeType,
    searchText,
    selectedIds,
    textValue,
  ]);

  const currentFingerprint = React.useMemo(
    () => (preview && operation ? createAtdbBatchEditFingerprint(data, draft, operation) : null),
    [data, draft, operation, preview],
  );
  const previewIsCurrent = Boolean(preview && currentFingerprint && preview.fingerprint === currentFingerprint);
  const canPreview = Boolean(
    operation
    && isOperationReady(selectedField, action, numberValue, placeValue, searchText)
    && !isPreviewPending
    && !isApplyPending
    && !isExportPending,
  );
  const canApply = Boolean(
    preview
    && previewIsCurrent
    && preview.valid
    && preview.counts.affected > 0
    && !isPreviewPending
    && !isApplyPending
    && !isExportPending,
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-950/50 px-3 py-6">
      <div
        className={cn(dialogPanelClassName, 'flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-gray-950">Массовое редактирование</h2>
            <p className="mt-1 text-sm text-gray-600">{ENTITY_LABELS[activeEntity]}</p>
          </div>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            className={cn(iconButtonClassName, 'h-9 w-9')}
            aria-label="Закрыть"
            title="Закрыть"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Поле
              <select
                value={fieldName}
                onChange={(event) => setFieldName(event.target.value as AtdbFieldName)}
                className={inputClassName}
              >
                {fields.map((field) => (
                  <option key={fieldOptionKey(field)} value={field.field}>
                    {field.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Область
              <select
                value={scopeType}
                onChange={(event) => setScopeType(event.target.value as AtdbBatchEditScopeType)}
                className={inputClassName}
              >
                <option value="selected">Выбранные строки ({selectedIds.length})</option>
                <option value="all">Все строки вкладки</option>
                <option value="predicate">Строки по условию</option>
              </select>
            </label>

            {scopeType === 'predicate' && (
              <>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Поле условия
                  <select
                    value={predicateField}
                    onChange={(event) => setPredicateField(event.target.value as AtdbFieldName)}
                    className={inputClassName}
                  >
                    {fields.map((field) => (
                      <option key={fieldOptionKey(field)} value={field.field}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Условие
                  <select
                    value={predicateOperator}
                    onChange={(event) => setPredicateOperator(event.target.value as AtdbBatchPredicateOperator)}
                    className={inputClassName}
                  >
                    {Object.entries(OPERATOR_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {(predicateOperator === 'contains' || predicateOperator === 'equals') && (
                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    Значение условия
                    <input
                      type="text"
                      value={predicateValue}
                      onChange={(event) => setPredicateValue(event.target.value)}
                      className={inputClassName}
                    />
                  </label>
                )}
                <label className="flex items-center gap-2 self-end text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={predicateCaseSensitive}
                    onChange={(event) => setPredicateCaseSensitive(event.target.checked)}
                    className={checkboxClassName}
                  />
                  Учитывать регистр
                </label>
              </>
            )}

            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Операция
              <select
                value={action}
                onChange={(event) => setAction(event.target.value as AtdbBatchEditAction)}
                className={inputClassName}
              >
                <option value="fill">Заполнить</option>
                <option value="clear">Очистить</option>
                {selectedField?.supportsReplace && <option value="replace">Заменить строку</option>}
              </select>
            </label>

            {selectedField && action === 'fill' && (
              <FillValueControl
                field={selectedField}
                places={data.places}
                textValue={textValue}
                numberValue={numberValue}
                genderValue={genderValue}
                placeValue={placeValue}
                onTextValueChange={setTextValue}
                onNumberValueChange={setNumberValue}
                onGenderValueChange={setGenderValue}
                onPlaceValueChange={setPlaceValue}
              />
            )}

            {action === 'replace' && (
              <>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Найти
                  <input
                    type="text"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    className={inputClassName}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Заменить на
                  <input
                    type="text"
                    value={replacementText}
                    onChange={(event) => setReplacementText(event.target.value)}
                    className={inputClassName}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={replaceCaseSensitive}
                    onChange={(event) => setReplaceCaseSensitive(event.target.checked)}
                    className={checkboxClassName}
                  />
                  Учитывать регистр
                </label>
              </>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4">
            <button
              type="button"
              disabled={!canPreview}
              onClick={() => operation && onPreview(operation)}
              className={cn(primaryButtonClassName, 'px-4 py-2')}
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
              {isPreviewPending ? 'Готовим предпросмотр...' : 'Предпросмотр'}
            </button>
            <button
              type="button"
              disabled={!canApply}
              onClick={() => preview && onApply(preview)}
              className={cn(successButtonClassName, 'px-4 py-2')}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {isApplyPending ? 'Применяем...' : 'Применить в черновик'}
            </button>
            {(isPreviewPending || isApplyPending) && (
              <span className={cn(statusSurfaceClassName, 'rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700')} role="status" aria-live="polite">
                {isPreviewPending ? 'Идёт подготовка предпросмотра' : 'Идёт применение в черновик'}
              </span>
            )}
          </div>

          <PreviewResult preview={preview} previewIsCurrent={previewIsCurrent} fields={fields} places={data.places} />
        </div>
      </div>
    </div>
  );
}

function FillValueControl({
  field,
  places,
  textValue,
  numberValue,
  genderValue,
  placeValue,
  onTextValueChange,
  onNumberValueChange,
  onGenderValueChange,
  onPlaceValueChange,
}: {
  field: AtdbBatchEditableField;
  places: readonly Place[];
  textValue: string;
  numberValue: string;
  genderValue: string;
  placeValue: string;
  onTextValueChange: (value: string) => void;
  onNumberValueChange: (value: string) => void;
  onGenderValueChange: (value: string) => void;
  onPlaceValueChange: (value: string) => void;
}) {
  if (field.valueKind === 'number') {
    return (
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Значение
        <input
          type="number"
          step={1}
          value={numberValue}
          onChange={(event) => onNumberValueChange(event.target.value)}
          className={inputClassName}
        />
      </label>
    );
  }

  if (field.valueKind === 'gender') {
    return (
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Значение
        <select
          value={genderValue}
          onChange={(event) => onGenderValueChange(event.target.value)}
          className={inputClassName}
        >
          <option value="M">M</option>
          <option value="F">F</option>
          <option value="Unknown">Unknown</option>
        </select>
      </label>
    );
  }

  if (field.valueKind === 'place-link') {
    return (
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Значение
        <select
          value={placeValue}
          onChange={(event) => onPlaceValueChange(event.target.value)}
          className={inputClassName}
        >
          <option value="">Выберите место</option>
          {places.map((place) => (
            <option key={place.id} value={place.id}>
              {placeLabel(place)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
      Значение
      <input
        type="text"
        value={textValue}
        onChange={(event) => onTextValueChange(event.target.value)}
        className={inputClassName}
      />
    </label>
  );
}

function PreviewResult({
  preview,
  previewIsCurrent,
  fields,
  places,
}: {
  preview: AtdbBatchEditPreview | null;
  previewIsCurrent: boolean;
  fields: readonly AtdbBatchEditableField[];
  places: readonly Place[];
}) {
  if (!preview) return null;

  const affectedRows = preview.rows.filter((row) => row.status === 'affected');
  const dirtyOverwriteCount = affectedRows.filter((row) => row.overwritesDirty).length;
  const field = fields.find((candidate) => candidate.field === preview.operation.field) ?? null;
  const reasonEntries = Object.entries(preview.reasonCounts).filter(([, count]) => Number(count) > 0);

  return (
    <div className={cn(statusSurfaceClassName, 'mt-5 border-t border-gray-200 pt-4')} role="status" aria-live="polite">
      <p
        className={cn(
          'mb-3 rounded-md border px-3 py-2 text-sm',
          previewIsCurrent
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-amber-200 bg-amber-50 text-amber-800',
        )}
      >
        {previewIsCurrent ? 'Предпросмотр актуален' : REASON_LABELS['stale-preview']}
      </p>
      {!preview.valid && preview.validation.code && (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {REASON_LABELS[preview.validation.code]}
        </p>
      )}
      <div className="grid gap-2 text-sm text-gray-800 sm:grid-cols-4">
        <span>Всего: {preview.counts.total}</span>
        <span>Изменится: {preview.counts.affected}</span>
        <span>Пропущено: {preview.counts.skipped}</span>
        <span>Без изменений: {preview.counts.noop}</span>
      </div>
      {preview.valid && preview.counts.affected === 0 && (
        <p className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          Нет изменений для применения.
        </p>
      )}
      {dirtyOverwriteCount > 0 && (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Уже изменённых полей будет перезаписано: {dirtyOverwriteCount}
        </p>
      )}
      {reasonEntries.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-900">Причины</h3>
          <ul className="mt-2 grid gap-1 text-sm text-gray-700 sm:grid-cols-2">
            {reasonEntries.map(([reason, count]) => (
              <li key={reason}>
                {REASON_LABELS[reason as AtdbBatchPreviewReason] ?? reason}: {count}
              </li>
            ))}
          </ul>
        </div>
      )}
      {affectedRows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-gray-600">
              <tr>
                <th className="px-2 py-2 font-medium">ID</th>
                <th className="px-2 py-2 font-medium">Поле</th>
                <th className="px-2 py-2 font-medium">Сейчас</th>
                <th className="px-2 py-2 font-medium">Будет</th>
              </tr>
            </thead>
            <tbody>
              {affectedRows.slice(0, 50).map((row) => (
                <tr key={`${row.entityType}:${row.id}:${row.field}`} className="border-b border-gray-100">
                  <td className="px-2 py-2">{row.id}</td>
                  <td className="px-2 py-2">{field?.label ?? row.field}</td>
                  <td className="px-2 py-2">{formatValue(row.currentValue, field, places)}</td>
                  <td className="px-2 py-2">{formatValue(row.nextValue, field, places)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {affectedRows.length > 50 && (
            <p className="mt-2 text-sm text-gray-600">Показано 50 из {affectedRows.length}</p>
          )}
        </div>
      )}
    </div>
  );
}

function valueForField(
  field: AtdbBatchEditableField,
  textValue: string,
  numberValue: string,
  genderValue: string,
  placeValue: string,
): string | number | undefined {
  if (field.valueKind === 'number') {
    return parseAtdbBatchIntegerInput(numberValue);
  }

  if (field.valueKind === 'gender') {
    return genderValue;
  }

  if (field.valueKind === 'place-link') {
    return parseAtdbBatchIntegerInput(placeValue);
  }

  return textValue;
}

function isOperationReady(
  field: AtdbBatchEditableField | null,
  action: AtdbBatchEditAction,
  numberValue: string,
  placeValue: string,
  searchText: string,
): boolean {
  if (!field) return false;
  if (action === 'replace') return field.supportsReplace && searchText.length > 0;
  if (action === 'clear') return field.supportsClear;
  if (field.valueKind === 'number') return parseAtdbBatchIntegerInput(numberValue) !== undefined;
  if (field.valueKind === 'place-link') return parseAtdbBatchIntegerInput(placeValue) !== undefined;
  return field.supportsFill;
}
