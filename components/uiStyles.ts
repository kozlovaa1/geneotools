import { cn } from '@/lib/utils';

export const focusRingClassName =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';

export const surfaceTransitionClassName = 'gt-surface-transition';
export const statusSurfaceClassName = 'gt-status-surface gt-surface-transition';
export const dialogPanelClassName = 'gt-dialog-panel gt-surface-transition';

export const inputBaseClassName = cn(
  'rounded-md border border-gray-300 bg-white text-sm text-gray-950 outline-none',
  surfaceTransitionClassName,
  'focus:border-blue-500 focus:ring-2 focus:ring-blue-100',
  'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500',
);

export const inputClassName = cn('h-10 px-3', inputBaseClassName);

export const compactInputClassName = cn('h-8 px-2', inputBaseClassName);

export const dirtyInputClassName =
  'border-amber-400 bg-amber-50 focus:border-amber-500 focus:ring-amber-100';

export const checkboxClassName =
  'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40';

export const buttonBaseClassName = cn(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium',
  surfaceTransitionClassName,
  focusRingClassName,
  'disabled:cursor-not-allowed',
);

export const primaryButtonClassName = cn(
  buttonBaseClassName,
  'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-600',
);

export const secondaryButtonClassName = cn(
  buttonBaseClassName,
  'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400',
);

export const successButtonClassName = cn(
  buttonBaseClassName,
  'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-300 disabled:text-gray-600',
);

export const iconButtonClassName = cn(
  'inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600',
  surfaceTransitionClassName,
  focusRingClassName,
  'hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400',
);

export const statusBadgeClassName =
  'inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-zinc-700 gt-surface-transition';
