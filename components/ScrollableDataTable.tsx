'use client';

import React, { useState, useRef, useEffect } from 'react';
import DataTable from './DataTable';
import type { ParsedAtdb } from '@/lib/types';
import type { AtdbDraftFieldKey, AtdbEditDraftState } from '@/lib/atdbEditDraft';

type ActiveEntity = 'persons' | 'families' | 'events' | 'places';

interface ScrollableDataTableProps {
  persons: ParsedAtdb['persons'];
  families: ParsedAtdb['families'];
  events: ParsedAtdb['events'];
  places: ParsedAtdb['places'];
  draft: AtdbEditDraftState;
  sourceData: ParsedAtdb;
  onDraftFieldChange: (key: AtdbDraftFieldKey, value: unknown) => void;
  onDraftFieldReset: (key: AtdbDraftFieldKey) => void;
  onDraftEntityReset: (entityType: AtdbDraftFieldKey['entityType'], id: number) => void;
}

const ScrollableDataTable: React.FC<ScrollableDataTableProps> = ({
  persons,
  families,
  events,
  places,
  draft,
  sourceData,
  onDraftFieldChange,
  onDraftFieldReset,
  onDraftEntityReset,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveEntity>('persons');
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Reset scroll position when tab changes
  useEffect(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = 0;
    }
  }, [activeTab]);

  return (
    <div className="w-full flex flex-col flex-1 min-h-0"> {/* Use flex-1 to fill available space */}
      {/* Tabs */}
      <div className="border-b border-gray-200 z-20">
        <nav className="flex space-x-4">
          <button
            className={`py-2 px-4 font-medium text-sm ${
              activeTab === 'persons'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('persons')}
          >
            Персоны ({persons.length})
          </button>
          <button
            className={`py-2 px-4 font-medium text-sm ${
              activeTab === 'families'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('families')}
          >
            Роды ({families.length})
          </button>
          <button
            className={`py-2 px-4 font-medium text-sm ${
              activeTab === 'events'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('events')}
          >
            События ({events.length})
          </button>
          <button
            className={`py-2 px-4 font-medium text-sm ${
              activeTab === 'places'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('places')}
          >
            Места ({places.length})
          </button>
        </nav>
      </div>

      <div className="flex-1 flex flex-col shadow-sm overflow-hidden">
        {activeTab === 'events' && (
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
            События доступны только для просмотра.
          </div>
        )}
        {/* Table content (scrollable), including header and body in one scrollable area */}
        <div
          ref={tableContainerRef}
          className="flex-1 overflow-auto relative"
          style={{ maxHeight: 'calc(100vh - 250px)' }} // Adjust based on header and other elements height
        >
          <DataTable
            activeEntity={activeTab}
            persons={persons}
            families={families}
            events={events}
            places={places}
            allPlaces={places}
            draft={draft}
            sourceData={sourceData}
            onDraftFieldChange={onDraftFieldChange}
            onDraftFieldReset={onDraftFieldReset}
            onDraftEntityReset={onDraftEntityReset}
            renderOnlyContent={false} // This will render both header and content
          />
        </div>
      </div>
    </div>
  );
};

export default ScrollableDataTable;
