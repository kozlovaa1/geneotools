'use client';

import React, { useState } from 'react';
import FileUploader from '@/components/FileUploader';
import ScrollableDataTable from '@/components/ScrollableDataTable';
import Modal from '@/components/Modal';
import type { ParsedAtdb } from '@/lib/types';
import Image from 'next/image';

export default function Home() {
  const [parsedData, setParsedData] = useState<ParsedAtdb | null>(null);
  const [originalBuffer, setOriginalBuffer] = useState<Uint8Array | null>(null);
  const [originalFilename, setOriginalFilename] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleFileUpload = async (file: File, buffer: ArrayBuffer) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Dynamically import the sql processor functions
      const { parseAtdb } = await import('@/lib/sqlProcessor');

      // Convert ArrayBuffer to Uint8Array
      const uint8Array = new Uint8Array(buffer);

      // Parse the .atdb file
      const parsedResult = await parseAtdb(uint8Array);
      setParsedData(parsedResult);
      setOriginalBuffer(uint8Array);
      setOriginalFilename(file.name); // Store the original filename
      setSuccess(`Файл .atdb успешно загружен: ${parsedResult.persons.length} персон, ${parsedResult.families.length} родов, ${parsedResult.events.length} событий.`);
    } catch (err) {
      console.error('Ошибка при разборе файла .atdb:', err);
      setError(`Ошибка при разборе файла .atdb: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!parsedData) {
      setError('Нет данных для загрузки');
      return;
    }

    try {
      // Dynamically import the sql processor functions
      const { buildAtdb } = await import('@/lib/sqlProcessor');
      
      // Build the .atdb file from current data and original buffer
      if (!originalBuffer) {
        throw new Error('Original buffer not available');
      }
      const uint8Array = await buildAtdb(parsedData, originalBuffer);
      
      // Convert Uint8Array to Blob - use type assertion to fix the type issue
      const blob = new Blob([uint8Array] as unknown as BlobPart[], { type: 'application/octet-stream' });
      
      // Create download link with original filename
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalFilename || 'updated_data.atdb';
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Show modal with instructions after download
        if (originalFilename) {
          // Set modal content and show it
          setShowModal(true);
        }
      }, 100);
    } catch (err) {
      console.error('Ошибка при создании файла .atdb:', err);
      setError(`Ошибка при создании файла .atdb: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full flex-col items-center py-8 px-4 bg-white dark:bg-black">
        <div className="w-full px-4">
          <div className="flex items-center justify-center mb-8">
            <Image
              className="dark:invert"
              src="/logo.svg"
              alt="logo"
              width={100}
              height={20}
              priority
            />
          </div>
          
          <h1 className="text-3xl font-semibold text-center text-black dark:text-zinc-50 mb-2">
            GeneoTools - работа с файлами .atdb
          </h1>
          <p className="text-center text-zinc-600 dark:text-zinc-400 mb-8">
            Загружайте, просматривайте и редактируйте генеалогические данные из файлов Древо Жизни 6
          </p>
          
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 mb-8">
            <FileUploader 
              onFileUpload={handleFileUpload} 
              acceptedFileTypes={['.atdb']} 
              maxFileSize={50 * 1024 * 1024} // 50MB
            />
            
            {isLoading && (
              <div className="mt-4 text-center flex flex-col items-center">
                <div className="animate-spin mb-4">
                  <Image
                    className="dark:invert"
                    src="/logo.svg"
                    alt="logo"
                    width={40}
                    height={40}
                    priority
                  />
                </div>
                <p className="text-zinc-600 dark:text-zinc-400">Обработка файла...</p>
              </div>
            )}
            
            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
                {error}
              </div>
            )}
            
            {success && (
              <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-md">
                {success}
              </div>
            )}
            
            {parsedData && (
              <div className="mt-8 -mx-6 flex-1 flex flex-col min-h-0">
                <div className="sticky top-4 z-50 flex justify-center mb-4 px-6">
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-lg"
                  >
                    Скачать обновленный .atdb
                  </button>
                </div>
                <div className="flex-1 overflow-hidden min-h-0">
                  <ScrollableDataTable
                    persons={parsedData.persons}
                    families={parsedData.families}
                    events={parsedData.events}
                    places={parsedData.places || []}
                  />
                </div>
              </div>
            )}
          </div>
          
          <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            <p>GeneoTools - Инструмент для анализа и редактирования генеалогических файлов .atdb</p>
          </div>
        </div>
      </main>

      {/* Modal for download instructions */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Важная информация"
      >
        <p className="text-gray-700 dark:text-gray-300">
          Перед открытием изменённого файла разместите рядом исходную папку с изображениями{' '}
          <span className="font-semibold">{originalFilename ? originalFilename.replace('.atdb', '') + '.files' : '*.files'}</span>
        </p>
      </Modal>
    </div>
  );
}