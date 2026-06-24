import React, { useId, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  focusRingClassName,
  statusSurfaceClassName,
  surfaceTransitionClassName,
} from './uiStyles';

interface FileUploaderProps {
  onFileUpload: (file: File, buffer: ArrayBuffer) => void;
  onFileReadStart?: (file: File) => void;
  onFileReadError?: (file: File) => void;
  acceptedFileTypes?: string[];
  maxFileSize?: number; // in bytes
  disabled?: boolean;
  busyLabel?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
  onFileUpload, 
  onFileReadStart,
  onFileReadError,
  acceptedFileTypes = ['.atdb'], 
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  disabled = false,
  busyLabel = 'Файл обрабатывается...',
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const validateFile = (file: File): boolean => {
    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedFileTypes.includes(fileExtension)) {
      setError(`Неверный тип файла. Допустимые типы: ${acceptedFileTypes.join(', ')}`);
      return false;
    }

    // Check file size
    if (file.size > maxFileSize) {
      setError(`Размер файла превышает предельный размер ${(maxFileSize / (1024 * 1024)).toFixed(2)}МБ`);
      return false;
    }

    setError(null);
    return true;
  };

  const handleFile = (file: File) => {
    if (disabled) {
      return;
    }

    if (!validateFile(file)) {
      return;
    }

    setFileName(file.name);
    onFileReadStart?.(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (buffer) {
        onFileUpload(file, buffer);
      }
    };
    reader.onerror = () => {
      setError('Ошибка чтения файла');
      onFileReadError?.(file);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (disabled) {
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) {
      return;
    }
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFile(file);
    }
  };

  const handleButtonClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    handleButtonClick();
  };

  return (
    <div className="w-full">
      <div 
        className={cn(
          'rounded-lg border-2 border-dashed p-8 text-center',
          focusRingClassName,
          surfaceTransitionClassName,
          disabled ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-70' : 'cursor-pointer border-gray-300 hover:border-gray-400',
          isDragActive && !disabled && 'border-blue-500 bg-blue-50',
        )}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-busy={disabled}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleButtonClick}
        onKeyDown={handleKeyDown}
      >
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={acceptedFileTypes.join(',')}
          disabled={disabled}
          onChange={handleFileInput}
          className="hidden"
        />
        
        <div className="flex flex-col items-center justify-center">
          <UploadCloud className="mb-4 h-12 w-12 text-gray-400" aria-hidden="true" />
          
          <p className="text-lg font-medium text-gray-700">
            {disabled ? busyLabel : fileName ? fileName : 'Перетащите сюда файл .atdb или нажмите для выбора'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Допустимые форматы: {acceptedFileTypes.join(', ')} (Макс. размер: {(maxFileSize / (1024 * 1024)).toFixed(2)}МБ)
          </p>
        </div>
      </div>
      
      {error && (
        <div className={cn(statusSurfaceClassName, 'mt-4 rounded-md bg-red-50 p-3 text-red-700')} role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

export default FileUploader;
