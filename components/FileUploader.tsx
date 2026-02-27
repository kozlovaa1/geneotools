import React, { useState } from 'react';

interface FileUploaderProps {
  onFileUpload: (file: File, buffer: ArrayBuffer) => void;
  acceptedFileTypes?: string[];
  maxFileSize?: number; // in bytes
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
  onFileUpload, 
  acceptedFileTypes = ['.atdb'], 
  maxFileSize = 10 * 1024 * 1024 // 10MB default
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (!validateFile(file)) {
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (buffer) {
        onFileUpload(file, buffer);
      }
    };
    reader.onerror = () => {
      setError('Ошибка чтения файла');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
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
    document.getElementById('file-input')?.click();
  };

  return (
    <div className="w-full">
      <div 
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleButtonClick}
      >
        <input
          id="file-input"
          type="file"
          accept={acceptedFileTypes.join(',')}
          onChange={handleFileInput}
          className="hidden"
        />
        
        <div className="flex flex-col items-center justify-center">
          <svg 
            className="w-12 h-12 text-gray-400 mb-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            ></path>
          </svg>
          
          <p className="text-lg font-medium text-gray-700">
            {fileName ? fileName : 'Перетащите сюда файл .atdb или нажмите для выбора'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Допустимые форматы: {acceptedFileTypes.join(', ')} (Макс. размер: {(maxFileSize / (1024 * 1024)).toFixed(2)}МБ)
          </p>
        </div>
      </div>
      
      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}
    </div>
  );
};

export default FileUploader;