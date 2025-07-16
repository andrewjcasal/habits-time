import { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';

const Calendar = () => {
  const [today] = useState(new Date());

  const getDayColumns = () => {
    return [
      { date: today, label: 'Today' },
      { date: addDays(today, 1), label: 'Tomorrow' },
      { date: addDays(today, 2), label: format(addDays(today, 2), 'EEE, MMM d') }
    ];
  };

  const dayColumns = getDayColumns();

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="h-16 border-b border-neutral-200 bg-white flex items-center px-6 flex-shrink-0">
        <h1 className="text-xl font-semibold text-neutral-900">Calendar</h1>
      </div>

      {/* Calendar Content */}
      <div className="flex-1 p-6">
        <div className="grid grid-cols-3 gap-6 h-full">
          {dayColumns.map((column, index) => (
            <div key={index} className="bg-neutral-50 rounded-lg border border-neutral-200">
              {/* Day Header */}
              <div className="p-4 border-b border-neutral-200 bg-white rounded-t-lg">
                <h2 className="text-lg font-medium text-neutral-900">
                  {column.label}
                </h2>
                <p className="text-sm text-neutral-600">
                  {format(column.date, 'EEEE, MMMM d, yyyy')}
                </p>
              </div>

              {/* Day Content */}
              <div className="p-4 space-y-3">
                {/* Placeholder for sessions/tasks */}
                <div className="text-center py-8 text-neutral-500">
                  <div className="text-4xl mb-2">📅</div>
                  <p className="text-sm">No events scheduled</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Calendar;