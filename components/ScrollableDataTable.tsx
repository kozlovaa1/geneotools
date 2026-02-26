'use client';

import React, { useState, useRef, useEffect } from 'react';
import DataTable from './DataTable';
import { ParsedAtdb } from '@/lib/sqlProcessor';

// Polyfill for ResizeObserver if not available
const ResizeObserverPolyfill = typeof window !== 'undefined' ? (window as any).ResizeObserver || class {
  observe() {}
  unobserve() {}
  disconnect() {}
} : class {};

interface ScrollableDataTableProps {
  persons: ParsedAtdb['persons'];
  families: ParsedAtdb['families'];
  events: ParsedAtdb['events'];
  places: ParsedAtdb['places'];
}

const ScrollableDataTable: React.FC<ScrollableDataTableProps> = ({ persons, families, events, places }) => {
  const [activeTab, setActiveTab] = useState<'persons' | 'families' | 'events' | 'places'>('persons');
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const [tableWidth, setTableWidth] = useState<number | null>(null);

  // Sync bottom scroll with table scroll
  const handleTableScroll = () => {
    if (tableContainerRef.current && bottomScrollRef.current) {
      bottomScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
  };

  // Sync table scroll with bottom scroll
  const handleBottomScroll = () => {
    if (tableContainerRef.current && bottomScrollRef.current) {
      tableContainerRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
  };

  // Update bottom scroll when active tab changes
  useEffect(() => {
    if (bottomScrollRef.current && tableContainerRef.current) {
      // Reset scroll position when tab changes
      bottomScrollRef.current.scrollLeft = 0;
      tableContainerRef.current.scrollLeft = 0;

      // Update the table width for the bottom scrollbar
      const tableElement = tableContainerRef.current.querySelector('table');
      if (tableElement) {
        setTableWidth(tableElement.scrollWidth);
      }
    }
  }, [activeTab]);

  // Update table width when the component mounts and when content changes
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is rendered before measuring
    const updateTableWidth = () => {
      if (tableContainerRef.current) {
        // The table is directly inside the container
        const tableElement = tableContainerRef.current.querySelector('table');
        if (tableElement) {
          // Use the scrollWidth of the table for accurate measurement
          setTableWidth(tableElement.scrollWidth);
        } else {
          // Fallback to container scroll width if table isn't found yet
          setTableWidth(tableContainerRef.current.scrollWidth);
        }
      }
    };

    // Update width after component renders
    const animationFrame = requestAnimationFrame(() => {
      updateTableWidth();

      // Additional check after a short delay to handle any rendering delays
      setTimeout(updateTableWidth, 100);
    });

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [activeTab, persons, families, events, places]); // Re-run when active tab or data changes

  // Function to get the correct data based on active tab
  const getActiveData = () => {
    switch(activeTab) {
      case 'persons': return { data: persons, count: persons.length };
      case 'families': return { data: families, count: families.length };
      case 'events': return { data: events, count: events.length };
      case 'places': return { data: places, count: places.length };
      default: return { data: persons, count: persons.length };
    }
  };

  const { data, count } = getActiveData();

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
        {/* Table content (scrollable), including header and body in one scrollable area */}
        <div
          ref={tableContainerRef}
          onScroll={handleTableScroll}
          className="flex-1 overflow-auto relative"
          style={{ maxHeight: 'calc(100vh - 250px)' }} // Adjust based on header and other elements height
        >
          <DataTable
            persons={activeTab === 'persons' ? persons : []}
            families={activeTab === 'families' ? families : []}
            events={activeTab === 'events' ? events : []}
            places={activeTab === 'places' ? places : []}
            renderOnlyContent={false} // This will render both header and content
          />
        </div>
      </div>
    </div>
  );
};

export default ScrollableDataTable;