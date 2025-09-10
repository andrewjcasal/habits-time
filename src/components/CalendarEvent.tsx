import React from 'react'

interface CalendarEventProps {
  type: 'habit' | 'session' | 'task' | 'placeholder' | 'meeting' | 'tasklog' | 'buffer' | 'reduced-buffer' | 'category-buffer'
  style: React.CSSProperties
  onClick?: (e: React.MouseEvent) => void
  className?: string
  title?: string
  eventTitle: string
  duration?: string | number
  subtitle?: string
  icon?: React.ReactNode
  children?: React.ReactNode
}

const CalendarEvent: React.FC<CalendarEventProps> = ({ 
  type, 
  style, 
  onClick, 
  className = '',
  title,
  eventTitle,
  duration,
  subtitle,
  icon,
  children
}) => {
  
  // Check if duration is 30+ minutes - convert various formats to minutes
  const getDurationInMinutes = (dur: string | number): number => {
    if (typeof dur === 'number') return dur
    if (dur.endsWith('min')) return parseInt(dur)
    if (dur.endsWith('h')) return parseFloat(dur) * 60
    return 0
  }
  
  const durationInMinutes = duration ? getDurationInMinutes(duration) : 0
  const is30PlusMin = durationInMinutes >= 30
  const is15Min = durationInMinutes == 15
  const is30Min = durationInMinutes == 30
  
  const baseClass = `absolute text-sm sm:text-xs p-1 sm:p-0.5 ${
    is15Min || is30Min ? 'pt-0 sm:pt-0' : ''
  } rounded ${
    is30PlusMin ? 'flex-col items-start' : 'flex items-start justify-between'
  } shadow-sm overflow-hidden`

  const typeClasses = {
    habit: 'bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200 transition-colors',
    session: 'bg-purple-100 text-purple-800',
    task: 'bg-yellow-100 text-yellow-800 cursor-pointer hover:bg-yellow-200',
    placeholder: 'bg-green-100 text-green-800 cursor-pointer hover:bg-green-200',
    meeting: 'bg-red-100 text-red-800',
    tasklog: 'bg-yellow-100 text-yellow-800 cursor-pointer hover:opacity-100',
    buffer: 'bg-indigo-100 text-indigo-800',
    'reduced-buffer': 'bg-orange-100 text-orange-800 opacity-80',
    'category-buffer': 'bg-gray-100 text-gray-800',
  }

  return (
    <div
      className={`${baseClass} ${typeClasses[type]} ${className}`}
      style={{ ...style, pointerEvents: 'auto' }}
      onClick={onClick}
      title={title}
      data-calendar-event="true"
    >
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
    </div>
  )
}

export default CalendarEvent