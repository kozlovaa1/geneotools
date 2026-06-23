'use client';

import React, { useMemo, useState } from 'react';
import FileUploader from '@/components/FileUploader';
import ScrollableDataTable from '@/components/ScrollableDataTable';
import Modal from '@/components/Modal';
import BulkEditDialog from '@/components/BulkEditDialog';
import type { ParsedAtdb } from '@/lib/types';
import {
  clearDraft,
  buildAtdbChangeSet,
  countDraftChanges,
  createEmptyAtdbEditDraft,
  resetDraftEntity,
  resetDraftField,
  setDraftField,
  type AtdbDraftFieldKey,
  type AtdbEditDraftState,
} from '@/lib/atdbEditDraft';
import {
  applyAtdbBatchEdit,
  previewAtdbBatchEdit,
  type AtdbBatchEditOperation,
  type AtdbBatchEditPreview,
} from '@/lib/atdbBatchEdit';
import {
  createAtdbTableQuery,
  createEmptyAtdbTableQueryState,
  getWritableEntityForAtdbTableEntity,
  queryAtdbTableRows,
  type AtdbTableEntity,
  type AtdbTableQueryResult,
  type AtdbTableQueryState,
} from '@/lib/atdbTableView';
import type { AtdbWritableEntity } from '@/lib/sqlProcessor';
import Image from 'next/image';
import { Download, RotateCcw, Wand2 } from 'lucide-react';

type ActiveEntity = AtdbTableEntity;
type SelectionState = Record<AtdbWritableEntity, number[]>;
type TableQueryStateByEntity = Record<AtdbTableEntity, AtdbTableQueryState>;
type TableQueryResultByEntity = Record<AtdbTableEntity, AtdbTableQueryResult>;

function createEmptySelection(): SelectionState {
  return {
    person: [],
    family: [],
    place: [],
  };
}

function createEmptyTableQueries(): TableQueryStateByEntity {
  return {
    persons: createEmptyAtdbTableQueryState(),
    families: createEmptyAtdbTableQueryState(),
    events: createEmptyAtdbTableQueryState(),
    places: createEmptyAtdbTableQueryState(),
  };
}

function mergeSelectedIds(currentIds: readonly number[], nextIds: readonly number[]): number[] {
  const selected = new Set(currentIds);
  const merged = [...currentIds];
  for (const id of nextIds) {
    if (!Number.isInteger(id) || selected.has(id)) continue;
    selected.add(id);
    merged.push(id);
  }
  return merged;
}

export default function Home() {
  const [parsedData, setParsedData] = useState<ParsedAtdb | null>(null);
  const [originalBuffer, setOriginalBuffer] = useState<Uint8Array | null>(null);
  const [originalFilename, setOriginalFilename] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<AtdbEditDraftState>(() => createEmptyAtdbEditDraft());
  const [activeEntity, setActiveEntity] = useState<ActiveEntity>('persons');
  const [selectedRows, setSelectedRows] = useState<SelectionState>(() => createEmptySelection());
  const [tableQueries, setTableQueries] = useState<TableQueryStateByEntity>(() => createEmptyTableQueries());
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<AtdbBatchEditPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const draftChangeCount = useMemo(
    () => (parsedData ? countDraftChanges(parsedData, editDraft) : { entities: 0, fields: 0 }),
    [editDraft, parsedData],
  );
  const activeWritableEntity = getWritableEntityForAtdbTableEntity(activeEntity);
  const activeSelectedIds = activeWritableEntity ? selectedRows[activeWritableEntity] : [];
  const hasDraftChanges = draftChangeCount.fields > 0;
  const tableQueryResults = useMemo<TableQueryResultByEntity | null>(() => {
    if (!parsedData) return null;

    return {
      persons: queryAtdbTableRows(parsedData, editDraft, createAtdbTableQuery('persons', tableQueries.persons)),
      families: queryAtdbTableRows(parsedData, editDraft, createAtdbTableQuery('families', tableQueries.families)),
      events: queryAtdbTableRows(parsedData, editDraft, createAtdbTableQuery('events', tableQueries.events)),
      places: queryAtdbTableRows(parsedData, editDraft, createAtdbTableQuery('places', tableQueries.places)),
    };
  }, [editDraft, parsedData, tableQueries]);
  const activeTableQuery = tableQueries[activeEntity];
  const activeTableQueryResult = tableQueryResults?.[activeEntity] ?? null;

  const handleFileUpload = async (file: File, buffer: ArrayBuffer) => {
    setIsLoading(true);
    setParsedData(null);
    setOriginalBuffer(null);
    setOriginalFilename(null);
    setEditDraft(clearDraft());
    setSelectedRows(createEmptySelection());
    setTableQueries(createEmptyTableQueries());
    setActiveEntity('persons');
    setBulkPreview(null);
    setIsBulkDialogOpen(false);
    setError(null);
    setSuccess(null);
    setShowModal(false);
    setIsDownloading(false);

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
      const { formatAtdbBuildError } = await import('@/lib/sqlProcessor');
      const safeError = formatAtdbBuildError(err);
      console.error('Ошибка при разборе файла .atdb:', { code: safeError.code, issueCount: safeError.issueCount });
      setError(`Ошибка при разборе файла .atdb: ${safeError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDraftFieldChange = (key: AtdbDraftFieldKey, value: unknown) => {
    if (!parsedData) {
      return;
    }

    setEditDraft((currentDraft) => setDraftField(currentDraft, parsedData, key, value));
    setBulkPreview(null);
    setError(null);
    setSuccess(null);
  };

  const handleDraftFieldReset = (key: AtdbDraftFieldKey) => {
    setEditDraft((currentDraft) => resetDraftField(currentDraft, key));
    setBulkPreview(null);
    setError(null);
    setSuccess(null);
  };

  const handleDraftEntityReset = (entityType: AtdbDraftFieldKey['entityType'], id: number) => {
    setEditDraft((currentDraft) => resetDraftEntity(currentDraft, entityType, id));
    setBulkPreview(null);
    setError(null);
    setSuccess(null);
  };

  const handleActiveEntityChange = (nextActiveEntity: ActiveEntity) => {
    setActiveEntity(nextActiveEntity);
    setBulkPreview(null);
  };

  const handleTableQueryChange = (entity: AtdbTableEntity, query: AtdbTableQueryState) => {
    setTableQueries((currentQueries) => ({
      ...currentQueries,
      [entity]: query,
    }));
    setBulkPreview(null);
    setError(null);
    setSuccess(null);
  };

  const handleRowSelectionChange = (entityType: AtdbWritableEntity, id: number, selected: boolean) => {
    setSelectedRows((currentSelection) => ({
      ...currentSelection,
      [entityType]: selected
        ? mergeSelectedIds(currentSelection[entityType], [id])
        : currentSelection[entityType].filter((selectedId) => selectedId !== id),
    }));
    setBulkPreview(null);
  };

  const handleRenderedRowsSelectionChange = (
    entityType: AtdbWritableEntity,
    ids: readonly number[],
    selected: boolean,
  ) => {
    setSelectedRows((currentSelection) => ({
      ...currentSelection,
      [entityType]: selected
        ? mergeSelectedIds(currentSelection[entityType], ids)
        : currentSelection[entityType].filter((selectedId) => !ids.includes(selectedId)),
    }));
    setBulkPreview(null);
  };

  const handleClearSelection = (entityType: AtdbWritableEntity) => {
    setSelectedRows((currentSelection) => ({
      ...currentSelection,
      [entityType]: [],
    }));
    setBulkPreview(null);
  };

  const handleClearDraft = () => {
    if (!hasDraftChanges) {
      return;
    }

    if (!window.confirm('Сбросить все несохранённые изменения?')) {
      return;
    }

    setEditDraft(clearDraft());
    setBulkPreview(null);
    setError(null);
    setSuccess('Все изменения сброшены. Исходный файл не изменён.');
  };

  const handleOpenBulkEdit = () => {
    if (!activeWritableEntity) {
      return;
    }

    setBulkPreview(null);
    setIsBulkDialogOpen(true);
    setError(null);
    setSuccess(null);
  };

  const handleBulkPreview = (operation: AtdbBatchEditOperation) => {
    if (!parsedData) {
      return;
    }

    setBulkPreview(previewAtdbBatchEdit(parsedData, editDraft, operation));
    setError(null);
    setSuccess(null);
  };

  const handleBulkApply = (preview: AtdbBatchEditPreview) => {
    if (!parsedData) {
      return;
    }

    const result = applyAtdbBatchEdit(parsedData, editDraft, preview);
    if (result.stale) {
      setError('Предпросмотр устарел. Пересчитайте предпросмотр перед применением.');
      setSuccess(null);
      setBulkPreview(null);
      return;
    }

    setEditDraft(result.draft);
    setBulkPreview(null);
    setIsBulkDialogOpen(false);
    setError(null);
    setSuccess(
      `Массовое редактирование применено в черновик: ${result.applied} изменений, ${result.skipped} пропущено, ${result.noop} без изменений.`,
    );
  };

  const handleDownload = async () => {
    if (isDownloading) {
      return;
    }

    if (!parsedData) {
      setError('Нет данных для загрузки');
      return;
    }

    if (!hasDraftChanges) {
      setSuccess('Нет изменений для скачивания. Измените данные в таблице, затем скачайте обновленный файл.');
      return;
    }

    let changes = draftChangeCount.fields;
    setIsDownloading(true);
    setError(null);

    try {
      if (!originalBuffer) {
        throw new Error('Исходный буфер файла недоступен');
      }

      const { applyAtdbChanges } = await import('@/lib/sqlProcessor');
      const changeSet = buildAtdbChangeSet(parsedData, editDraft);
      changes = changeSet.changes.reduce((total, change) => total + change.fields.length, 0);
      const uint8Array = await applyAtdbChanges(originalBuffer, changeSet);
      
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
      setSuccess(
        `Обновленный .atdb подготовлен: применено ${changes} изменений в ${changeSet.changes.length} записях. Исходный файл не изменён.`,
      );
    } catch (err) {
      const { formatAtdbBuildError } = await import('@/lib/sqlProcessor');
      const safeError = formatAtdbBuildError(err);
      console.error('Ошибка при создании файла .atdb:', {
        code: safeError.code,
        issueCount: safeError.issueCount,
        changes,
      });
      setError(`Ошибка при создании файла .atdb: ${safeError.message}`);
    } finally {
      setIsDownloading(false);
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
              width={64}
              height={64}
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
              maxFileSize={100 * 1024 * 1024} // 100MB
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
            
            {parsedData && activeTableQueryResult && (
              <div className="mt-8 -mx-6 flex-1 flex flex-col min-h-0">
                <div className="sticky top-4 z-50 mb-4 flex flex-wrap items-center justify-center gap-3 px-6">
                  <span className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm">
                    {hasDraftChanges
                      ? `${draftChangeCount.fields} полей в ${draftChangeCount.entities} записях изменено`
                      : 'Изменений нет'}
                  </span>
                  <span className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm">
                    Выбрано: {activeSelectedIds.length}
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenBulkEdit}
                      disabled={!activeWritableEntity || isDownloading}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg"
                    >
                      <Wand2 className="h-4 w-4" aria-hidden="true" />
                      Массовое редактирование
                    </button>
                    <button
                      onClick={handleDownload}
                      disabled={!hasDraftChanges || isDownloading}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors shadow-lg"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      {isDownloading ? 'Подготовка файла...' : 'Скачать обновленный .atdb'}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearDraft}
                      disabled={!hasDraftChanges || isDownloading}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      Сбросить все изменения
                    </button>
                  </div>
                </div>
                {!hasDraftChanges && (
                  <p className="mb-4 px-6 text-center text-sm text-zinc-500">
                    Нет изменений для скачивания.
                  </p>
                )}
                <div className="flex-1 overflow-hidden min-h-0">
                  <ScrollableDataTable
                    activeEntity={activeEntity}
                    onActiveEntityChange={handleActiveEntityChange}
                    persons={parsedData.persons}
                    families={parsedData.families}
                    events={parsedData.events}
                    places={parsedData.places || []}
                    tableQuery={activeTableQuery}
                    tableQueryResult={activeTableQueryResult}
                    draft={editDraft}
                    sourceData={parsedData}
                    selectedRows={selectedRows}
                    onTableQueryChange={handleTableQueryChange}
                    onRowSelectionChange={handleRowSelectionChange}
                    onRenderedRowsSelectionChange={handleRenderedRowsSelectionChange}
                    onClearSelection={handleClearSelection}
                    onDraftFieldChange={handleDraftFieldChange}
                    onDraftFieldReset={handleDraftFieldReset}
                    onDraftEntityReset={handleDraftEntityReset}
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
      {parsedData && activeWritableEntity && (
        <BulkEditDialog
          isOpen={isBulkDialogOpen}
          activeEntity={activeWritableEntity}
          data={parsedData}
          draft={editDraft}
          selectedIds={activeSelectedIds}
          preview={bulkPreview}
          isDownloading={isDownloading}
          onPreview={handleBulkPreview}
          onApply={handleBulkApply}
          onClose={() => setIsBulkDialogOpen(false)}
        />
      )}
    </div>
  );
}
