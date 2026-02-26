import React, { useState } from 'react';
import { getEventTypeName } from '../lib/utils';

interface Person {
  id: number;
  firstName?: string;
  lastName?: string;
  patronymic?: string;
  gender: 'M' | 'F' | 'Unknown';
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  deathPlace?: string;
  notes?: string;
  fatherId?: number;
  motherId?: number;
  spouseIds?: number[];
  occupation?: string; // Added to store main occupation
  motherLastName?: string; // Added to store mother's maiden name if needed
  [key: string]: any; // Index signature to allow dynamic property access
}

interface Family {
  id: number;
  familyName?: string;        // Название рода (f_id=50 from ValuesStr)
  husbandLastName?: string;   // Мужская фамилия (f_id=48 from ValuesStr)
  wifeLastName?: string;      // Женская фамилия (f_id=49 from ValuesStr)
  comment?: string;           // Комментарий (f_id=52 from ValuesStr)
  husbandId?: number;
  wifeId?: number;
  childrenIds: number[];
  marriedDate?: string;
  divorcedDate?: string;
  notes?: string;
  color?: number;
  [key: string]: any; // Index signature to allow dynamic property access
}

interface Event {
  id: number;
  personIds?: number[];
  eventType: string;
  date?: string;
  place?: string;
  description?: string;
  [key: string]: any; // Index signature to allow dynamic property access
}

interface Place {
  id: number;
  name?: string;
  shortName?: string;
  comment?: string;
  [key: string]: any; // Index signature to allow dynamic property access
}

interface SortConfig {
  key: string;
  direction: 'ascending' | 'descending';
}

interface DataTableProps {
  persons: Person[];
  families: Family[];
  events: Event[];
  places: Place[];
  renderOnlyHeader?: boolean;
  renderOnlyContent?: boolean;
}

const DataTable: React.FC<DataTableProps> = ({ persons, families, events, places, renderOnlyHeader = false, renderOnlyContent = false }) => {
  const [personSortConfig, setPersonSortConfig] = useState<SortConfig | null>(null);
  const [familySortConfig, setFamilySortConfig] = useState<SortConfig | null>(null);
  const [eventSortConfig, setEventSortConfig] = useState<SortConfig | null>(null);
  const [placeSortConfig, setPlaceSortConfig] = useState<SortConfig | null>(null);

  // Debug: log the first person and first family data to see what we're receiving
  if (typeof window !== 'undefined' && persons.length > 0 && sessionStorage.getItem('debug-data') !== 'false') {
    console.log('DataTable received persons data:', persons.slice(0, 3)); // Log first 3 persons
    console.log('DataTable received families data:', families.slice(0, 3)); // Log first 3 families
    console.log('DataTable received events data:', events.slice(0, 3));   // Log first 3 events
    console.log('DataTable received places data:', places.slice(0, 3));   // Log first 3 places
    sessionStorage.setItem('debug-data', 'false'); // Prevent logging on every render
  }

  const handlePersonSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (personSortConfig && personSortConfig.key === key && personSortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setPersonSortConfig({ key, direction });
  };

  const handleFamilySort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (familySortConfig && familySortConfig.key === key && familySortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setFamilySortConfig({ key, direction });
  };

  const handleEventSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (eventSortConfig && eventSortConfig.key === key && eventSortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setEventSortConfig({ key, direction });
  };

  const handlePlaceSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (placeSortConfig && placeSortConfig.key === key && placeSortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setPlaceSortConfig({ key, direction });
  };

  const sortedPersons = React.useMemo(() => {
    if (!personSortConfig) return persons;

    return [...persons].sort((a, b) => {
      let valA = a[personSortConfig.key];
      let valB = b[personSortConfig.key];

      if (valA === undefined && valB === undefined) return 0;
      if (valA === undefined) return personSortConfig.direction === 'ascending' ? 1 : -1;
      if (valB === undefined) return personSortConfig.direction === 'ascending' ? -1 : 1;

      // Handle arrays (like spouseIds)
      if (Array.isArray(valA) && Array.isArray(valB)) {
        valA = (valA as number[]).join(',');
        valB = (valB as number[]).join(',');
      }

      // Compare as strings for consistent sorting
      const strA = String(valA);
      const strB = String(valB);

      if (personSortConfig.direction === 'ascending') {
        return strA.localeCompare(strB, undefined, { numeric: true });
      } else {
        return strB.localeCompare(strA, undefined, { numeric: true });
      }
    });
  }, [persons, personSortConfig]);

  const sortedFamilies = React.useMemo(() => {
    if (!familySortConfig) return families;

    return [...families].sort((a, b) => {
      let valA = a[familySortConfig.key];
      let valB = b[familySortConfig.key];

      if (valA === undefined && valB === undefined) return 0;
      if (valA === undefined) return familySortConfig.direction === 'ascending' ? 1 : -1;
      if (valB === undefined) return familySortConfig.direction === 'ascending' ? -1 : 1;

      // Handle arrays (like childrenIds)
      if (Array.isArray(valA) && Array.isArray(valB)) {
        valA = (valA as number[]).join(',');
        valB = (valB as number[]).join(',');
      }

      // Compare as strings for consistent sorting
      const strA = String(valA);
      const strB = String(valB);

      if (familySortConfig.direction === 'ascending') {
        return strA.localeCompare(strB, undefined, { numeric: true });
      } else {
        return strB.localeCompare(strA, undefined, { numeric: true });
      }
    });
  }, [families, familySortConfig]);

  const sortedEvents = React.useMemo(() => {
    if (!eventSortConfig) return events;

    return [...events].sort((a, b) => {
      // Get values, handling 'personId' specially as the first element of personIds
      let valA, valB;
      if (eventSortConfig.key === 'personId') {
        valA = a.personIds && a.personIds.length > 0 ? a.personIds[0] : undefined;
        valB = b.personIds && b.personIds.length > 0 ? b.personIds[0] : undefined;
      } else {
        valA = a[eventSortConfig.key];
        valB = b[eventSortConfig.key];
      }

      if (valA === undefined && valB === undefined) return 0;
      if (valA === undefined) return eventSortConfig.direction === 'ascending' ? 1 : -1;
      if (valB === undefined) return eventSortConfig.direction === 'ascending' ? -1 : 1;

      // Compare as strings for consistent sorting
      const strA = String(valA);
      const strB = String(valB);

      if (eventSortConfig.direction === 'ascending') {
        return strA.localeCompare(strB, undefined, { numeric: true });
      } else {
        return strB.localeCompare(strA, undefined, { numeric: true });
      }
    });
  }, [events, eventSortConfig]);

  const sortedPlaces = React.useMemo(() => {
    if (!placeSortConfig) return places;

    return [...places].sort((a, b) => {
      let valA = a[placeSortConfig.key];
      let valB = b[placeSortConfig.key];

      if (valA === undefined && valB === undefined) return 0;
      if (valA === undefined) return placeSortConfig.direction === 'ascending' ? 1 : -1;
      if (valB === undefined) return placeSortConfig.direction === 'ascending' ? -1 : 1;

      // Compare as strings for consistent sorting
      const strA = String(valA);
      const strB = String(valB);

      if (placeSortConfig.direction === 'ascending') {
        return strA.localeCompare(strB, undefined, { numeric: true });
      } else {
        return strB.localeCompare(strA, undefined, { numeric: true });
      }
    });
  }, [places, placeSortConfig]);

  const getSortIndicator = (key: string, sortConfig: SortConfig | null) => {
    if (!sortConfig || sortConfig.key !== key) return '';
    return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
  };

  const renderPersonsTable = (showContent: boolean) => {
    if (showContent && sortedPersons.length === 0) {
      return <p className="text-gray-500">Нет доступных данных о персонах</p>;
    }

    return (
      <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
        <thead className="sticky top-0 z-20 bg-gray-100">
          <tr className="bg-gray-100">
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200 left-0 bg-gray-100 z-30"
              onClick={() => handlePersonSort('id')}
            >
              ID{getSortIndicator('id', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('lastName')}
            >
              Фамилия{getSortIndicator('lastName', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('firstName')}
            >
              Имя{getSortIndicator('firstName', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('patronymic')}
            >
              Отчество{getSortIndicator('patronymic', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('gender')}
            >
              Пол{getSortIndicator('gender', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('birthDate')}
            >
              Дата рождения{getSortIndicator('birthDate', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('deathDate')}
            >
              Дата смерти{getSortIndicator('deathDate', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('birthPlace')}
            >
              Место рождения{getSortIndicator('birthPlace', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('deathPlace')}
            >
              Место смерти{getSortIndicator('deathPlace', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('fatherId')}
            >
              ID отца{getSortIndicator('fatherId', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('motherId')}
            >
              ID матери{getSortIndicator('motherId', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('notes')}
            >
              Примечания{getSortIndicator('notes', personSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePersonSort('occupation')}
            >
              Основное занятие{getSortIndicator('occupation', personSortConfig)}
            </th>
          </tr>
        </thead>
        {showContent && (
          <tbody>
            {sortedPersons.map((person) => (
              <tr key={person.id} className="hover:bg-gray-50">
                <td className="py-2 px-4 border-b left-0 bg-white z-10">{person.id}</td>
                <td className="py-2 px-4 border-b">{person.lastName || '-'}</td>
                <td className="py-2 px-4 border-b">{person.firstName || '-'}</td>
                <td className="py-2 px-4 border-b">{person.patronymic || '-'}</td>
                <td className="py-2 px-4 border-b">{person.gender}</td>
                <td className="py-2 px-4 border-b">{person.birthDate || '-'}</td>
                <td className="py-2 px-4 border-b">{person.deathDate || '-'}</td>
                <td className="py-2 px-4 border-b">{person.birthPlace || '-'}</td>
                <td className="py-2 px-4 border-b">{person.deathPlace || '-'}</td>
                <td className="py-2 px-4 border-b">{person.fatherId || '-'}</td>
                <td className="py-2 px-4 border-b">{person.motherId || '-'}</td>
                <td className="py-2 px-4 border-b">{person.notes || '-'}</td>
                <td className="py-2 px-4 border-b">{person.occupation || '-'}</td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
    );
  };

  const renderFamiliesTable = (showContent: boolean) => {
    if (showContent && sortedFamilies.length === 0) {
      return <p className="text-gray-500">Нет доступных данных о родах</p>;
    }

    // Only show header when renderOnlyHeader is true
    if (renderOnlyHeader) {
      return (
        <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
          <thead className="sticky top-0 z-20 bg-gray-100">
            <tr className="bg-gray-100">
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200 sticky left-0 bg-gray-100 z-30"
                onClick={() => handleFamilySort('id')}
              >
                ID{getSortIndicator('id', familySortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleFamilySort('familyName')}
              >
                Название рода{getSortIndicator('familyName', familySortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleFamilySort('husbandLastName')}
              >
                Мужская фамилия{getSortIndicator('husbandLastName', familySortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleFamilySort('wifeLastName')}
              >
                Женская фамилия{getSortIndicator('wifeLastName', familySortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleFamilySort('comment')}
              >
                Комментарий{getSortIndicator('comment', familySortConfig)}
              </th>
            </tr>
          </thead>
        </table>
      );
    }

    // Only show content when renderOnlyContent is true
    if (renderOnlyContent) {
      return (
        <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
          <tbody>
            {sortedFamilies.map((family) => (
              <tr key={family.id} className="hover:bg-gray-50">
                <td className="py-2 px-4 border-b sticky left-0 bg-white z-10">{family.id}</td>
                <td className="py-2 px-4 border-b">{family.familyName || '-'}</td>
                <td className="py-2 px-4 border-b">{family.husbandLastName || '-'}</td>
                <td className="py-2 px-4 border-b">{family.wifeLastName || '-'}</td>
                <td className="py-2 px-4 border-b">{family.comment || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    // Default behavior (for backward compatibility)
    return (
      <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
        <thead className="sticky top-0 z-20 bg-gray-100">
          <tr className="bg-gray-100">
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200 sticky left-0 bg-gray-100 z-30"
              onClick={() => handleFamilySort('id')}
            >
              ID{getSortIndicator('id', familySortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handleFamilySort('familyName')}
            >
              Название рода{getSortIndicator('familyName', familySortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handleFamilySort('husbandLastName')}
            >
              Мужская фамилия{getSortIndicator('husbandLastName', familySortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handleFamilySort('wifeLastName')}
            >
              Женская фамилия{getSortIndicator('wifeLastName', familySortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handleFamilySort('comment')}
            >
              Комментарий{getSortIndicator('comment', familySortConfig)}
            </th>
          </tr>
        </thead>
        {showContent && (
          <tbody>
            {sortedFamilies.map((family) => (
              <tr key={family.id} className="hover:bg-gray-50">
                <td className="py-2 px-4 border-b sticky left-0 bg-white z-10">{family.id}</td>
                <td className="py-2 px-4 border-b">{family.familyName || '-'}</td>
                <td className="py-2 px-4 border-b">{family.husbandLastName || '-'}</td>
                <td className="py-2 px-4 border-b">{family.wifeLastName || '-'}</td>
                <td className="py-2 px-4 border-b">{family.comment || '-'}</td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
    );
  };

  const renderEventsTable = (showContent: boolean) => {
    if (showContent && sortedEvents.length === 0) {
      return <p className="text-gray-500">Нет доступных данных о событиях</p>;
    }

    // Only show header when renderOnlyHeader is true
    if (renderOnlyHeader) {
      return (
        <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
          <thead className="sticky top-0 z-20 bg-gray-100">
            <tr className="bg-gray-100">
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200 sticky left-0 bg-gray-100 z-30"
                onClick={() => handleEventSort('id')}
              >
                ID{getSortIndicator('id', eventSortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleEventSort('personId')}
              >
                ID персоны{getSortIndicator('personId', eventSortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleEventSort('eventType')}
              >
                Тип события{getSortIndicator('eventType', eventSortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleEventSort('date')}
              >
                Дата{getSortIndicator('date', eventSortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleEventSort('place')}
              >
                Место{getSortIndicator('place', eventSortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handleEventSort('description')}
              >
                Описание{getSortIndicator('description', eventSortConfig)}
              </th>
            </tr>
          </thead>
        </table>
      );
    }

    // Only show content when renderOnlyContent is true
    if (renderOnlyContent) {
      return (
        <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
          <tbody>
            {sortedEvents.map((event) => (
              <tr key={event.id} className="hover:bg-gray-50">
                <td className="py-2 px-4 border-b sticky left-0 bg-white z-10">{event.id}</td>
                <td className="py-2 px-4 border-b">{event.personIds ? event.personIds.join(', ') : '-'}</td>
                <td className="py-2 px-4 border-b">{getEventTypeName(event.eventType)}</td>
                <td className="py-2 px-4 border-b">{event.date || '-'}</td>
                <td className="py-2 px-4 border-b">{event.place || '-'}</td>
                <td className="py-2 px-4 border-b">{event.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    // Default behavior (for backward compatibility)
    return (
      <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
        <thead className="sticky top-0 z-20 bg-gray-100">
          <tr className="bg-gray-100">
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200 sticky left-0 bg-gray-100 z-30"
              onClick={() => handleEventSort('id')}
            >
              ID{getSortIndicator('id', eventSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handleEventSort('personId')}
            >
              ID персоны{getSortIndicator('personId', eventSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handleEventSort('eventType')}
            >
              Тип события{getSortIndicator('eventType', eventSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handleEventSort('date')}
            >
              Дата{getSortIndicator('date', eventSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handleEventSort('place')}
            >
              Место{getSortIndicator('place', eventSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handleEventSort('description')}
            >
              Описание{getSortIndicator('description', eventSortConfig)}
            </th>
          </tr>
        </thead>
        {showContent && (
          <tbody>
            {sortedEvents.map((event) => (
              <tr key={event.id} className="hover:bg-gray-50">
                <td className="py-2 px-4 border-b sticky left-0 bg-white z-10">{event.id}</td>
                <td className="py-2 px-4 border-b">{event.personIds ? event.personIds.join(', ') : '-'}</td>
                <td className="py-2 px-4 border-b">{getEventTypeName(event.eventType)}</td>
                <td className="py-2 px-4 border-b">{event.date || '-'}</td>
                <td className="py-2 px-4 border-b">{event.place || '-'}</td>
                <td className="py-2 px-4 border-b">{event.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
    );
  };

  const renderPlacesTable = (showContent: boolean) => {
    if (showContent && sortedPlaces.length === 0) {
      return <p className="text-gray-500">Нет доступных данных о местах</p>;
    }

    // Only show header when renderOnlyHeader is true
    if (renderOnlyHeader) {
      return (
        <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
          <thead className="sticky top-0 z-20 bg-gray-100">
            <tr className="bg-gray-100">
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200 sticky left-0 bg-gray-100 z-30"
                onClick={() => handlePlaceSort('id')}
              >
                ID{getSortIndicator('id', placeSortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handlePlaceSort('name')}
              >
                Название{getSortIndicator('name', placeSortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handlePlaceSort('shortName')}
              >
                Краткое название{getSortIndicator('shortName', placeSortConfig)}
              </th>
              <th
                className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
                onClick={() => handlePlaceSort('comment')}
              >
                Комментарий{getSortIndicator('comment', placeSortConfig)}
              </th>
            </tr>
          </thead>
        </table>
      );
    }

    // Only show content when renderOnlyContent is true
    if (renderOnlyContent) {
      return (
        <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
          <tbody>
            {sortedPlaces.map((place) => (
              <tr key={place.id} className="hover:bg-gray-50">
                <td className="py-2 px-4 border-b sticky left-0 bg-white z-10">{place.id}</td>
                <td className="py-2 px-4 border-b">{place.name || '-'}</td>
                <td className="py-2 px-4 border-b">{place.shortName || '-'}</td>
                <td className="py-2 px-4 border-b">{place.comment || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    // Default behavior (for backward compatibility)
    return (
      <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
        <thead className="sticky top-0 z-20 bg-gray-100">
          <tr className="bg-gray-100">
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200 sticky left-0 bg-gray-100 z-30"
              onClick={() => handlePlaceSort('id')}
            >
              ID{getSortIndicator('id', placeSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePlaceSort('name')}
            >
              Название{getSortIndicator('name', placeSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePlaceSort('shortName')}
            >
              Краткое название{getSortIndicator('shortName', placeSortConfig)}
            </th>
            <th
              className="py-2 px-4 border-b text-left cursor-pointer hover:bg-gray-200"
              onClick={() => handlePlaceSort('comment')}
            >
              Комментарий{getSortIndicator('comment', placeSortConfig)}
            </th>
          </tr>
        </thead>
        {showContent && (
          <tbody>
            {sortedPlaces.map((place) => (
              <tr key={place.id} className="hover:bg-gray-50">
                <td className="py-2 px-4 border-b sticky left-0 bg-white z-10">{place.id}</td>
                <td className="py-2 px-4 border-b">{place.name || '-'}</td>
                <td className="py-2 px-4 border-b">{place.shortName || '-'}</td>
                <td className="py-2 px-4 border-b">{place.comment || '-'}</td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
    );
  };

  // Determine which table to render based on the non-empty data
  if (persons.length > 0) {
    return renderPersonsTable(true);
  } else if (families.length > 0) {
    return renderFamiliesTable(true);
  } else if (events.length > 0) {
    return renderEventsTable(true);
  } else if (places.length > 0) {
    return renderPlacesTable(true);
  } else {
    return (
      <div className="w-full">
        <p className="text-gray-500">Нет доступных данных</p>
      </div>
    );
  }
};

export default DataTable;