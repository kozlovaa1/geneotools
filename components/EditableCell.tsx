import React from 'react';
import { RotateCcw } from 'lucide-react';
import { splitAtdbDate } from '@/lib/atdb/dates';
import { parseAtdbIntegerInput } from '@/lib/atdbIntegerInput';
import { cn } from '@/lib/utils';
import {
  compactInputClassName,
  dirtyInputClassName,
  iconButtonClassName,
} from './uiStyles';

export interface EditableSelectOption {
  value: string;
  label: string;
}

interface EditableCellFrameProps {
  dirty: boolean;
  onReset: () => void;
  children: React.ReactNode;
}

interface EditableTextCellProps {
  value: string | null | undefined;
  dirty: boolean;
  ariaLabel: string;
  onChange: (value: string) => void;
  onReset: () => void;
}

interface EditableSelectCellProps {
  value: string | number | null | undefined;
  options: EditableSelectOption[];
  dirty: boolean;
  ariaLabel: string;
  onChange: (value: string) => void;
  onReset: () => void;
}

interface EditableNumberCellProps {
  value: number | null | undefined;
  dirty: boolean;
  ariaLabel: string;
  onChange: (value: number | null) => void;
  onReset: () => void;
}

interface EditableDateCellProps {
  value: string | null | undefined;
  dirty: boolean;
  ariaLabel: string;
  onChange: (value: string | null) => void;
  onReset: () => void;
}

function EditableCellFrame({ dirty, onReset, children }: EditableCellFrameProps) {
  return (
    <div className="flex min-w-[11rem] items-center gap-1">
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        title="Сбросить поле"
        aria-label="Сбросить поле"
        disabled={!dirty}
        onClick={onReset}
        className={cn(iconButtonClassName, 'h-8 w-8 shrink-0 disabled:opacity-30')}
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function EditableTextCell({ value, dirty, ariaLabel, onChange, onReset }: EditableTextCellProps) {
  return (
    <EditableCellFrame dirty={dirty} onReset={onReset}>
      <input
        type="text"
        aria-label={ariaLabel}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className={cn(compactInputClassName, 'w-full min-w-0', dirty && dirtyInputClassName)}
      />
    </EditableCellFrame>
  );
}

export function EditableDateCell({ value, dirty, ariaLabel, onChange, onReset }: EditableDateCellProps) {
  const [rawValue, setRawValue] = React.useState(value ?? '');
  const isValid = rawValue === '' || splitAtdbDate(rawValue) !== null;

  React.useEffect(() => {
    setRawValue(value ?? '');
  }, [value]);

  return (
    <EditableCellFrame dirty={dirty} onReset={onReset}>
      <input
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        aria-invalid={!isValid}
        value={rawValue}
        onChange={(event) => {
          const nextValue = event.target.value;
          setRawValue(nextValue);
          if (nextValue === '') {
            onChange(null);
          } else if (splitAtdbDate(nextValue) !== null) {
            onChange(nextValue);
          }
        }}
        className={cn(
          compactInputClassName,
          'w-full min-w-0',
          dirty && dirtyInputClassName,
          !isValid && 'border-red-300 bg-red-50 text-red-800 focus:ring-red-200',
        )}
      />
    </EditableCellFrame>
  );
}

export function EditableSelectCell({
  value,
  options,
  dirty,
  ariaLabel,
  onChange,
  onReset,
}: EditableSelectCellProps) {
  return (
    <EditableCellFrame dirty={dirty} onReset={onReset}>
      <select
        aria-label={ariaLabel}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className={cn(compactInputClassName, 'w-full min-w-0', dirty && dirtyInputClassName)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </EditableCellFrame>
  );
}

export function EditableNumberCell({ value, dirty, ariaLabel, onChange, onReset }: EditableNumberCellProps) {
  return (
    <EditableCellFrame dirty={dirty} onReset={onReset}>
      <input
        type="number"
        step={1}
        aria-label={ariaLabel}
        value={value ?? ''}
        onChange={(event) => {
          const nextValue = event.target.value.trim();
          if (nextValue === '') {
            onChange(null);
            return;
          }

          const parsed = parseAtdbIntegerInput(nextValue);
          if (parsed !== undefined) {
            onChange(parsed);
          }
        }}
        className={cn(compactInputClassName, 'w-full min-w-0', dirty && dirtyInputClassName)}
      />
    </EditableCellFrame>
  );
}
