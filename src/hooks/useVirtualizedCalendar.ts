import { useState, useEffect, useMemo, useCallback } from 'react'

interface VirtualizedCalendarOptions {
  itemHeight: number // Height of each time slot row
  containerHeight: number // Height of the visible container
  overscan?: number // Extra items to render outside viewport
}

export const useVirtualizedCalendar = (
  totalItems: number,
  options: VirtualizedCalendarOptions
) => {
  const { itemHeight, containerHeight, overscan = 5 } = options
  const [scrollTop, setScrollTop] = useState(0)

  // Calculate which items should be visible
  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight)
    const visibleCount = Math.ceil(containerHeight / itemHeight)
    const end = start + visibleCount

    return {
      start: Math.max(0, start - overscan),
      end: Math.min(totalItems, end + overscan),
      visibleStart: start,
      visibleEnd: end
    }
  }, [scrollTop, itemHeight, containerHeight, totalItems, overscan])

  // Calculate the total height and offset for positioning
  const totalHeight = totalItems * itemHeight
  const offsetY = visibleRange.start * itemHeight

  // Handle scroll events
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  return {
    visibleRange,
    totalHeight,
    offsetY,
    handleScroll,
    itemHeight
  }
}