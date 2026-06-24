import React from 'react';
import { X } from 'lucide-react';
import {
  dialogPanelClassName,
  iconButtonClassName,
  primaryButtonClassName,
} from './uiStyles';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  const titleId = React.useId();
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = React.useRef<HTMLElement | null>(null);
  const onCloseRef = React.useRef(onClose);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-blend-multiply bg-gray-900/50">
      <div
        className={`${dialogPanelClassName} relative w-11/12 max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h3 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className={`${iconButtonClassName} h-9 w-9 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100`}
              aria-label="Закрыть"
              title="Закрыть"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
        
        <div className="mb-6">
          {children}
        </div>
        
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className={`${primaryButtonClassName} px-4 py-2`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
