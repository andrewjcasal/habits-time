import React, { useState } from 'react'

interface CalendarEventProps {
  type: 'habit' | 'session' | 'task' | 'placeholder' | 'meeting' | 'tasklog' | 'tasklog-urgent' | 'buffer' | 'reduced-buffer' | 'category-buffer' | 'todoist' | 'clickup'
  style: React.CSSProperties
  onClick?: (e: React.MouseEvent) => void
  onResizeStart?: (e: React.MouseEvent) => void
  onDragStart?: (e: React.MouseEvent) => void
  className?: string
  title?: string
  eventTitle: string
  duration?: string | number
  subtitle?: string
  icon?: React.ReactNode
  children?: React.ReactNode
  /** Optional content rendered as a tooltip above the event while hovered. */
  hoverTooltip?: React.ReactNode
}

const CalendarEvent: React.FC<CalendarEventProps> = ({
  type,
  style,
  onClick,
  onResizeStart,
  onDragStart,
  className = '',
  title,
  eventTitle,
  duration,
  subtitle,
  icon,
  children,
  hoverTooltip,
}) => {
  const [hovered, setHovered] = useState(false)
  
  // Check if duration is 30+ minutes - convert various formats to minutes
  const getDurationInMinutes = (dur: string | number): number => {
    if (typeof dur === 'number') return dur
    // Parse "1h 30m", "2h", "45m" formats
    const hMatch = dur.match(/(\d+)h/)
    const mMatch = dur.match(/(\d+)m/)
    if (hMatch || mMatch) {
      return (hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0)
    }
    if (dur.endsWith('min')) return parseInt(dur)
    return 0
  }
  
  const durationInMinutes = duration ? getDurationInMinutes(duration) : 0
  const is30PlusMin = durationInMinutes >= 30
  const is15Min = durationInMinutes == 15
  const is30Min = durationInMinutes == 30
  
  // When a hoverTooltip is provided we skip overflow-hidden so the tooltip
  // positioned at bottom-full isn't clipped by the event's bounds. Text
  // truncation on children (via .truncate) still works.
  const baseClass = `absolute text-sm sm:text-xs p-1 sm:p-0.5 ${
    is15Min || is30Min ? 'pt-0 sm:pt-0' : ''
  } ${is15Min ? 'leading-none' : ''} rounded ${
    is30PlusMin ? 'flex-col items-start' : 'flex items-start justify-between'
  } shadow-sm ${hoverTooltip ? 'overflow-visible' : 'overflow-hidden'}`

  const typeClasses = {
    habit: 'bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200 transition-colors',
    session: 'bg-purple-100 text-purple-800',
    task: 'bg-yellow-100 text-yellow-800 cursor-pointer hover:bg-yellow-200',
    placeholder: 'bg-green-100 text-green-800 cursor-pointer hover:bg-green-200',
    meeting: 'bg-red-100 text-red-800',
    tasklog: 'bg-yellow-100 text-yellow-800 cursor-pointer hover:opacity-100',
    'tasklog-urgent': 'bg-amber-200 text-amber-900 cursor-pointer hover:opacity-100',
    buffer: 'bg-indigo-100 text-indigo-800',
    'reduced-buffer': 'bg-orange-100 text-orange-800 opacity-80',
    'category-buffer': 'bg-gray-100 text-gray-800',
    todoist: 'bg-rose-100 text-rose-800 cursor-pointer hover:bg-rose-200',
    clickup: 'bg-teal-100 text-teal-800 cursor-pointer hover:bg-teal-200',
  }

  return (
    <div
      className={`${baseClass} ${typeClasses[type]} ${onDragStart ? 'cursor-grab active:cursor-grabbing' : ''} ${className}`}
      style={{ ...style, pointerEvents: 'auto' }}
      onClick={onClick}
      onMouseDown={e => {
        e.stopPropagation()
        if (onDragStart) onDragStart(e)
      }}
      onMouseEnter={() => hoverTooltip && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
      data-calendar-event="true"
    >
      {hoverTooltip && hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 pointer-events-none">
          <div className="relative bg-white border border-neutral-200 rounded-md shadow-lg px-2 py-1.5 text-[11px] text-neutral-800 whitespace-nowrap max-w-xs">
            {hoverTooltip}
            {/* Arrow: centered on the tooltip's bottom edge so the upper half
                is hidden behind the white body, leaving a clean triangle. */}
            <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 top-full w-2 h-2 bg-white border-b border-r border-neutral-200 rotate-45" />
          </div>
        </div>
      )}
      {children || (
        <>
          <div className={`font-medium truncate ${is30PlusMin ? 'w-full leading-tight' : 'flex-1'}`}>
            <div className="flex items-center">
              {icon && <span className="mr-0.5 flex-shrink-0">{icon}</span>}
              <span>{eventTitle}</span>
            </div>
            {subtitle && <div className="text-xs opacity-75">{subtitle}</div>}
            {is30PlusMin && duration && (
              <div className="text-sm sm:text-xs opacity-75 leading-tight">
                {duration}
              </div>
            )}
          </div>
          {!is15Min && !is30PlusMin && duration && (
            <div className="text-sm sm:text-xs opacity-75 ml-1 flex-shrink-0">
              {duration}
            </div>
          )}
        </>
      )}
      {onResizeStart && (
        <div
          className="absolute bottom-0 left-0 right-0 cursor-s-resize hover:bg-black/10 transition-colors"
          style={{ height: '5px' }}
          onMouseDown={e => {
            e.stopPropagation()
            e.preventDefault()
            onResizeStart(e)
          }}
        />
      )}
    </div>
  )
}

export default React.memo(CalendarEvent)