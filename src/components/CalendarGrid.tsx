import React from 'react'

// Helper function to get quarter-hour from mouse position within a time slot
export const getQuarterFromMousePosition = (event: React.MouseEvent, element: HTMLElement) => {
  const rect = element.getBoundingClientRect()
  const y = event.clientY - rect.top
  const quarterHeight = rect.height / 4
  return Math.floor(y / quarterHeight)
}

// Helper function to convert hour index and quarter to time string
export const quarterToTimeString = (hourIndex: number, quarter: number, hourSlots: Array<{ time: string; display: string }>) => {
  const hour = hourSlots[hourIndex]
  if (!hour) return '09:00'

  const [hourStr] = hour.time.split(':')
  const hourNum = parseInt(hourStr, 10)
  const minutes = quarter * 15

  return `${hourNum.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

// Helper function to check if a time slot is within the drag selection
const isInDragSelectionHelper = (
  hourIndex: number, 
  columnIndex: number, 
  isDragging: boolean,
  dragStart: { hourIndex: number; columnIndex: number; quarter: number } | null,
  dragEnd: { hourIndex: number; columnIndex: number; quarter: number } | null,
  quarter?: number
) => {
  if (!isDragging || !dragStart || !dragEnd || columnIndex !== dragStart.columnIndex) {
    return false
  }

  const startTotalQuarters = dragStart.hourIndex * 4 + dragStart.quarter
  const endTotalQuarters = dragEnd.hourIndex * 4 + dragEnd.quarter

  const minQuarters = Math.min(startTotalQuarters, endTotalQuarters)
  const maxQuarters = Math.max(startTotalQuarters, endTotalQuarters)

  if (quarter !== undefined) {
    // Check specific quarter
    const currentQuarters = hourIndex * 4 + quarter
    return currentQuarters >= minQuarters && currentQuarters <= maxQuarters
  } else {
    // Check if any part of the hour overlaps with selection
    const hourStartQuarters = hourIndex * 4
    const hourEndQuarters = hourIndex * 4 + 3

    return !(hourEndQuarters < minQuarters || hourStartQuarters > maxQuarters)
  }
}

interface CalendarGridProps {
  containerRef: React.RefObject<HTMLDivElement>
  hourSlots: Array<{ time: string; display: string }>
  gridCols: string
  dayColumns: Array<{ date: Date; dateStr: string }>
  renderCalendarEvents: (timeSlot: string, date: Date) => React.ReactNode
  handleTimeSlotClick: (e: React.MouseEvent, time: string, date: Date) => void
  handleTimeSlotContextMenu: (e: React.MouseEvent, time: string, date: Date) => void
  handleMouseDown: (e: React.MouseEvent, time: string, date: Date, hourIndex: number, columnIndex: number) => void
  handleMouseEnter: (e: React.MouseEvent, time: string, date: Date, hourIndex: number, columnIndex: number) => void
  handleMouseMove: (e: React.MouseEvent, time: string, date: Date, hourIndex: number, columnIndex: number) => void
  handleMouseUp: (e: React.MouseEvent, time: string, date: Date, hourIndex: number, columnIndex: number) => void
  isDragging: boolean
  dragStart: { hourIndex: number; columnIndex: number; quarter: number } | null
  dragEnd: { hourIndex: number; columnIndex: number; quarter: number } | null
  isInDragSelection: (hourIndex: number, columnIndex: number) => boolean
  getCurrentTimeLinePosition: (date: Date) => number | null
}

export default function CalendarGrid({
  containerRef,
  hourSlots,
  gridCols,
  dayColumns,
  renderCalendarEvents,
  handleTimeSlotClick,
  handleTimeSlotContextMenu,
  handleMouseDown,
  handleMouseEnter,
  handleMouseMove,
  handleMouseUp,
  isDragging,
  dragStart,
  dragEnd,
  isInDragSelection,
  getCurrentTimeLinePosition,
}: CalendarGridProps) {
  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto relative"
    >
      {hourSlots.map((hour, hourIndex) => {
        return (
          <div
            key={hourIndex}
            className="grid border-b border-neutral-300"
            style={{
              gridTemplateColumns: gridCols,
              height: 64,
            }}
          >
            <div className="border-r border-neutral-300 py-0 px-1 h-16 bg-neutral-50 flex items-start">
              <div className="font-mono text-neutral-600 text-xs">{hour.display}</div>
            </div>
            {dayColumns.map((column, columnIndex) => {
              const isInSelection = isInDragSelectionHelper(hourIndex, columnIndex, isDragging, dragStart, dragEnd)

              return (
                <div
                  key={columnIndex}
                  className={`border-r border-neutral-300 last:border-r-0 p-1 sm:p-0.5 h-16 text-sm sm:text-xs relative cursor-pointer select-none`}
                  onClick={e =>
                    !isDragging && handleTimeSlotClick(e, hour.time, column.date)
                  }
                  onContextMenu={e =>
                    handleTimeSlotContextMenu(e, hour.time, column.date)
                  }
                  onMouseDown={e =>
                    handleMouseDown(e, hour.time, column.date, hourIndex, columnIndex)
                  }
                  onMouseEnter={e =>
                    handleMouseEnter(e, hour.time, column.date, hourIndex, columnIndex)
                  }
                  onMouseMove={e =>
                    handleMouseMove(e, hour.time, column.date, hourIndex, columnIndex)
                  }
                  onMouseUp={e =>
                    handleMouseUp(e, hour.time, column.date, hourIndex, columnIndex)
                  }
                  style={{
                    userSelect: 'none',
                  }}
                >
                  {/* Quarter-hour visual divisions with hover states */}
                  <div className="absolute inset-0">
                    {/* Quarter-hour hover zones */}
                    {[0, 1, 2, 3].map(quarter => (
                      <div
                        key={`quarter-${quarter}`}
                        className="absolute left-0 right-0 hover:bg-neutral-50"
                        style={{
                          top: `${quarter * 25}%`,
                          height: '25%',
                        }}
                      />
                    ))}
                    {/* Quarter-hour dividing lines */}
                    <div className="absolute inset-0 pointer-events-none">
                      {[1, 2, 3].map(quarter => (
                        <div
                          key={`divider-${quarter}`}
                          className="absolute left-0 right-0 h-px"
                          style={{
                            top: `${quarter * 25}%`,
                            borderTop: '1px solid rgba(0,0,0,0.05)',
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Render calendar events */}
                  {renderCalendarEvents(hour.time, column.date)}
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Unified Drag Selection Overlay */}
      {isDragging && dragStart && dragEnd && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {(() => {
            const startTotalQuarters = dragStart.hourIndex * 4 + dragStart.quarter
            const endTotalQuarters = dragEnd.hourIndex * 4 + dragEnd.quarter
            const minQuarters = Math.min(startTotalQuarters, endTotalQuarters)
            const maxQuarters = Math.max(startTotalQuarters, endTotalQuarters)

            // Calculate pixel positions
            const startHourIndex = Math.floor(minQuarters / 4)
            const startQuarter = minQuarters % 4
            const endHourIndex = Math.floor(maxQuarters / 4)
            const endQuarter = maxQuarters % 4

            const topPosition = startHourIndex * 64 + startQuarter * 16
            const endPosition = endHourIndex * 64 + (endQuarter + 1) * 16
            const height = endPosition - topPosition

            // Calculate column position
            const timeColumnWidth = `calc((100% - ${gridCols.split(' ')[0]}) / ${
              dayColumns.length
            })`
            const leftPosition = `calc(${gridCols.split(' ')[0]} + ${
              dragStart.columnIndex
            } * ${timeColumnWidth})`

            return (
              <div
                className="absolute"
                style={{
                  top: `${topPosition}px`,
                  left: leftPosition,
                  width: timeColumnWidth,
                  height: `${height}px`,
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  animation: 'pulse 1s infinite',
                  borderRadius: '2px',
                }}
              />
            )
          })()}
        </div>
      )}

      {/* Current Time Line */}
      <div className="absolute inset-0 pointer-events-none">
        {dayColumns.map((column, columnIndex) => {
          const timeLinePosition = getCurrentTimeLinePosition(column.date)
          if (!timeLinePosition) return null

          return (
            <div
              key={`timeline-${columnIndex}`}
              className="absolute z-20"
              style={{
                top: `${timeLinePosition}px`,
                left: '80px',
                right: '0',
                height: '2px',
                display: 'grid',
                gridTemplateColumns: gridCols.replace('80px ', ''),
              }}
            >
              {dayColumns.map((_, dayIndex) => (
                <div
                  key={dayIndex}
                  className={`relative ${
                    dayIndex === columnIndex ? 'bg-red-500' : 'bg-transparent'
                  }`}
                  style={{
                    height: '2px',
                    boxShadow:
                      dayIndex === columnIndex ? '0 0 4px rgba(239, 68, 68, 0.5)' : 'none',
                  }}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}