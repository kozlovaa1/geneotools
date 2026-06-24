'use client';

import React, { useDeferredValue, useMemo, useState, useTransition } from 'react';
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
import { cn } from '@/lib/utils';
import {
  primaryButtonClassName,
  secondaryButtonClassName,
  statusBadgeClassName,
  statusSurfaceClassName,
} from '@/components/uiStyles';

type ActiveEntity = AtdbTableEntity;
type ImportPhase = 'idle' | 'reading' | 'parsing' | 'ready' | 'error';
type ExportPhase = 'idle' | 'preparing' | 'ready' | 'error';
type BulkPreviewPhase = 'idle' | 'previewing' | 'ready' | 'error';
type BulkApplyPhase = 'idle' | 'applying' | 'ready' | 'error';
type SelectionState = Record<AtdbWritableEntity, number[]>;
type TableQueryStateByEntity = Record<AtdbTableEntity, AtdbTableQueryState>;

const EMPTY_SELECTED_IDS: readonly number[] = [];

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

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
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle');
  const [exportPhase, setExportPhase] = useState<ExportPhase>('idle');
  const [bulkPreviewPhase, setBulkPreviewPhase] = useState<BulkPreviewPhase>('idle');
  const [bulkApplyPhase, setBulkApplyPhase] = useState<BulkApplyPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isTablePending, startTableTransition] = useTransition();
  const draftChangeCount = useMemo(
    () => (parsedData ? countDraftChanges(parsedData, editDraft) : { entities: 0, fields: 0 }),
    [editDraft, parsedData],
  );
  const activeWritableEntity = getWritableEntityForAtdbTableEntity(activeEntity);
  const activeSelectedIds = activeWritableEntity ? selectedRows[activeWritableEntity] : EMPTY_SELECTED_IDS;
  const activeSelectedIdSet = useMemo(() => new Set(activeSelectedIds), [activeSelectedIds]);
  const hasDraftChanges = draftChangeCount.fields > 0;
  const isImportBusy = importPhase === 'reading' || importPhase === 'parsing';
  const isDownloading = exportPhase === 'preparing';
  const isBulkPreviewPending = bulkPreviewPhase === 'previewing';
  const isBulkApplyPending = bulkApplyPhase === 'applying';
  const importStatusText =
    importPhase === 'reading'
      ? 'Чтение файла .atdb...'
        : importPhase === 'parsing'
          ? 'Разбор структуры .atdb...'
          : null;
  const exportStatusText = exportPhase === 'preparing' ? 'Подготовка обновлённого .atdb...' : null;
  const activeTableQuery = tableQueries[activeEntity];
  const deferredTableQueries = useDeferredValue(tableQueries);
  const renderedTableQuery = deferredTableQueries[activeEntity];
  const isTableRefreshing = isTablePending || deferredTableQueries !== tableQueries;
  const activeTableQueryResult = useMemo<AtdbTableQueryResult | null>(() => {
    if (!parsedData) return null;

    return queryAtdbTableRows(parsedData, editDraft, createAtdbTableQuery(activeEntity, renderedTableQuery));
  }, [activeEntity, editDraft, parsedData, renderedTableQuery]);

  const handleFileReadStart = () => {
    setImportPhase('reading');
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
    setExportPhase('idle');
    setBulkPreviewPhase('idle');
    setBulkApplyPhase('idle');
  };

  const handleFileReadError = () => {
    setImportPhase('error');
    setError('Ошибка чтения файла .atdb');
    setSuccess(null);
  };

  const handleFileUpload = async (file: File, buffer: ArrayBuffer) => {
    setImportPhase('parsing');
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
      setImportPhase('ready');
      setSuccess(`Файл .atdb успешно загружен: ${parsedResult.persons.length} персон, ${parsedResult.families.length} родов, ${parsedResult.events.length} событий, ${parsedResult.places.length} мест.`);
    } catch (err) {
      const { formatAtdbBuildError } = await import('@/lib/sqlProcessor');
      const safeError = formatAtdbBuildError(err);
      console.error('Ошибка при разборе файла .atdb:', { code: safeError.code, issueCount: safeError.issueCount });
      setImportPhase('error');
      setError(`Ошибка при разборе файла .atdb: ${safeError.message}`);
    }
  };

  const handleDraftFieldChange = (key: AtdbDraftFieldKey, value: unknown) => {
    if (!parsedData) {
      return;
    }

    setEditDraft((currentDraft) => setDraftField(currentDraft, parsedData, key, value));
    setBulkPreview(null);
    setBulkPreviewPhase('idle');
    setBulkApplyPhase('idle');
    setError(null);
    setSuccess(null);
  };

  const handleDraftFieldReset = (key: AtdbDraftFieldKey) => {
    setEditDraft((currentDraft) => resetDraftField(currentDraft, key));
    setBulkPreview(null);
    setBulkPreviewPhase('idle');
    setBulkApplyPhase('idle');
    setError(null);
    setSuccess(null);
  };

  const handleActiveEntityChange = (nextActiveEntity: ActiveEntity) => {
    startTableTransition(() => {
      setActiveEntity(nextActiveEntity);
      setBulkPreview(null);
      setBulkPreviewPhase('idle');
      setBulkApplyPhase('idle');
    });
  };

  const handleTableQueryChange = (entity: AtdbTableEntity, query: AtdbTableQueryState) => {
    setTableQueries((currentQueries) => ({
      ...currentQueries,
      [entity]: query,
    }));
    setBulkPreview(null);
    setBulkPreviewPhase('idle');
    setBulkApplyPhase('idle');
    setError(null);
    setSuccess(null);
  };

  const handleRowSelectionChange = (entityType: AtdbWritableEntity, id: number, selected: boolean) => {
    if (isTableRefreshing) {
      return;
    }

    setSelectedRows((currentSelection) => ({
      ...currentSelection,
      [entityType]: selected
        ? mergeSelectedIds(currentSelection[entityType], [id])
        : currentSelection[entityType].filter((selectedId) => selectedId !== id),
    }));
    setBulkPreview(null);
    setBulkPreviewPhase('idle');
  };

  const handleRenderedRowsSelectionChange = (
    entityType: AtdbWritableEntity,
    ids: readonly number[],
    selected: boolean,
  ) => {
    if (isTableRefreshing) {
      return;
    }

    const renderedIdSet = new Set(ids);

    setSelectedRows((currentSelection) => ({
      ...currentSelection,
      [entityType]: selected
        ? mergeSelectedIds(currentSelection[entityType], ids)
        : currentSelection[entityType].filter((selectedId) => !renderedIdSet.has(selectedId)),
    }));
    setBulkPreview(null);
    setBulkPreviewPhase('idle');
  };

  const handleClearSelection = (entityType: AtdbWritableEntity) => {
    setSelectedRows((currentSelection) => ({
      ...currentSelection,
      [entityType]: [],
    }));
    setBulkPreview(null);
    setBulkPreviewPhase('idle');
    setBulkApplyPhase('idle');
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
    setBulkPreviewPhase('idle');
    setBulkApplyPhase('idle');
    setExportPhase('idle');
    setError(null);
    setSuccess('Все изменения сброшены. Исходный файл не изменён.');
  };

  const handleOpenBulkEdit = () => {
    if (!activeWritableEntity || isTableRefreshing) {
      return;
    }

    setBulkPreview(null);
    setBulkPreviewPhase('idle');
    setBulkApplyPhase('idle');
    setIsBulkDialogOpen(true);
    setError(null);
    setSuccess(null);
  };

  const handleBulkPreview = async (operation: AtdbBatchEditOperation) => {
    if (!parsedData || isBulkPreviewPending || isBulkApplyPending) {
      return;
    }

    setBulkPreviewPhase('previewing');
    await waitForNextFrame();

    try {
      setBulkPreview(previewAtdbBatchEdit(parsedData, editDraft, operation));
      setBulkPreviewPhase('ready');
    } catch {
      setBulkPreview(null);
      setBulkPreviewPhase('error');
      setError('Не удалось подготовить предпросмотр массового редактирования.');
      return;
    }

    setError(null);
    setSuccess(null);
  };

  const handleBulkApply = async (preview: AtdbBatchEditPreview) => {
    if (!parsedData || isBulkApplyPending || isBulkPreviewPending) {
      return;
    }

    setBulkApplyPhase('applying');
    await waitForNextFrame();

    const result = applyAtdbBatchEdit(parsedData, editDraft, preview);
    if (result.stale) {
      setBulkApplyPhase('error');
      setError('Предпросмотр устарел. Пересчитайте предпросмотр перед применением.');
      setSuccess(null);
      setBulkPreview(null);
      return;
    }

    setEditDraft(result.draft);
    setBulkPreview(null);
    setBulkPreviewPhase('idle');
    setBulkApplyPhase('ready');
    setExportPhase('idle');
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
    setExportPhase('preparing');
    setError(null);
    setSuccess(null);

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
      setExportPhase('ready');
    } catch (err) {
      const { formatAtdbBuildError } = await import('@/lib/sqlProcessor');
      const safeError = formatAtdbBuildError(err);
      console.error('Ошибка при создании файла .atdb:', {
        code: safeError.code,
        issueCount: safeError.issueCount,
        changes,
      });
      setError(`Ошибка при создании файла .atdb: ${safeError.message}`);
      setExportPhase('error');
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
              onFileReadStart={handleFileReadStart}
              onFileReadError={handleFileReadError}
              acceptedFileTypes={['.atdb']} 
              maxFileSize={100 * 1024 * 1024} // 100MB
              disabled={isImportBusy}
              busyLabel={importStatusText ?? 'Файл обрабатывается...'}
            />
            
            {importStatusText && (
              <div
                className={cn(statusSurfaceClassName, 'mt-4 flex flex-col items-center text-center')}
                role="status"
                aria-live="polite"
              >
                <div className="gt-spinner mb-4 animate-spin">
                  <Image
                    className="dark:invert"
                    src="/logo.svg"
                    alt="logo"
                    width={40}
                    height={40}
                    priority
                  />
                </div>
                <p className="text-zinc-600 dark:text-zinc-400">{importStatusText}</p>
              </div>
            )}

            {exportStatusText && (
              <div
                className={cn(statusSurfaceClassName, 'mt-4 rounded-md bg-blue-50 p-3 text-blue-700')}
                role="status"
                aria-live="polite"
              >
                {exportStatusText}
              </div>
            )}
            
            {error && (
              <div
                className={cn(statusSurfaceClassName, 'mt-4 rounded-md bg-red-50 p-3 text-red-700')}
                role="alert"
                aria-live="assertive"
              >
                {error}
              </div>
            )}
            
            {success && (
              <div
                className={cn(statusSurfaceClassName, 'mt-4 rounded-md bg-green-50 p-3 text-green-700')}
                role="status"
                aria-live="polite"
              >
                {success}
              </div>
            )}
            
            {parsedData && activeTableQueryResult && (
              <div className="mt-8 -mx-6 flex-1 flex flex-col min-h-0">
                <div className="sticky top-4 z-50 mb-4 flex flex-wrap items-center justify-center gap-3 px-6">
                  <span className={cn(statusBadgeClassName, 'bg-white shadow-sm')}>
                    {hasDraftChanges
                      ? `${draftChangeCount.fields} полей в ${draftChangeCount.entities} записях изменено`
                      : 'Изменений нет'}
                  </span>
                  <span className={cn(statusBadgeClassName, 'bg-white shadow-sm')}>
                    Выбрано: {activeSelectedIds.length}
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenBulkEdit}
                      disabled={!activeWritableEntity || isDownloading || isTableRefreshing}
                      className={cn(secondaryButtonClassName, 'px-4 py-2 shadow-lg')}
                    >
                      <Wand2 className="h-4 w-4" aria-hidden="true" />
                      Массовое редактирование
                    </button>
                    <button
                      onClick={handleDownload}
                      disabled={!hasDraftChanges || isDownloading}
                      className={cn(primaryButtonClassName, 'px-4 py-2 shadow-lg')}
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      {isDownloading ? 'Подготовка файла...' : 'Скачать обновленный .atdb'}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearDraft}
                      disabled={!hasDraftChanges || isDownloading}
                      className={cn(secondaryButtonClassName, 'px-4 py-2 shadow-lg')}
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
                    isTableRefreshing={isTableRefreshing}
                    renderedTableQuery={renderedTableQuery}
                    draft={editDraft}
                    sourceData={parsedData}
                    selectedRows={selectedRows}
                    selectedIdSet={activeSelectedIdSet}
                    onTableQueryChange={handleTableQueryChange}
                    onRowSelectionChange={handleRowSelectionChange}
                    onRenderedRowsSelectionChange={handleRenderedRowsSelectionChange}
                    onClearSelection={handleClearSelection}
                    onDraftFieldChange={handleDraftFieldChange}
                    onDraftFieldReset={handleDraftFieldReset}
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
          isExportPending={isDownloading}
          isPreviewPending={isBulkPreviewPending}
          isApplyPending={isBulkApplyPending}
          onPreview={handleBulkPreview}
          onApply={handleBulkApply}
          onClose={() => setIsBulkDialogOpen(false)}
        />
      )}
    </div>
  );
}
