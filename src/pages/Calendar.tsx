import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, memo } from 'react'
import { useSearchParams, useOutletContext } from 'react-router-dom'
import { format } from 'date-fns'
import { Plus, Info, FileText, RefreshCw, Settings as SettingsIcon } from 'lucide-react'
import CalendarSettingsPanel from '../components/CalendarSettingsPanel'
import NoteModal from '../components/NoteModal'
import { useCalendarData } from '../hooks/useCalendarData'
import { useHabits } from '../hooks/useHabits'
import { supabase } from '../lib/supabase'
import { Meeting } from '../types'
import { deltaYToMinutes, computeMovedTimes } from '../utils/calendarDragUtils'
import { hourToGridIndex } from '../utils/calendarGrid'
import { getEffectiveHabitStartTime } from '../utils/habitScheduling'
import {
  handleHabitTimeChange,
  handleHabitSkip,
  handleCompleteTask,
  handleDeleteTask,
} from '../utils/calendarDatabaseOperations'
import { useBillableHours, BillableHoursConflictError } from '../hooks/useBillableHours'
import { ensureBillableQuotaForRange } from '../utils/billableHoursAutoPlacement'
import { generateBufferIntervalsForRange } from '../utils/bufferManager'
import { getHourRanges } from '../utils/hourRanges'
import { useModal, CalendarModalHandlers } from '../contexts/useModal'
import { useUserContext } from '../contexts/UserContext'
import CalendarEventSlots from '../components/CalendarEventSlots'
import { useEventRegistry, RegistryEventType } from '../hooks/useEventRegistry'
import CalendarTopBar from '../components/CalendarTopBar'
import CalendarGrid, { getQuarterFromMousePosition, quarterToTimeString } from '../components/CalendarGrid'
import BillableStatsBadge from '../components/BillableStatsBadge'

const CalendarContent = () => {
  const handlersRef = useRef<Record<string, Function>>({})
  const [meetingTitles, setMeetingTitles] = useState<{ title: string; count: number; lastUsed: Date }[]>([])
  const [meetingCategories, setMeetingCategories] = useState<{ id: string; name: string; color: string }[]>([])
  const [calendarHabits, setCalendarHabits] = useState<any[]>([])

  const { openMeetingModal, openHabitModal, openTaskModal, openSessionModal, openProjectActivityModal, closeAllModals, openResizeConflictDialog, selectedTimeSlot: modalTimeSlot, registerModalHandlers, setCalendarModalData } = useModal()
  const { user } = useUserContext()
  const { createHabit } = useHabits()
  const { setMobileMenuOpen } = useOutletContext<{ setMobileMenuOpen: (open: boolean) => void }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const [containerHeight, setContainerHeight] = useState(600)
  const containerRef = useRef<HTMLDivElement>(null)
  const stickyHeaderRef = useRef<HTMLDivElement>(null)
  const [mobileHeaderHeight, setMobileHeaderHeight] = useState(0)
  const [showWorkHoursTooltip, setShowWorkHoursTooltip] = useState(false)
  // Inline conflict toast for rejected manual billable-hour drops.
  // Auto-dismisses after 3s; cleared by the next conflict or unmount.
  const [conflictToast, setConflictToast] = useState<string | null>(null)

  // Note view modal state
  const [viewingNote, setViewingNote] = useState<any>(null)
  const [isSyncingTodoist, setIsSyncingTodoist] = useState(false)
  const [showCalendarSettings, setShowCalendarSettings] = useState(false)

  const [meetingDataLoaded, setMeetingDataLoaded] = useState(false)

  const [hourHeight, setHourHeight] = useState<number>(() => {
    if (typeof window === 'undefined') return 64
    const stored = window.localStorage.getItem('calendarHourHeight')
    const parsed = stored ? parseInt(stored, 10) : NaN
    return Number.isFinite(parsed) ? parsed : 64
  })

  useEffect(() => {
    window.localStorage.setItem('calendarHourHeight', String(hourHeight))
  }, [hourHeight])

  const [dayColumnCount, setDayColumnCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 7
    const stored = window.localStorage.getItem('calendarDayColumnCount')
    const parsed = stored ? parseInt(stored, 10) : NaN
    return parsed === 3 || parsed === 7 ? parsed : 7
  })

  useEffect(() => {
    window.localStorage.setItem('calendarDayColumnCount', String(dayColumnCount))
  }, [dayColumnCount])


  // Handle Google Calendar OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('google_callback') === 'true' && params.get('code')) {
      const code = params.get('code')!
      const handleCallback = async () => {
        const { data, error } = await supabase.functions.invoke('google-calendar', {
          body: {
            action: 'callback',
            code,
            redirectUri: window.location.origin + '/calendar?google_callback=true',
          },
        })
        console.log('[gcal callback] response:', data, 'error:', error)
        // Clean URL and sync
        window.history.replaceState({}, '', '/calendar')
        await syncGoogleCalendar()
      }
      handleCallback()
    }
  }, [])

  // Sync Google Calendar events
  const syncGoogleCalendar = async () => {
    const { data } = await supabase.functions.invoke('google-calendar', {
      body: { action: 'list_calendars' },
    })
    const calendars = data?.calendars || []
    const enabledCalendars = calendars.filter((c: any) => c.is_enabled)
    for (const cal of enabledCalendars) {
      await supabase.functions.invoke('google-calendar', {
        body: { action: 'sync_events', userCalendarId: cal.id },
      })
    }
    // Refresh calendar data by reloading
    window.location.reload()
  }

  // Pre-fetch meeting modal data on calendar mount
  useEffect(() => {
    if (!user || meetingDataLoaded) return
    const fetchMeetingData = async () => {
      const [titlesRes, categoriesRes] = await Promise.all([
        supabase.rpc('get_recent_meeting_titles', { p_user_id: user.id, p_limit: 20 }),
        supabase.from('cassian_meeting_categories').select('id, name, color').eq('user_id', user.id).order('name'),
      ])
      if (titlesRes.data) {
        setMeetingTitles(titlesRes.data.map((row: any) => ({ title: row.title, count: row.count, lastUsed: new Date(row.last_used) })))
      }
      if (categoriesRes.data) {
        setMeetingCategories(categoriesRes.data)
      }
      setMeetingDataLoaded(true)
    }
    fetchMeetingData()
  }, [user])

  // Calendar notes come from useCalendarData (merged into single fetch)

  // Event resize state — applies to any event type registered in
  // useEventRegistry (currently meeting + project-activity).
  const [resizingEvent, setResizingEvent] = useState<{ type: RegistryEventType; event: any } | null>(null)
  const [resizeNewEndTime, setResizeNewEndTime] = useState<Date | null>(null)
  const resizeStartYRef = useRef<number>(0)
  const resizeStartEndTimeRef = useRef<Date | null>(null)

  // Meeting drag-to-move state
  const [draggingMeeting, setDraggingMeeting] = useState<any>(null)
  const [meetingDragY, setMeetingDragY] = useState<number>(0)
  const meetingDragStartYRef = useRef<number>(0)
  const meetingDragMovedRef = useRef<boolean>(false)

  // Task log drag state
  const [draggingTaskLog, setDraggingTaskLog] = useState<any>(null)
  const [taskLogDragY, setTaskLogDragY] = useState<number>(0)
  const taskLogDragStartYRef = useRef<number>(0)
  const taskLogOriginalStartRef = useRef<string>('')

  // Habit resize state
  const [resizingHabit, setResizingHabit] = useState<any>(null)
  const [resizingHabitDate, setResizingHabitDate] = useState<Date | null>(null)
  const [resizeHabitNewDuration, setResizeHabitNewDuration] = useState<number>(0)
  const habitResizeStartYRef = useRef<number>(0)
  const habitResizeOriginalDurationRef = useRef<number>(0)

  // Habit drag state
  const [draggingHabit, setDraggingHabit] = useState<any>(null)
  const [draggingHabitDate, setDraggingHabitDate] = useState<Date | null>(null)
  const [habitDragY, setHabitDragY] = useState<number>(0)
  const habitDragStartYRef = useRef<number>(0)
  const habitOriginalStartRef = useRef<string>('')

  // Drag-to-create meeting state
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{
    time: string
    date: Date
    hourIndex: number
    columnIndex: number
    quarter: number
  } | null>(null)
  const [dragEnd, setDragEnd] = useState<{
    time: string
    date: Date
    hourIndex: number
    columnIndex: number
    quarter: number
  } | null>(null)

  // Initialize baseDate from URL parameter or current date
  const getInitialDate = () => {
    const dateParam = searchParams.get('date')
    if (dateParam) {
      // Parse as local date to avoid timezone issues
      const [year, month, day] = dateParam.split('-').map(Number)
      if (year && month && day) {
        const parsedDate = new Date(year, month - 1, day) // month is 0-indexed
        // Validate the date
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate
        }
      }
    }
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    return twoDaysAgo
  }

  const [baseDate, setBaseDate] = useState(getInitialDate)

  const {
    allTasks,
    dayColumns,
    hourSlots,
    getCurrentTimeLinePosition,
    habits,
    meetings,
    tasksDailyLogs,
    getTasksForTimeSlot,
    getMeetingsForTimeSlot,
    getHabitsForTimeSlot,
    getSessionsForTimeSlot,
    getTasksDailyLogsForTimeSlot,
    getBuffersForCalendarTimeSlot,
    getCategoryBuffersForTimeSlot,
    buffers,
    categoryBufferBlocks,
    settings,
    tasksScheduled,
    scheduledTasksCache,
    addMeeting,
    updateMeeting,
    deleteMeeting,
    addProjectActivity,
    deleteProjectActivity,
    updateProjectActivity,
    getProjectActivityForTimeSlot,
    projects,
    projectActivity,
    isDataLoading,
    calendarNotes,
    habitNotes,
    setHabitNotes,
    getNotesForDateTime,
    addCalendarNote,
    addHabitNote,
    removeCalendarNote,
    removeTaskFromCalendar,
    removeTaskLogFromUI,
    moveTaskLog,
    skipHabitForDate,
    addHabitBlock,
    updateHabitLogDuration,
    moveHabitLog,
    linkMeetingHabit,
    addHabit,
    markHabitArchived,
    archivedHabits,
    unarchiveHabit,
    syncTodoist,
    syncClickUp,
  } = useCalendarData(windowWidth, baseDate, hourHeight, dayColumnCount)

  // Registry of per-event-type operations (resize, future: extend, move,
  // delete). The mousemove/mouseup loop dispatches through this instead of
  // branching on type.
  // Past project_activity rows fold into the "Billed 7d" stat alongside
  // past billable_hours. Pass them through to the hook so it can sum
  // both sources without re-fetching project_activity itself.
  const pastProjectActivity = useMemo(
    () =>
      (projectActivity || []).map((a: any) => ({
        start_time: a.start_time,
        end_time: a.end_time,
      })),
    [projectActivity]
  )

  // Conflict sources for manual billable-hour create/edit/resize. The
  // auto-placer doesn't go through this guard (it inverts intervals up
  // front and inserts only into free windows). When the user manually
  // drags or resizes a block into an overlap, useBillableHours throws
  // a BillableHoursConflictError and the caller surfaces a toast.
  // TODO: also include habit blocks once manual create UI lands —
  // habits don't carry ISO start/end on the row, they need to be
  // expanded from scheduled_start_time + duration per visible day.
  const billableConflictSources = useMemo(() => {
    const meetingEntries = (meetings || []).map((m: any) => ({
      start_time: m.start_time,
      end_time: m.end_time,
      title: m.title || 'a meeting',
    }))
    const activityEntries = (projectActivity || []).map((a: any) => ({
      start_time: a.start_time,
      end_time: a.end_time,
      title: a.projects?.name || 'a project activity block',
    }))
    return [...meetingEntries, ...activityEntries]
  }, [meetings, projectActivity])

  const {
    billableHours,
    addBillableHour: _addBillableHour,
    updateBillableHour,
    deleteBillableHour: _deleteBillableHour,
    removeBillableHours,
    appendBillableHours,
  } = useBillableHours({
    pastBilledExtras: pastProjectActivity,
    conflictSources: billableConflictSources,
  })

  // Aggregate billable-hours sums for the day-header badge tooltip:
  // today (local), upcoming 7-day rolling window, and the remainder of
  // the current calendar month from now. Mirrors the windowing logic
  // inside useBillableHours but exposes a different cut for hover.
  const billableStats = useMemo(() => {
    const now = new Date()
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const sumHours = (rangeStart: Date, rangeEnd: Date): number =>
      billableHours.reduce((sum, b) => {
        const start = new Date(b.start_time).getTime()
        const end = new Date(b.end_time).getTime()
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return sum
        if (start >= rangeStart.getTime() && start < rangeEnd.getTime()) {
          return sum + (end - start) / (1000 * 60 * 60)
        }
        return sum
      }, 0)

    const hoursForDay = (dateStr: string): number => {
      const dayStart = new Date(`${dateStr}T00:00:00`)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)
      return sumHours(dayStart, dayEnd)
    }

    return {
      hoursForDay,
      next7DaysHours: sumHours(now, sevenDaysOut),
      restOfMonthHours: sumHours(now, endOfMonth),
    }
  }, [billableHours])

  const eventRegistry = useEventRegistry({ updateMeeting, updateProjectActivity, updateBillableHour })

  // Page-load rollover: convert past billable-hour blocks that had a
  // project commitment into matching project_activity rows (>= 15 min
  // only) before deleting them. Unassigned or sub-15-min past rows are
  // simply deleted. Runs once per session.
  const billableRolloverRanRef = useRef(false)
  useEffect(() => {
    if (billableRolloverRanRef.current) return
    if (isDataLoading || !user) return
    if (!billableHours.length && !projects?.length) return
    billableRolloverRanRef.current = true
    const run = async () => {
      const nowMs = Date.now()
      const pastBlocks = billableHours
        .filter(b => new Date(b.start_time).getTime() < nowMs)
        .sort(
          (a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )
      if (pastBlocks.length === 0) return

      // Compute project assignment for past blocks using the same
      // greedy commitment logic the upcoming placer uses.
      interface Slot {
        id: string
        remainingTotal: number
      }
      const slots: Slot[] = []
      for (const p of (projects || []) as any[]) {
        if (p.status === 'archived') continue
        const total =
          p.commitment_total_hours != null
            ? Number(p.commitment_total_hours)
            : null
        if (total == null || total <= 0) continue
        const worked = (projectActivity || [])
          .filter((a: any) => a.project_id === p.id)
          .reduce((sum: number, a: any) => {
            const s = new Date(a.start_time).getTime()
            const e = new Date(a.end_time).getTime()
            return e > s ? sum + (e - s) / (1000 * 60 * 60) : sum
          }, 0)
        const remaining = Math.max(0, total - worked)
        if (remaining > 0) slots.push({ id: p.id, remainingTotal: remaining })
      }

      const assignments: Array<{ block: any; projectId: string }> = []
      const idsToDelete: string[] = []
      const MIN_HOURS = 0.25
      for (const block of pastBlocks) {
        const dur =
          (new Date(block.end_time).getTime() -
            new Date(block.start_time).getTime()) /
          (1000 * 60 * 60)
        if (dur >= MIN_HOURS) {
          const slot = slots.find(s => s.remainingTotal > 0)
          if (slot) {
            assignments.push({ block, projectId: slot.id })
            slot.remainingTotal -= dur
            idsToDelete.push(block.id)
            continue
          }
        }
        idsToDelete.push(block.id)
      }

      try {
        for (const a of assignments) {
          await addProjectActivity({
            project_id: a.projectId,
            start_time: a.block.start_time,
            end_time: a.block.end_time,
          })
        }
        if (idsToDelete.length > 0) {
          await supabase
            .from('cassian_billable_hours')
            .delete()
            .in('id', idsToDelete)
          removeBillableHours(idsToDelete)
        }
      } catch (err) {
        console.error('Billable rollover failed:', err)
      }
    }
    run()
  }, [
    isDataLoading,
    user,
    billableHours,
    projects,
    projectActivity,
    removeBillableHours,
    addProjectActivity,
  ])

  // Idempotently top up billable-hour blocks for the next 7-day window
  // whenever the relevant event sets shift. Debounced so a flurry of
  // mutations (e.g. drag-creating a meeting) doesn't fire the placer
  // multiple times. The placer respects existing rows; it only ADDS.
  useEffect(() => {
    if (isDataLoading) return
    if (!user) return
    const handle = window.setTimeout(async () => {
      try {
        const now = new Date()
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)
        // Fill through the end of the current calendar month so the
        // "Remaining Month" stat reflects an actual horizon, not just
        // the 7-day rolling window. First-of-next-month is exclusive.
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)

        // Daily end-of-day buffers across the full placer range (today
        // through end of month) so navigating forward doesn't reveal
        // days the placer filled without buffer awareness.
        const bufferIntervals = generateBufferIntervalsForRange(
          start,
          end,
          meetings,
          projectActivity
        )
        categoryBufferBlocks.forEach((block: any) => {
          const day = new Date(block.date)
          const startMs = new Date(day).setHours(0, 0, 0, 0) + block.start_time * 60 * 60 * 1000
          const endMs = startMs + block.duration * 60 * 60 * 1000
          bufferIntervals.push({
            start_time: new Date(startMs).toISOString(),
            end_time: new Date(endMs).toISOString(),
          })
        })

        const inserts = await ensureBillableQuotaForRange({
          userId: user.id,
          startDate: start,
          endDate: end,
          hourRanges: getHourRanges(settings),
          habits,
          meetings,
          projectActivity,
          buffers: bufferIntervals,
          existingBillableHours: billableHours,
        })
        if (inserts.length > 0) appendBillableHours(inserts)
      } catch (err) {
        console.error('Billable-hours placer failed:', err)
      }
    }, 500)
    return () => window.clearTimeout(handle)
  }, [
    isDataLoading,
    user,
    settings,
    habits,
    meetings,
    projectActivity,
    categoryBufferBlocks,
    billableHours,
    appendBillableHours,
  ])

  // Calendar data already includes habits - no need for separate useHabits hook

  // Mirror habits into local state that's passed to MeetingModal via context
  useEffect(() => {
    setCalendarHabits(habits)
  }, [habits])

  const gridCols =
    windowWidth > 600
      ? `80px ${Array(dayColumnCount).fill('1fr').join(' ')}`
      : '60px 1fr'

  // Navigation functions
  const navigateBackWeek = () => {
    const newDate = new Date(baseDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    setBaseDate(newDate)
    setSearchParams({ date: format(newDate, 'yyyy-MM-dd') })
  }

  const navigateBackDay = () => {
    const newDate = new Date(baseDate.getTime() - 24 * 60 * 60 * 1000)
    setBaseDate(newDate)
    setSearchParams({ date: format(newDate, 'yyyy-MM-dd') })
  }

  const navigateForwardDay = () => {
    const newDate = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000)
    setBaseDate(newDate)
    setSearchParams({ date: format(newDate, 'yyyy-MM-dd') })
  }

  const navigateToToday = () => {
    const today = new Date()
    setBaseDate(today)
    setSearchParams({ date: format(today, 'yyyy-MM-dd') })
  }

  const navigateForwardWeek = () => {
    const newDate = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000)
    setBaseDate(newDate)
    setSearchParams({ date: format(newDate, 'yyyy-MM-dd') })
  }

  // Listen for URL parameter changes
  useEffect(() => {
    const dateParam = searchParams.get('date')
    if (dateParam) {
      // Parse as local date to avoid timezone issues
      const [year, month, day] = dateParam.split('-').map(Number)
      if (year && month && day) {
        const parsedDate = new Date(year, month - 1, day) // month is 0-indexed
        if (!isNaN(parsedDate.getTime())) {
          setBaseDate(parsedDate)
        }
      }
    }
  }, [searchParams])

  // Listen for window resize and container height changes
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight)
      }
    }

    handleResize() // Initial call
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Update container height and scroll to 3 hours before now
  // Measure the (position:fixed on mobile) top bar so we can render a spacer
  // of matching height under it. Keep it live so conditional children like
  // the day-note banner are accounted for.
  useLayoutEffect(() => {
    const el = stickyHeaderRef.current
    if (!el) return
    const update = () => setMobileHeaderHeight(el.offsetHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (containerRef.current) setContainerHeight(containerRef.current.clientHeight)
  }, [])

  // Scroll to ~3 hours before now once, after the calendar data has resolved.
  // Gating on isDataLoading ensures the grid has rendered its full height
  // (and for mobile, the spacer has settled) before we call scrollTo —
  // otherwise the scroll clamps short because the document isn't tall yet.
  const didInitialScrollRef = useRef(false)
  useEffect(() => {
    if (isDataLoading) return
    if (didInitialScrollRef.current) return
    if (!containerRef.current) return
    didInitialScrollRef.current = true

    const now = new Date()
    const currentHour = now.getHours()
    // Grid: 6-23 = index 0-17, 0-4 = index 18-22
    const isLateNight = currentHour >= 0 && currentHour < 5
    const currentIndex = isLateNight ? (currentHour + 18) : (currentHour - 6)
    const scrollIndex = Math.max(0, currentIndex - 3)
    const scrollOffset = scrollIndex * hourHeight

    const performScroll = () => {
      if (!containerRef.current) return
      const isMobile = window.innerWidth < 768
      if (isMobile) {
        // Header is position:fixed on mobile + a spacer of equal height
        // precedes the grid, so the grid sits at document-Y = headerHeight.
        // Scrolling the window by scrollOffset lines the target hour up
        // just below the fixed header.
        window.scrollTo(0, scrollOffset)
      } else {
        containerRef.current.scrollTop = scrollOffset
      }
    }

    // One rAF to let React flush the post-load commit, a setTimeout to
    // catch the iOS-Safari case where layout/scrolling isn't fully
    // settled for a beat after the address bar finishes adjusting.
    const raf = requestAnimationFrame(performScroll)
    const timer = setTimeout(performScroll, 150)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [isDataLoading])

  // Hours 0-4 on a column visually belong to the next calendar day
  const adjustDateForLateNight = (time: string, columnDate: Date): Date => {
    const hour = parseInt(time.split(':')[0])
    if (hour >= 0 && hour < 5) {
      const nextDay = new Date(columnDate)
      nextDay.setDate(nextDay.getDate() + 1)
      return nextDay
    }
    return columnDate
  }

  const dragOccurredRef = useRef(false)
  const handleTimeSlotClick = (event: React.MouseEvent, timeSlot: string, date: Date) => {
    // Skip if a drag just completed (the drag handler already opened the modal)
    if (dragOccurredRef.current) {
      dragOccurredRef.current = false
      return
    }
    // Check if the click originated from a calendar event
    const target = event.target as HTMLElement
    if (target.closest('[data-calendar-event]')) {
      return // Don't open meeting modal if clicking on a calendar event
    }
    // Calculate the quarter-hour from click position
    const quarter = getQuarterFromMousePosition(event, event.currentTarget as HTMLElement)
    const [hour] = timeSlot.split(':')
    const minutes = quarter * 15
    const precisetime = `${hour}:${minutes.toString().padStart(2, '0')}`
    openMeetingModal({ time: precisetime, date: adjustDateForLateNight(precisetime, date) })
  }

  const handleAddMeeting = () => {
    openMeetingModal()
  }

  const handleProjectActivityClick = useCallback((activity: any) => {
    if (eventResizedRef.current) {
      eventResizedRef.current = false
      return
    }
    openProjectActivityModal(activity)
  }, [openProjectActivityModal])

  const handleEditMeeting = useCallback((meeting: Meeting) => {
    if (eventResizedRef.current) {
      eventResizedRef.current = false
      return
    }
    if (meetingDragMovedRef.current) {
      meetingDragMovedRef.current = false
      return
    }
    openMeetingModal(undefined, meeting)
  }, [openMeetingModal])

  const handleTimeSlotContextMenu = (event: React.MouseEvent, timeSlot: string, date: Date) => {
    event.preventDefault()
  }

  const handleSaveMeeting = async (
    e: React.FormEvent,
    updatedMeeting: any,
    editingMeeting?: Meeting
  ) => {
    e.preventDefault()
    try {
      let startTime: Date, endTime: Date

      // Handle both ISO string format and time string format (or mixed formats)
      if (updatedMeeting.start_time.includes('T') || updatedMeeting.end_time.includes('T')) {
        // ISO string format from MeetingModal (or mixed format for cross-midnight meetings)
        
        // Handle start_time
        if (updatedMeeting.start_time.includes('T')) {
          startTime = new Date(updatedMeeting.start_time)
        } else {
          // Parse time string and create full date
          const [startHour, startMinute] = updatedMeeting.start_time.split(':').map(Number)
          const [year, month, day] = updatedMeeting.date.split('-').map(Number)
          startTime = new Date(year, month - 1, day, startHour, startMinute)
        }
        
        // Handle end_time
        if (updatedMeeting.end_time.includes('T')) {
          endTime = new Date(updatedMeeting.end_time)
        } else {
          // Parse time string and create full date
          const [endHour, endMinute] = updatedMeeting.end_time.split(':').map(Number)
          const [year, month, day] = updatedMeeting.date.split('-').map(Number)
          endTime = new Date(year, month - 1, day, endHour, endMinute)
          
          // Handle cross-midnight case for time strings
          if (endTime <= startTime) {
            endTime = new Date(year, month - 1, day + 1, endHour, endMinute)
          }
        }
        
        // Validate dates
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          throw new Error('Invalid date/time values from modal')
        }
      } else {
        // Legacy time string format
        const [year, month, day] = updatedMeeting.date.split('-').map(Number)
        const [startHour, startMinute] = updatedMeeting.start_time.split(':').map(Number)
        const [endHour, endMinute] = updatedMeeting.end_time.split(':').map(Number)

        // Validate parsed values
        if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
          throw new Error('Invalid date/time parsing from legacy format')
        }

        // Create dates in local timezone (not UTC)
        startTime = new Date(year, month - 1, day, startHour, startMinute)
        endTime = new Date(year, month - 1, day, endHour, endMinute)
        
        // Handle cross-midnight meetings: if end time is earlier than start time, it's the next day
        if (endTime <= startTime) {
          endTime = new Date(year, month - 1, day + 1, endHour, endMinute)
        }
        
        // Validate created dates
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          throw new Error('Invalid dates created from legacy format')
        }
      }

      const meetingData = {
        title: updatedMeeting.title,
        description: updatedMeeting.description,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        location: updatedMeeting.location,
        meeting_type: updatedMeeting.meeting_type,
        priority: updatedMeeting.priority,
        category_id: updatedMeeting.category_id || null,
        status: 'scheduled' as const,
      }

      if (editingMeeting) {
        await updateMeeting(editingMeeting.id, meetingData)
      } else {
        await addMeeting(meetingData)
      }

      // Delete overlapping task daily logs
      const meetingDateStr = format(startTime, 'yyyy-MM-dd')
      const meetingStartH = startTime.getHours() + startTime.getMinutes() / 60
      const meetingEndH = endTime.getHours() + endTime.getMinutes() / 60
      const overlapping = tasksDailyLogs.filter((log: any) => {
        if (log.log_date !== meetingDateStr) return false
        const logTime = log.actual_start_time || log.scheduled_start_time
        if (!logTime) return false
        const logStartH = parseInt(logTime.split(':')[0]) + parseInt(logTime.split(':')[1]) / 60
        const logEndH = logStartH + (log.estimated_hours || 0.5)
        return logStartH < meetingEndH && logEndH > meetingStartH
      })
      if (overlapping.length > 0) {
        for (const log of overlapping) {
          await supabase.from('cassian_tasks_daily_logs').delete().eq('id', log.id)
          removeTaskLogFromUI(log.id)
        }
      }

      // Modal cleanup handled by ModalContext's closeMeetingModal()
    } catch (error) {
      console.error('Error saving meeting:', error)
    }
  }

  const handleDeleteMeeting = async (meeting: Meeting) => {
    try {
      await deleteMeeting(meeting.id)
      // Modal will be closed by the context
    } catch (error) {
      console.error('Error deleting meeting:', error)
    }
  }

  const handleTaskClick = useCallback((task: any) => {
    openTaskModal(task)
  }, [openTaskModal])

  const handleHabitClick = useCallback((habit: any, date: Date) => {
    openHabitModal(habit, date)
  }, [openHabitModal])

  const handleSessionClick = useCallback((session: any) => {
    openSessionModal(session)
  }, [openSessionModal])

  const handleHabitTimeChangeWithReset = async (
    habitId: string,
    date: string,
    newTime: string,
    newDuration?: number
  ) => {
    try {
      await handleHabitTimeChange(habitId, date, newTime, newDuration)
      // Reflect the change in local state so the calendar rerenders without
      // a full refetch. moveHabitLog handles both existing-log updates and
      // inserting a new log on a different date (e.g. moving an occurrence).
      const timeWithSeconds = newTime.length === 5 ? `${newTime}:00` : newTime
      moveHabitLog(habitId, date, timeWithSeconds)
      if (newDuration !== undefined) {
        updateHabitLogDuration(habitId, date, newDuration)
      }
    } catch (error) {
      console.error('Error updating habit:', error)
      throw error
    }
  }

  const handleHabitSkipWithReset = async (habitId: string, date: string) => {
    try {
      await handleHabitSkip(habitId, date)
      skipHabitForDate(habitId, date)
    } catch (error) {
      console.error('Error skipping habit:', error)
      throw error
    }
  }

  const closeModal = () => {
    closeAllModals()
    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
  }


  // Drag handlers for creating meetings
  const handleMouseDown = (
    event: React.MouseEvent,
    timeSlot: string,
    date: Date,
    hourIndex: number,
    columnIndex: number
  ) => {
    // Don't start drag if another drag/resize is active or clicking on a calendar event
    if (resizingEvent || draggingTaskLog || draggingHabit) return
    const target = event.target as HTMLElement
    if (target.closest('[data-calendar-event]')) return
    
    const quarter = getQuarterFromMousePosition(event, event.currentTarget as HTMLElement)
    setIsDragging(true)
    setDragStart({ time: timeSlot, date, hourIndex, columnIndex, quarter })
    setDragEnd({ time: timeSlot, date, hourIndex, columnIndex, quarter })
  }

  const handleMouseEnter = (
    event: React.MouseEvent,
    timeSlot: string,
    date: Date,
    hourIndex: number,
    columnIndex: number
  ) => {
    if (isDragging && dragStart && columnIndex === dragStart.columnIndex) {
      const quarter = getQuarterFromMousePosition(event, event.currentTarget as HTMLElement)
      setDragEnd({ time: timeSlot, date, hourIndex, columnIndex, quarter })
    }
  }

  const handleMouseMove = (
    event: React.MouseEvent,
    timeSlot: string,
    date: Date,
    hourIndex: number,
    columnIndex: number
  ) => {
    if (isDragging && dragStart && columnIndex === dragStart.columnIndex) {
      const quarter = getQuarterFromMousePosition(event, event.currentTarget as HTMLElement)
      setDragEnd({ time: timeSlot, date, hourIndex, columnIndex, quarter })
    }
  }

  const handleMouseUp = (
    event?: React.MouseEvent,
    timeSlot?: string,
    date?: Date,
    hourIndex?: number,
    columnIndex?: number
  ) => {
    if (event) mouseHandledRef.current = true

    
    // Don't process drag-to-create if another event drag just finished
    if (eventDragActiveRef.current) {
      eventDragActiveRef.current = false
      setIsDragging(false)
      setDragStart(null)
      setDragEnd(null)
      return
    }

    if (isDragging && dragStart) {
      // Force update dragEnd to the mouse up position if we have it
      let finalDragEnd = dragEnd
      if (event && timeSlot && date && hourIndex !== undefined && columnIndex !== undefined) {
        const quarter = getQuarterFromMousePosition(event, event.currentTarget as HTMLElement)
        finalDragEnd = { time: timeSlot, date, hourIndex, columnIndex, quarter }
      }

      if (finalDragEnd) {
        // Use the same calculation logic as the drag overlay
        const startTotalQuarters = dragStart.hourIndex * 4 + dragStart.quarter
        const endTotalQuarters = finalDragEnd.hourIndex * 4 + finalDragEnd.quarter
        const minQuarters = Math.min(startTotalQuarters, endTotalQuarters)
        const maxQuarters = Math.max(startTotalQuarters, endTotalQuarters)

        const startHourIndex = Math.floor(minQuarters / 4)
        const startQuarter = minQuarters % 4
        // End time is the END of the last selected quarter (add 1)
        const endPlusOne = maxQuarters + 1
        const endHourIndex = Math.floor(endPlusOne / 4)
        const endQuarter = endPlusOne % 4

        const startTime = quarterToTimeString(startHourIndex, startQuarter, hourSlots)
        const endTime = quarterToTimeString(endHourIndex, endQuarter, hourSlots)

        // Only open modal if we have a valid drag (not just a click)
        if (startTotalQuarters !== endTotalQuarters) {
          dragOccurredRef.current = true
          openMeetingModal({ time: startTime, date: adjustDateForLateNight(startTime, dragStart.date), endTime: endTime })
        }
      }
    }

    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
  }

  // Add global mouse up listener to handle mouse up outside the calendar
  const mouseHandledRef = useRef(false)
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging && !mouseHandledRef.current) {
        handleMouseUp()
      }
      mouseHandledRef.current = false
    }

    document.addEventListener('mouseup', handleGlobalMouseUp)
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [isDragging, dragStart, dragEnd])

  // Helper function to check if a time slot is within the drag selection
  const isInDragSelection = (hourIndex: number, columnIndex: number, quarter?: number) => {
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

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showWorkHoursTooltip && !(event.target as Element).closest('.work-hours-tooltip')) {
        setShowWorkHoursTooltip(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showWorkHoursTooltip])

  // Auto-dismiss the conflict toast 3s after it's set. Reset on each
  // new toast so consecutive rejections don't stack.
  useEffect(() => {
    if (!conflictToast) return
    const handle = window.setTimeout(() => setConflictToast(null), 3000)
    return () => window.clearTimeout(handle)
  }, [conflictToast])


  // Event resize handlers
  const eventResizedRef = useRef(false)
  const eventDragActiveRef = useRef(false)
  const handleEventResizeStart = useCallback(
    (type: RegistryEventType, event: any, e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      eventResizedRef.current = true
      eventDragActiveRef.current = true
      setResizingEvent({ type, event })
      resizeStartYRef.current = e.clientY
      resizeStartEndTimeRef.current = new Date(event.end_time)
      setResizeNewEndTime(new Date(event.end_time))
    },
    []
  )
  const handleMeetingResizeStart = useCallback((meeting: any, e: React.MouseEvent) => {
    handleEventResizeStart('meeting', meeting, e)
  }, [handleEventResizeStart])
  const handleProjectActivityResizeStart = useCallback((activity: any, e: React.MouseEvent) => {
    handleEventResizeStart('project-activity', activity, e)
  }, [handleEventResizeStart])
  const handleBillableHourResizeStart = useCallback((block: any, e: React.MouseEvent) => {
    handleEventResizeStart('billable-hours', block, e)
  }, [handleEventResizeStart])

  useEffect(() => {
    if (!resizingEvent) return
    const { type, event: resizingEventObj } = resizingEvent

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizeStartYRef.current
      const deltaMinutes = deltaYToMinutes(deltaY)
      const newEnd = new Date(resizeStartEndTimeRef.current!.getTime() + deltaMinutes * 60000)
      const eventStart = new Date(resizingEventObj.start_time)
      // Minimum 15 minutes
      if (newEnd.getTime() - eventStart.getTime() >= 15 * 60000) {
        setResizeNewEndTime(newEnd)
      }
    }

    const handleMouseUp = async () => {
      if (!resizeNewEndTime) {
        setResizingEvent(null)
        return
      }

      const originalEnd = new Date(resizingEventObj.end_time)
      if (resizeNewEndTime.getTime() === originalEnd.getTime()) {
        setResizingEvent(null)
        return
      }

      // Type-specific preflight: meetings check for overlapping tasks and
      // surface a confirmation dialog before extending. Other event types
      // currently have no preflight.
      if (type === 'meeting') {
        const meetingDate = format(new Date(resizingEventObj.start_time), 'yyyy-MM-dd')
        const newEndHours = resizeNewEndTime.getHours() + resizeNewEndTime.getMinutes() / 60
        const origEndHours = originalEnd.getHours() + originalEnd.getMinutes() / 60

        if (newEndHours > origEndHours) {
          const conflicting = tasksDailyLogs.filter((log: any) => {
            if (log.log_date !== meetingDate) return false
            const startTime = log.actual_start_time || log.scheduled_start_time
            if (!startTime) return false
            const logStartH = parseInt(startTime.split(':')[0]) + parseInt(startTime.split(':')[1]) / 60
            const logEndH = logStartH + (log.estimated_hours || 0.5)
            return logStartH < newEndHours && logEndH > origEndHours
          })

          if (conflicting.length > 0) {
            openResizeConflictDialog(resizingEventObj, resizeNewEndTime, conflicting)
            setResizingEvent(null)
            setResizeNewEndTime(null)
            return
          }
        }
      }

      // Dispatch the actual write through the registry. Each entry knows
      // how to persist + patch local state for its type.
      const newEnd = resizeNewEndTime
      const newEndIso = newEnd.toISOString()
      try {
        await eventRegistry[type].resize?.(resizingEventObj, newEndIso)
      } catch (err) {
        if (err instanceof BillableHoursConflictError) {
          // Manual resize would overlap a meeting / project_activity /
          // another billable block. The hook rejected the write; the
          // local state is unchanged so the block snaps back.
          setConflictToast(`Conflicts with ${err.conflictTitle}`)
        } else {
          console.error(`Error resizing ${type}:`, err)
        }
      }
      setResizingEvent(null)
      setResizeNewEndTime(null)

      // Meeting-specific side effect: locally regen Todoist/ClickUp task
      // placement so they reflow around the new meeting end. Lives outside
      // the registry because it's coupled to upstream-sync helpers, not to
      // the underlying data write.
      if (type === 'meeting') {
        const patchedMeetings = meetings.map((m: any) =>
          m.id === resizingEventObj.id ? { ...m, end_time: newEndIso } : m
        )
        const regenTaskPlacementAfterResize = async () => {
          try {
            await Promise.all([
              settings?.todoist_api_key
                ? syncTodoist({ skipApi: true, meetingsOverride: patchedMeetings })
                : Promise.resolve(),
              settings?.clickup_api_key
                ? syncClickUp({ skipApi: true, meetingsOverride: patchedMeetings })
                : Promise.resolve(),
            ])
          } catch (err) {
            console.error('Error regenerating after meeting resize:', err)
          }
        }
        void regenTaskPlacementAfterResize()
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingEvent, resizeNewEndTime, tasksDailyLogs, eventRegistry, meetings, settings, syncTodoist, syncClickUp, openResizeConflictDialog])

  // Habit resize
  const handleHabitResizeStart = useCallback((habit: any, date: Date, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    eventDragActiveRef.current = true
    const dateStr = format(date, 'yyyy-MM-dd')
    const dailyLog = habit.habits_daily_logs?.find((log: any) => log.log_date === dateStr && !log.is_skipped)
    const duration = dailyLog?.duration || habit.duration || 60
    setResizingHabit(habit)
    setResizingHabitDate(date)
    habitResizeStartYRef.current = e.clientY
    habitResizeOriginalDurationRef.current = duration
    setResizeHabitNewDuration(duration)
  }, [])

  useEffect(() => {
    if (!resizingHabit || !resizingHabitDate) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaMinutes = deltaYToMinutes(e.clientY - habitResizeStartYRef.current)
      const newDuration = Math.max(15, habitResizeOriginalDurationRef.current + deltaMinutes)
      setResizeHabitNewDuration(newDuration)
    }

    const handleMouseUp = async () => {
      const dateStr = format(resizingHabitDate, 'yyyy-MM-dd')
      const originalDuration = habitResizeOriginalDurationRef.current

      if (resizeHabitNewDuration !== originalDuration) {
        // Find the daily log to update
        const dailyLog = resizingHabit.habits_daily_logs?.find(
          (log: any) => log.log_date === dateStr && !log.is_skipped
        )

        if (dailyLog?.id) {
          await supabase
            .from('cassian_habits_daily_logs')
            .update({ duration: resizeHabitNewDuration })
            .eq('id', dailyLog.id)
        } else {
          // No existing log — update via time change
          await handleHabitTimeChangeWithReset(
            resizingHabit.id, dateStr,
            getEffectiveHabitStartTime(resizingHabit, dateStr) || resizingHabit.current_start_time,
            resizeHabitNewDuration
          )
        }

        updateHabitLogDuration(resizingHabit.id, dateStr, resizeHabitNewDuration)
      }

      setResizingHabit(null)
      setResizingHabitDate(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingHabit, resizingHabitDate, resizeHabitNewDuration])

  // Task log drag-to-move
  const handleTaskLogDragStart = useCallback((log: any, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    eventDragActiveRef.current = true
    setDraggingTaskLog(log)
    taskLogDragStartYRef.current = e.clientY
    taskLogOriginalStartRef.current = log.scheduled_start_time
    setTaskLogDragY(0)
  }, [])

  useEffect(() => {
    if (!draggingTaskLog) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - taskLogDragStartYRef.current
      setTaskLogDragY(deltaY)
    }

    const handleMouseUp = async () => {
      if (!draggingTaskLog) return

      const result = computeMovedTimes(
        taskLogOriginalStartRef.current,
        draggingTaskLog.estimated_hours || 0.5,
        taskLogDragY
      )

      if (!result) {
        setDraggingTaskLog(null)
        setTaskLogDragY(0)
        return
      }

      // Check if the new end time is before now (moved into the past = complete)
      const now = new Date()
      const [endH, endM] = result.newEndTime.split(':').map(Number)
      const endDate = new Date(draggingTaskLog.log_date + 'T00:00:00')
      endDate.setHours(endH, endM, 0, 0)
      const isBeforeNow = endDate < now

      if (isBeforeNow && draggingTaskLog.tasks?.source === 'todoist' && draggingTaskLog.tasks?.todoist_task_id) {
        // Complete in Todoist
        await supabase.functions.invoke('todoist', {
          body: { action: 'complete', taskId: draggingTaskLog.tasks.todoist_task_id }
        })
        // Mark complete in DB
        await supabase.from('cassian_tasks').update({ is_complete: true, status: 'completed' }).eq('id', draggingTaskLog.task_id)
      } else if (isBeforeNow) {
        // Non-todoist task: mark complete
        await supabase.from('cassian_tasks').update({ is_complete: true, status: 'completed' }).eq('id', draggingTaskLog.task_id)
      }

      // Always move to the new position
      await supabase
        .from('cassian_tasks_daily_logs')
        .update({ scheduled_start_time: result.newStartTime, scheduled_end_time: result.newEndTime })
        .eq('id', draggingTaskLog.id)
      moveTaskLog(draggingTaskLog.id, result.newStartTime, result.newEndTime)

      setDraggingTaskLog(null)
      setTaskLogDragY(0)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingTaskLog, taskLogDragY])

  // Habit drag-to-move
  const handleHabitDragStart = useCallback((habit: any, date: Date, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    eventDragActiveRef.current = true
    const dateStr = format(date, 'yyyy-MM-dd')
    const dailyLog = habit.habits_daily_logs?.find((log: any) => log.log_date === dateStr)
    const startTime = getEffectiveHabitStartTime(habit, dateStr, dailyLog)
    setDraggingHabit(habit)
    setDraggingHabitDate(date)
    habitDragStartYRef.current = e.clientY
    habitOriginalStartRef.current = startTime || '06:00'
    setHabitDragY(0)
  }, [])

  useEffect(() => {
    if (!draggingHabit || !draggingHabitDate) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - habitDragStartYRef.current
      setHabitDragY(deltaY)
    }

    const handleMouseUp = async () => {
      if (!draggingHabit || !draggingHabitDate) return

      const dateStr = format(draggingHabitDate, 'yyyy-MM-dd')
      const durationHours = (draggingHabit.duration || 60) / 60
      const result = computeMovedTimes(habitOriginalStartRef.current, durationHours, habitDragY)

      if (!result) {
        setDraggingHabit(null)
        setHabitDragY(0)
        return
      }

      const newStartH = parseInt(result.newStartTime.split(':')[0])
      const newStartM = parseInt(result.newStartTime.split(':')[1])
      const newTimeStr = `${newStartH.toString().padStart(2, '0')}:${newStartM.toString().padStart(2, '0')}`
      const newEndH = parseInt(result.newEndTime.split(':')[0]) + parseInt(result.newEndTime.split(':')[1]) / 60
      const newStartHours = newStartH + newStartM / 60

      // Skip overlapping habits
      const overlappingHabits = habits.filter((h: any) => {
        if (h.id === draggingHabit.id) return false
        const hLog = h.habits_daily_logs?.find((log: any) => log.log_date === dateStr)
        if (hLog?.is_skipped) return false
        const hStart = hLog?.start_time || h.start_time || '06:00'
        const hStartH = parseInt(hStart.split(':')[0]) + parseInt(hStart.split(':')[1]) / 60
        const hDuration = (hLog?.duration || h.duration || 60) / 60
        const hEndH = hStartH + hDuration
        return hStartH < newEndH && hEndH > newStartHours
      })

      for (const h of overlappingHabits) {
        await handleHabitSkipWithReset(h.id, dateStr)
      }

      // Delete overlapping task daily logs
      const overlappingLogs = tasksDailyLogs.filter((log: any) => {
        if (log.log_date !== dateStr) return false
        const logTime = log.actual_start_time || log.scheduled_start_time
        if (!logTime) return false
        const logStartH = parseInt(logTime.split(':')[0]) + parseInt(logTime.split(':')[1]) / 60
        const logEndH = logStartH + (log.estimated_hours || 0.5)
        return logStartH < newEndH && logEndH > newStartHours
      })

      for (const log of overlappingLogs) {
        await supabase.from('cassian_tasks_daily_logs').delete().eq('id', log.id)
        removeTaskLogFromUI(log.id)
      }

      // Update the habit's time — find existing log and update by ID to avoid duplicates
      const existingLog = draggingHabit.habits_daily_logs?.find(
        (log: any) => log.log_date === dateStr && !log.is_skipped
      )
      if (existingLog?.id) {
        await supabase
          .from('cassian_habits_daily_logs')
          .update({ scheduled_start_time: `${newTimeStr}:00` })
          .eq('id', existingLog.id)
      } else {
        await handleHabitTimeChangeWithReset(draggingHabit.id, dateStr, newTimeStr)
      }

      // Update local state
      moveHabitLog(draggingHabit.id, dateStr, `${newTimeStr}:00`)

      setDraggingHabit(null)
      setHabitDragY(0)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingHabit, draggingHabitDate, habitDragY, habits, tasksDailyLogs])

  // Meeting drag-to-move
  const handleMeetingDragStart = useCallback((meeting: any, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    eventDragActiveRef.current = true
    meetingDragMovedRef.current = false
    setDraggingMeeting(meeting)
    meetingDragStartYRef.current = e.clientY
    setMeetingDragY(0)
  }, [])

  useEffect(() => {
    if (!draggingMeeting) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - meetingDragStartYRef.current
      if (Math.abs(deltaY) > 2) meetingDragMovedRef.current = true
      setMeetingDragY(deltaY)
    }

    const handleMouseUp = async () => {
      const dragged = draggingMeeting
      const deltaMin = deltaYToMinutes(meetingDragY)
      setDraggingMeeting(null)
      setMeetingDragY(0)

      if (!dragged || deltaMin === 0) return

      const newStart = new Date(new Date(dragged.start_time).getTime() + deltaMin * 60000)
      const newEnd = new Date(new Date(dragged.end_time).getTime() + deltaMin * 60000)
      try {
        await updateMeeting(dragged.id, {
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
        })
      } catch (err) {
        console.error('Error moving meeting:', err)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingMeeting, meetingDragY, updateMeeting])

  // Greedy project assignment for upcoming billable-hour blocks.
  // For each project with a non-zero commitment_total_hours, compute the
  // remaining hours = total − sum(past project_activity for that project).
  // Walk billable blocks in chronological order and fill the
  // first-not-yet-satisfied project; once a project is full move to the
  // next. Past blocks are unassigned (history doesn't need a label).
  const billableProjectMap = useMemo(() => {
    const result = new Map<string, { id: string; name: string; color?: string }>() // billableHourId → project
    if (!billableHours.length || !projects?.length) return result
    const nowMs = Date.now()

    const startOfWeekMs = (d: Date): number => {
      const out = new Date(d)
      out.setHours(0, 0, 0, 0)
      out.setDate(out.getDate() - out.getDay()) // Sunday-anchored
      return out.getTime()
    }

    const candidates = (projects as any[]).filter(
      p =>
        p.status !== 'archived' &&
        ((p.commitment_total_hours != null && Number(p.commitment_total_hours) > 0) ||
          (p.commitment_weekly_hours != null && Number(p.commitment_weekly_hours) > 0))
    )
    if (candidates.length === 0) return result

    interface Slot {
      id: string
      name: string
      color?: string
      remainingTotal: number // Infinity when no total cap
      weeklyHours: number // Infinity when no weekly cap
      remainingByWeek: Map<number, number> // weekStartMs → hours left
    }
    const slots: Slot[] = []
    for (const p of candidates) {
      const totalCommit =
        p.commitment_total_hours != null ? Number(p.commitment_total_hours) : Infinity
      const weeklyCommit =
        p.commitment_weekly_hours != null ? Number(p.commitment_weekly_hours) : Infinity
      let workedTotal = 0
      let workedThisWeek = 0
      const currentWeek = startOfWeekMs(new Date())
      for (const a of projectActivity || []) {
        if (a.project_id !== p.id) continue
        const s = new Date(a.start_time).getTime()
        const e = new Date(a.end_time).getTime()
        if (e <= s) continue
        const dur = (e - s) / (1000 * 60 * 60)
        workedTotal += dur
        if (startOfWeekMs(new Date(s)) === currentWeek) workedThisWeek += dur
      }
      const remainingTotal = Math.max(0, totalCommit - workedTotal)
      if (remainingTotal <= 0) continue
      const remainingByWeek = new Map<number, number>()
      if (Number.isFinite(weeklyCommit)) {
        remainingByWeek.set(currentWeek, Math.max(0, weeklyCommit - workedThisWeek))
      }
      slots.push({
        id: p.id,
        name: p.name,
        color: p.color,
        remainingTotal,
        weeklyHours: weeklyCommit,
        remainingByWeek,
      })
    }

    // Weekly-bound projects fill first so their cadence is honored before
    // non-weekly projects soak up the slots.
    slots.sort((a, b) => {
      const aW = Number.isFinite(a.weeklyHours) ? 0 : 1
      const bW = Number.isFinite(b.weeklyHours) ? 0 : 1
      return aW - bW
    })

    const upcoming = billableHours
      .filter(b => new Date(b.start_time).getTime() >= nowMs)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

    for (const block of upcoming) {
      const dur =
        (new Date(block.end_time).getTime() - new Date(block.start_time).getTime()) /
        (1000 * 60 * 60)
      if (dur <= 0) continue
      const blockWeek = startOfWeekMs(new Date(block.start_time))
      let chosen: Slot | null = null
      for (const slot of slots) {
        if (slot.remainingTotal <= 0) continue
        if (Number.isFinite(slot.weeklyHours)) {
          if (!slot.remainingByWeek.has(blockWeek)) {
            slot.remainingByWeek.set(blockWeek, slot.weeklyHours)
          }
          if ((slot.remainingByWeek.get(blockWeek) ?? 0) <= 0) continue
        }
        chosen = slot
        break
      }
      if (!chosen) continue
      result.set(block.id, { id: chosen.id, name: chosen.name, color: chosen.color })
      chosen.remainingTotal -= dur
      if (Number.isFinite(chosen.weeklyHours)) {
        chosen.remainingByWeek.set(
          blockWeek,
          (chosen.remainingByWeek.get(blockWeek) ?? chosen.weeklyHours) - dur
        )
      }
    }
    return result
  }, [billableHours, projects, projectActivity])

  // Income variants for the day-column tooltip. Each upcoming billable
  // block is valued at the assigned project's hourly_rate when one is
  // set, falling back to the block's own rate (or default $100/hr)
  // when unassigned. Declared after billableProjectMap so it can read
  // the assignment results directly.
  const billableIncomeStats = useMemo(() => {
    const now = new Date()
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const rateByProject = new Map<string, number>()
    for (const p of (projects || []) as any[]) {
      rateByProject.set(p.id, Number(p.hourly_rate || 0))
    }
    const incomeOfBlock = (b: any): number => {
      const s = new Date(b.start_time).getTime()
      const e = new Date(b.end_time).getTime()
      if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0
      const hours = (e - s) / (1000 * 60 * 60)
      const assignment = billableProjectMap.get(b.id)
      let rate = 0
      if (assignment) rate = rateByProject.get(assignment.id) || 0
      if (!rate) rate = Number(b.rate || 100)
      return hours * rate
    }
    const sumIncome = (rangeStart: Date, rangeEnd: Date): number =>
      billableHours.reduce((sum, b) => {
        const start = new Date(b.start_time).getTime()
        if (start >= rangeStart.getTime() && start < rangeEnd.getTime()) {
          return sum + incomeOfBlock(b)
        }
        return sum
      }, 0)
    const incomeForDay = (dateStr: string): number => {
      const dayStart = new Date(`${dateStr}T00:00:00`)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)
      return sumIncome(dayStart, dayEnd)
    }
    return {
      incomeForDay,
      next7DaysIncome: sumIncome(now, sevenDaysOut),
      restOfMonthIncome: sumIncome(now, endOfMonth),
    }
  }, [billableHours, billableProjectMap, projects])

  // Forecast upcoming-payment rows for the top-bar "Remaining Month"
  // tooltip. Two sources feed in:
  //  - past project_activity at projects with hourly_rate, paid out
  //    on a date driven by payment_type (manual = same day, upwork =
  //    Friday after the next Sunday-8pm cutoff)
  //  - upcoming billable_hours assigned to projects via
  //    billableProjectMap (forecasted under the same payout rules)
  // Plus a per-week "Possible Pay:" row summing UNassigned upcoming
  // billable_hours × their default rate.
  const upcomingPayments = useMemo(() => {
    const startOfDayMs = (d: Date): number => {
      const out = new Date(d)
      out.setHours(0, 0, 0, 0)
      return out.getTime()
    }
    const startOfWeekMs = (d: Date): number => {
      const out = new Date(d)
      out.setHours(0, 0, 0, 0)
      out.setDate(out.getDate() - out.getDay())
      return out.getTime()
    }
    // Upwork pay date: Friday after the next Sunday at 20:00 local.
    const upworkPaymentDateMs = (t: number): number => {
      const T = new Date(t)
      const sun = new Date(T)
      const daysUntilSun = (7 - sun.getDay()) % 7
      sun.setDate(sun.getDate() + daysUntilSun)
      sun.setHours(20, 0, 0, 0)
      if (sun.getTime() < t) sun.setDate(sun.getDate() + 7)
      const fri = new Date(sun)
      fri.setDate(fri.getDate() + 5)
      fri.setHours(0, 0, 0, 0)
      return fri.getTime()
    }

    const projectIndex = new Map<
      string,
      { name: string; hourly_rate: number; payment_type: 'manual' | 'upwork' }
    >()
    for (const p of (projects || []) as any[]) {
      projectIndex.set(p.id, {
        name: p.name,
        hourly_rate: Number(p.hourly_rate || 0),
        payment_type: (p.payment_type as 'manual' | 'upwork') || 'manual',
      })
    }

    const todayStart = startOfDayMs(new Date())
    // End of current month, exclusive — anything paid on or after this
    // date doesn't count toward the "Remaining Month" forecast.
    const endOfMonthMs = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      1
    ).getTime()
    interface Row {
      sortKey: number
      dateLabel: string
      label: string
      amount: number
    }
    const projectBuckets = new Map<string, Row>() // key: paymentMs|projectId
    const possibleBuckets = new Map<number, Row>() // key: weekStartMs

    const addProject = (paymentMs: number, projectId: string, hours: number) => {
      const proj = projectIndex.get(projectId)
      if (!proj || proj.hourly_rate <= 0 || hours <= 0) return
      if (paymentMs < todayStart || paymentMs >= endOfMonthMs) return
      const amount = hours * proj.hourly_rate
      const key = `${paymentMs}|${projectId}`
      const existing = projectBuckets.get(key)
      if (existing) {
        existing.amount += amount
        return
      }
      projectBuckets.set(key, {
        sortKey: paymentMs,
        dateLabel: format(new Date(paymentMs), 'EEE M/d'),
        label: proj.name,
        amount,
      })
    }

    // Past project_activity awaiting payment.
    for (const a of (projectActivity || []) as any[]) {
      const proj = projectIndex.get(a.project_id)
      if (!proj) continue
      const s = new Date(a.start_time).getTime()
      const e = new Date(a.end_time).getTime()
      if (e <= s) continue
      const hours = (e - s) / (1000 * 60 * 60)
      const paymentMs =
        proj.payment_type === 'upwork' ? upworkPaymentDateMs(s) : startOfDayMs(new Date(s))
      addProject(paymentMs, a.project_id, hours)
    }

    // Forecast: all billable_hours. We don't pre-filter past blocks
    // here — addProject's paymentMs guard drops past payouts and the
    // weekEnd check below keeps a partially-past week's bucket alive.
    const defaultRate = 100
    for (const block of billableHours) {
      const s = new Date(block.start_time).getTime()
      const e = new Date(block.end_time).getTime()
      if (e <= s) continue
      const hours = (e - s) / (1000 * 60 * 60)
      const assignment = billableProjectMap.get(block.id)
      if (assignment) {
        const proj = projectIndex.get(assignment.id)
        if (!proj) continue
        const paymentMs =
          proj.payment_type === 'upwork' ? upworkPaymentDateMs(s) : startOfDayMs(new Date(s))
        addProject(paymentMs, assignment.id, hours)
      } else {
        // Unassigned → Possible Pay weekly bucket at the block's rate
        // (falls back to default flat rate when row is rate-less).
        const rate = Number(block.rate || defaultRate)
        const week = startOfWeekMs(new Date(s))
        // Sat of week = Sun + 6 days, end of day. Include the bucket
        // when Saturday hasn't passed yet so partially-past weeks
        // (e.g., today is Mon, blocks scheduled later in the same
        // week) still show.
        const weekEnd = week + 7 * 24 * 60 * 60 * 1000 - 1
        if (weekEnd < todayStart || week >= endOfMonthMs) continue
        const existing = possibleBuckets.get(week)
        const amount = hours * rate
        if (existing) {
          existing.amount += amount
        } else {
          const sun = new Date(week)
          const sat = new Date(week + 6 * 24 * 60 * 60 * 1000)
          possibleBuckets.set(week, {
            sortKey: week,
            dateLabel: `Possible: ${format(sun, 'M/d')}-${format(sat, 'M/d')}`,
            label: 'Possible Pay',
            amount,
          })
        }
      }
    }

    return [
      ...projectBuckets.values(),
      ...possibleBuckets.values(),
    ].sort((a, b) => a.sortKey - b.sortKey)
  }, [billableHours, billableProjectMap, projects, projectActivity])

  const remainingMonthTotal = useMemo(
    () => upcomingPayments.reduce((sum, r) => sum + r.amount, 0),
    [upcomingPayments]
  )

  // Past-payment retrospectives shown under the dashed line in the
  // tooltip: amount paid in the last 7 days, and the 7-day window
  // before that (day −14 through day −7). Each project_activity row's
  // payment_date is computed the same way as the forecast above
  // (manual = same day, upwork = Friday after the next Sunday-8pm
  // cutoff).
  const pastPayWindows = useMemo(() => {
    const startOfDay = (d: Date): number => {
      const out = new Date(d)
      out.setHours(0, 0, 0, 0)
      return out.getTime()
    }
    const upworkPaymentDateMs = (t: number): number => {
      const T = new Date(t)
      const sun = new Date(T)
      const daysUntilSun = (7 - sun.getDay()) % 7
      sun.setDate(sun.getDate() + daysUntilSun)
      sun.setHours(20, 0, 0, 0)
      if (sun.getTime() < t) sun.setDate(sun.getDate() + 7)
      const fri = new Date(sun)
      fri.setDate(fri.getDate() + 5)
      fri.setHours(0, 0, 0, 0)
      return fri.getTime()
    }
    const todayStart = startOfDay(new Date())
    const sevenDaysAgo = todayStart - 7 * 24 * 60 * 60 * 1000
    const fourteenDaysAgo = todayStart - 14 * 24 * 60 * 60 * 1000

    const projectIndex = new Map<
      string,
      { hourly_rate: number; payment_type: 'manual' | 'upwork' }
    >()
    for (const p of (projects || []) as any[]) {
      projectIndex.set(p.id, {
        hourly_rate: Number(p.hourly_rate || 0),
        payment_type: (p.payment_type as 'manual' | 'upwork') || 'manual',
      })
    }

    let last7 = 0
    let prev7 = 0
    for (const a of (projectActivity || []) as any[]) {
      const proj = projectIndex.get(a.project_id)
      if (!proj || proj.hourly_rate <= 0) continue
      const s = new Date(a.start_time).getTime()
      const e = new Date(a.end_time).getTime()
      if (e <= s) continue
      const hours = (e - s) / (1000 * 60 * 60)
      const paymentMs =
        proj.payment_type === 'upwork'
          ? upworkPaymentDateMs(s)
          : startOfDay(new Date(s))
      const amount = hours * proj.hourly_rate
      if (paymentMs >= sevenDaysAgo && paymentMs < todayStart) last7 += amount
      else if (paymentMs >= fourteenDaysAgo && paymentMs < sevenDaysAgo)
        prev7 += amount
    }
    return { last7, prev7 }
  }, [projects, projectActivity])

  // Index billable hours by date-hour key for the per-slot render.
  const billableHoursIndex = useMemo(() => {
    const index = new Map<string, any[]>()
    billableHours.forEach(block => {
      const start = new Date(block.start_time)
      const dateStr = format(start, 'yyyy-MM-dd')
      const key = `${dateStr}-${start.getHours()}`
      const arr = index.get(key) || []
      const projectInfo = billableProjectMap.get(block.id)
      arr.push(
        projectInfo
          ? { ...block, _projectName: projectInfo.name, _projectColor: projectInfo.color }
          : block
      )
      index.set(key, arr)
    })
    return index
  }, [billableHours, billableProjectMap])

  const getBillableHoursForTimeSlot = useCallback(
    (timeSlot: string, date: Date) => {
      const key = `${format(date, 'yyyy-MM-dd')}-${parseInt(timeSlot.split(':')[0], 10)}`
      return billableHoursIndex.get(key) || []
    },
    [billableHoursIndex]
  )

  // Render all calendar events for a time slot
  const renderCalendarEvents = useCallback(
    (timeSlot: string, date: Date) => {
      if (isDataLoading) return null

      const dateStr = format(date, 'yyyy-MM-dd')
      const today = format(new Date(), 'yyyy-MM-dd')
      const isToday = dateStr === today
      const isFuture = dateStr > today
      const isPast = dateStr < today

      const habitsInSlot = getHabitsForTimeSlot(timeSlot, date)
      const sessionsInSlot = getSessionsForTimeSlot(timeSlot, date)
      const meetingsInSlot = getMeetingsForTimeSlot(timeSlot, date)
      const buffersInSlot = getBuffersForCalendarTimeSlot(timeSlot, date)
      const categoryBuffersInSlot = getCategoryBuffersForTimeSlot(timeSlot, date)
      const projectActivityInSlot = getProjectActivityForTimeSlot(timeSlot, date)
      const billableHoursInSlot = getBillableHoursForTimeSlot(timeSlot, date)
      // Tasks render from tasks_daily_logs (single source of truth)
      const tasksInSlot: any[] = []
      const tasksDailyLogsInSlot = getTasksDailyLogsForTimeSlot(timeSlot, date)

      const baseItemHeight = 32 // Base height for calculating offsets

      return (
        <CalendarEventSlots
          habitsInSlot={habitsInSlot}
          sessionsInSlot={sessionsInSlot}
          meetingsInSlot={meetingsInSlot}
          buffersInSlot={buffersInSlot}
          tasksInSlot={tasksInSlot}
          tasksDailyLogsInSlot={tasksDailyLogsInSlot}
          categoryBuffersInSlot={categoryBuffersInSlot}
          projectActivityInSlot={projectActivityInSlot}
          billableHoursInSlot={billableHoursInSlot}
          timeSlot={timeSlot}
          date={date}
          dateStr={dateStr}
          baseItemHeight={baseItemHeight}
          hourHeight={hourHeight}
          handleHabitClick={handleHabitClick}
          handleSessionClick={handleSessionClick}
          handleTaskClick={handleTaskClick}
          handleEditMeeting={handleEditMeeting}
          handleProjectActivityClick={handleProjectActivityClick}
          onProjectActivityResizeStart={handleProjectActivityResizeStart}
          onBillableHourResizeStart={handleBillableHourResizeStart}
          onMeetingResizeStart={handleMeetingResizeStart}
          onMeetingDragStart={handleMeetingDragStart}
          draggingMeetingId={draggingMeeting?.id}
          meetingDragY={meetingDragY}
          onTaskLogDragStart={handleTaskLogDragStart}
          draggingTaskLogId={draggingTaskLog?.id}
          taskLogDragY={taskLogDragY}
          onHabitDragStart={handleHabitDragStart}
          onHabitResizeStart={handleHabitResizeStart}
          draggingHabitId={draggingHabit?.id}
          draggingHabitDateStr={draggingHabitDate ? format(draggingHabitDate, 'yyyy-MM-dd') : null}
          habitDragY={habitDragY}
        />
      )
    },
    [
      getHabitsForTimeSlot,
      getSessionsForTimeSlot,
      getMeetingsForTimeSlot,
      getTasksForTimeSlot,
      getTasksDailyLogsForTimeSlot,
      getBuffersForCalendarTimeSlot,
      getCategoryBuffersForTimeSlot,
      getProjectActivityForTimeSlot,
      getBillableHoursForTimeSlot,
      isDataLoading,
      tasksScheduled,
      handleHabitClick,
      handleSessionClick,
      handleTaskClick,
      handleEditMeeting,
      handleProjectActivityClick,
      handleProjectActivityResizeStart,
      handleBillableHourResizeStart,
      handleTaskLogDragStart,
      draggingTaskLog,
      taskLogDragY,
      handleHabitDragStart,
      handleHabitResizeStart,
      draggingHabit,
      habitDragY,
      hourHeight,
    ]
  )

  // Pre-index habit notes by date-hour for note badges (only timed notes land
  // on the grid — day-level notes with start_time=null surface via the mobile
  // badge in CalendarTopBar instead).
  const noteBadgesIndex = useMemo(() => {
    const index = new Map<string, any[]>()
    habitNotes.forEach((note: any) => {
      if (!note.start_time) return
      const dateStr = note.start_date || (note.created_at ? note.created_at.slice(0, 10) : '')
      if (!dateStr) return
      const [h, m] = note.start_time.split(':').map(Number)
      const key = `${dateStr}-${h}`
      const arr = index.get(key) || []
      arr.push({ ...note, minuteInHour: m })
      index.set(key, arr)
    })
    return index
  }, [habitNotes])

  // Mobile day-note badge: the first whole-day note (start_time IS NULL) for
  // the day currently displayed in the mobile top bar.
  const mobileDayNoteDateStr = useMemo(
    () => dayColumns[0]?.dateStr || format(baseDate, 'yyyy-MM-dd'),
    [dayColumns, baseDate]
  )
  const mobileDayNote = useMemo(
    () =>
      habitNotes.find(
        (n: any) => n.start_date === mobileDayNoteDateStr && !n.start_time
      ) || null,
    [habitNotes, mobileDayNoteDateStr]
  )
  const mobileDayNotePreview = useMemo(() => {
    if (!mobileDayNote) return null
    const trimmed = (mobileDayNote.content || '').trim()
    if (!trimmed) return null
    return trimmed.slice(0, 120)
  }, [mobileDayNote])

  const openMobileDayNote = useCallback(() => {
    if (mobileDayNote) {
      setViewingNote(mobileDayNote)
      return
    }
    setViewingNote({
      id: null,
      title: '',
      content: '',
      start_date: mobileDayNoteDateStr,
      start_time: null,
      created_at: new Date().toISOString(),
      _isNew: true,
    })
  }, [mobileDayNote, mobileDayNoteDateStr])

  const renderNoteBadges = useCallback(
    (timeSlot: string, date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd')
      const hour = parseInt(timeSlot.split(':')[0])
      const key = `${dateStr}-${hour}`
      const notes = noteBadgesIndex.get(key)
      if (!notes || notes.length === 0) return null

      return notes.map((note: any) => {
        const topPercent = (note.minuteInHour / 60) * 100
        return (
          <div
            key={`note-badge-${note.id}`}
            className="absolute left-0 z-30 cursor-pointer"
            style={{ top: `${topPercent}%` }}
            onClick={e => {
              e.stopPropagation()
              setViewingNote(note)
            }}
            title={note.title || note.content?.slice(0, 50)}
          >
            <div className="w-[20px] h-[20px] p-[2px] bg-amber-400 hover:bg-amber-300 rounded-full flex items-center justify-center shadow-sm border border-amber-500 -translate-x-1/2">
              <FileText className="w-full h-full text-amber-900" />
            </div>
          </div>
        )
      })
    },
    [noteBadgesIndex]
  )

  // Set the handlers for the modal provider
  useEffect(() => {
    handlersRef.current = {
      saveMeeting: handleSaveMeeting,
      deleteMeeting: handleDeleteMeeting,
      saveProjectActivity: async (activity: { project_id: string; start_time: string; end_time: string; note?: string }) => {
        await addProjectActivity(activity)
      },
      deleteProjectActivity: async (id: string) => {
        await deleteProjectActivity(id)
      },
      habitTimeChange: handleHabitTimeChangeWithReset,
      habitSkip: handleHabitSkipWithReset,
      habitArchive: markHabitArchived,
      unarchiveHabit,
      removeTask: removeTaskFromCalendar,
      removeTaskLog: removeTaskLogFromUI,
      updateMeetingEndTime: async (meetingId: string, newEndTime: string) => {
        await updateMeeting(meetingId, { end_time: newEndTime })
      },
      addHabitBlock,
      linkMeetingHabit,
      createHabit: async (habitData: any) => {
        const created = await createHabit(habitData)
        if (created) addHabit(created)
      },
      syncTodoist,
      syncClickUp,
      addNote: () => {
        if (modalTimeSlot) {
          const [hour, minute] = modalTimeSlot.time.split(':').map(Number)
          const dateStr = format(modalTimeSlot.date, 'yyyy-MM-dd')
          const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
          setViewingNote({
            id: null,
            title: '',
            content: '',
            start_date: dateStr,
            start_time: timeStr,
            created_at: new Date().toISOString(),
            _isNew: true,
          })
        }
      },
    }
  }, [handleSaveMeeting, handleDeleteMeeting, modalTimeSlot])

  // Stable closures that dispatch through handlersRef.current. We register
  // them once with the site-wide ModalProvider — handlers can be updated via
  // the ref without re-registering, which keeps MeetingModal etc. from
  // remounting on every render.
  const modalHandlers = useMemo<CalendarModalHandlers>(() => ({
    onSaveMeeting: async (e, updatedMeeting, editingMeeting) => {
      await handlersRef.current.saveMeeting?.(e, updatedMeeting, editingMeeting)
    },
    onDeleteMeeting: async meeting => {
      await handlersRef.current.deleteMeeting?.(meeting)
    },
    onSaveProjectActivity: async activity => {
      await handlersRef.current.saveProjectActivity?.(activity)
    },
    onDeleteProjectActivity: async id => {
      await handlersRef.current.deleteProjectActivity?.(id)
    },
    onCompleteTask: async task => {
      // Fast path: flip is_complete, wipe daily logs, remove from UI.
      const result = await handleCompleteTask(task)
      if (!result) return
      handlersRef.current.removeTask?.(result.taskId)

      // Slow path: close the task upstream and regenerate the source's
      // schedule in the background so the modal doesn't block on network.
      // The freed slot will fill in once the regen lands.
      const closeTaskUpstreamInBackground = async () => {
        try {
          if (result.source === 'todoist' && result.todoistTaskId) {
            // Fire-and-forget the upstream close in parallel with the
            // local regen — the task is already is_complete=true in DB,
            // so we just need to reshuffle the schedule.
            await Promise.all([
              supabase.functions.invoke('todoist', {
                body: { action: 'complete', taskId: result.todoistTaskId },
              }),
              handlersRef.current.syncTodoist?.({ skipApi: true }),
            ])
          } else if (result.source === 'clickup' && result.clickupTaskId) {
            await Promise.all([
              supabase.functions.invoke('clickup', {
                body: { action: 'complete', taskId: result.clickupTaskId },
              }),
              handlersRef.current.syncClickUp?.({ skipApi: true }),
            ])
          }
        } catch (err) {
          console.error('Error in background task-complete chain:', err)
        }
      }
      void closeTaskUpstreamInBackground()
    },
    onDeleteTask: async task => {
      const deletedId = await handleDeleteTask(task)
      if (deletedId) handlersRef.current.removeTask?.(deletedId)
    },
    onUpdateTask: async (task, changes) => {
      const taskId: string = task?.id
      if (!taskId) return
      // 1. Local DB write-through so the UI reflects the change instantly.
      const patch: Record<string, any> = {}
      if (changes.dueDate !== undefined) patch.due_date = changes.dueDate
      if (typeof changes.durationMinutes === 'number') {
        patch.estimated_hours = changes.durationMinutes / 60
      }
      if (Object.keys(patch).length > 0) {
        await supabase.from('cassian_tasks').update(patch).eq('id', taskId)
      }
      // 2. Regen the schedule locally so the new duration / due date
      //    reshapes placement immediately.
      if (task?.source === 'todoist') {
        await handlersRef.current.syncTodoist?.({ skipApi: true })
      } else if (task?.source === 'clickup') {
        await handlersRef.current.syncClickUp?.({ skipApi: true })
      }
      // 3. Push the edit upstream so the next full sync doesn't overwrite
      //    it from the external API. Fire-and-forget — the modal has
      //    already shown "Saved" by now.
      const pushTaskEditUpstream = async () => {
        try {
          if (task?.source === 'todoist' && task?.todoist_task_id) {
            await supabase.functions.invoke('todoist', {
              body: {
                action: 'update',
                taskId: task.todoist_task_id,
                dueDate: changes.dueDate,
                durationMinutes: changes.durationMinutes,
              },
            })
          } else if (task?.source === 'clickup' && task?.clickup_task_id) {
            await supabase.functions.invoke('clickup', {
              body: {
                action: 'update',
                taskId: task.clickup_task_id,
                dueDate: changes.dueDate,
                durationMinutes: changes.durationMinutes,
              },
            })
          }
        } catch (err) {
          console.error('Error pushing task edit upstream:', err)
        }
      }
      void pushTaskEditUpstream()
    },
    onHabitTimeChange: async (habitId, date, newTime, newDuration) => {
      await handlersRef.current.habitTimeChange?.(habitId, date, newTime, newDuration)
    },
    onHabitSkip: async (habitId, date) => {
      await handlersRef.current.habitSkip?.(habitId, date)
    },
    onHabitArchive: async habitId => {
      handlersRef.current.habitArchive?.(habitId)
    },
    onUnarchiveHabit: async (habitId, updates) => {
      await handlersRef.current.unarchiveHabit?.(habitId, updates)
    },
    onUpdateSession: async () => {},
    onTaskLogCreated: () => { window.location.reload() },
    onUpdateMeetingEndTime: async (meetingId, newEndTime) => {
      await handlersRef.current.updateMeetingEndTime?.(meetingId, newEndTime)
    },
    onDeleteTaskLog: async logId => {
      await supabase.from('cassian_tasks_daily_logs').delete().eq('id', logId)
    },
    onRemoveTaskLogFromUI: logId => {
      handlersRef.current.removeTaskLog?.(logId)
    },
    onAddHabitBlock: (habitId, date, startTime, duration) => {
      handlersRef.current.addHabitBlock?.(habitId, date, startTime, duration)
    },
    onMeetingHabitLinked: (meetingId, habitId) => {
      handlersRef.current.linkMeetingHabit?.(meetingId, habitId)
    },
    onAddNote: () => {
      handlersRef.current.addNote?.()
    },
    onCreateHabit: async habitData => {
      await handlersRef.current.createHabit?.(habitData)
    },
  }), [])

  useEffect(() => {
    registerModalHandlers(modalHandlers)
    // Clear when the Calendar page unmounts so non-calendar pages don't
    // accidentally dispatch through stale closures.
    return () => registerModalHandlers({})
  }, [modalHandlers, registerModalHandlers])

  useEffect(() => {
    setCalendarModalData({ meetingTitles, meetingCategories, habits: calendarHabits, archivedHabits, projects, projectActivity })
  }, [meetingTitles, meetingCategories, calendarHabits, archivedHabits, projects, projectActivity, setCalendarModalData])

  // Compute the habit-drag-preview shadow position from the original
  // start time + the live drag delta. Recomputes only while a habit drag
  // is active; otherwise stays null.
  const habitDragPreview = useMemo(() => {
    if (!draggingHabit || !draggingHabitDate) return null
    const dateStr = format(draggingHabitDate, 'yyyy-MM-dd')
    const colIdx = dayColumns.findIndex(c => c.dateStr === dateStr)
    if (colIdx === -1) return null
    const durationMin = draggingHabit.duration || 60
    const heightPx = (durationMin / 60) * hourHeight
    const [origH, origM] = habitOriginalStartRef.current.split(':').map(Number)
    const deltaMin = deltaYToMinutes(habitDragY)
    const totalMin = origH * 60 + origM + deltaMin
    const newH = Math.max(0, Math.floor(totalMin / 60))
    const hourIndex = hourToGridIndex(newH)
    const minuteFrac = (totalMin % 60) / 60
    const topPx = (hourIndex + minuteFrac) * hourHeight
    return { columnIndex: colIdx, topPx, heightPx }
  }, [draggingHabit, draggingHabitDate, habitDragY, hourHeight, dayColumns])

  return (
    <div className="flex flex-col bg-white md:h-screen md:overflow-hidden">
      {/* CSS for drag animation */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
        `}
      </style>
      {/* Fixed on mobile (position:sticky is unreliable on iOS Safari after a
          programmatic window.scrollTo); static on desktop. */}
      <div ref={stickyHeaderRef} className="fixed top-0 left-0 right-0 z-20 bg-white md:static">
      {/* Calendar Setup Banner - shown when calendar is sparse */}
      {!isDataLoading && meetings.length < 10 && habits.length < 3 && allTasks.length < 2 && (
        <div className="-mx-2 mb-2 px-4 py-2 bg-amber-50 border-b border-amber-100 sm:mx-0 sm:mb-0 sm:px-4 sm:py-3 sm:bg-amber-50 sm:border sm:border-amber-100 sm:rounded-lg sm:mx-0 sm:mt-0">
          <div className="flex items-start gap-2 sm:gap-3">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-600" />
            <p className="text-sm text-amber-700 leading-tight sm:leading-relaxed">
              Your calendar looks empty! Visit the{' '}
              <a href="/habits" className="font-medium underline hover:text-amber-800">
                Habits
              </a>
              ,{' '}
              <a href="/projects" className="font-medium underline hover:text-amber-800">
                Projects
              </a>
              , or use the <span className="font-medium">+ button</span> above to add meetings and
              fill out your schedule.
            </p>
          </div>
        </div>
      )}
      <CalendarTopBar
        settings={settings}
        showWorkHoursTooltip={showWorkHoursTooltip}
        setShowWorkHoursTooltip={setShowWorkHoursTooltip}
        restOfMonthHours={billableStats.restOfMonthHours}
        remainingMonthTotal={remainingMonthTotal}
        upcomingPayments={upcomingPayments}
        navigateBackWeek={navigateBackWeek}
        navigateBackDay={navigateBackDay}
        navigateToToday={navigateToToday}
        navigateForwardDay={navigateForwardDay}
        navigateForwardWeek={navigateForwardWeek}
        showCalendarSettings={showCalendarSettings}
        setShowCalendarSettings={setShowCalendarSettings}
        onSyncGoogleCalendar={syncGoogleCalendar}
        onToggleMobileMenu={() => setMobileMenuOpen(true)}
        onAddMeeting={handleAddMeeting}
        mobileDayLabel={dayColumns[0]?.label}
        mobileDayNotePreview={mobileDayNotePreview}
        // Suppress the "Add note" affordance until the notes fetch resolves,
        // otherwise the empty-state label flashes briefly before an existing
        // day note is rendered as the banner below.
        onOpenMobileDayNote={isDataLoading ? undefined : openMobileDayNote}
        hourHeight={hourHeight}
        setHourHeight={setHourHeight}
        dayColumnCount={dayColumnCount}
        setDayColumnCount={setDayColumnCount}
        archivedHabits={archivedHabits}
      />

      {/* Mobile day-note banner — full-width preview of the current day's
          whole-day note. Tap to edit. */}
      {mobileDayNotePreview && (
        <button
          onClick={openMobileDayNote}
          className="md:hidden w-full text-left px-3 py-1.5 bg-amber-50 border-b border-amber-100 text-sm text-neutral-700 truncate hover:bg-amber-100 transition-colors"
          title="Edit day note"
        >
          {mobileDayNotePreview}
        </button>
      )}

      {/* Headers - hidden on mobile since date + add moved to top bar */}
      <div
        className="hidden md:grid border-b border-neutral-200 min-w-0"
        style={{ gridTemplateColumns: gridCols }}
      >
        <div className="bg-neutral-100 border-r border-neutral-200 flex items-center justify-center py-0.5 gap-1">
          <button
            className="p-0.5 hover:bg-neutral-200 rounded transition-colors"
            title="Add meeting"
            onClick={handleAddMeeting}
          >
            <Plus className="w-3 h-3 text-neutral-600" />
          </button>
          {(settings?.todoist_api_key || settings?.clickup_api_key) && (
            <button
              className="hidden sm:block p-0.5 hover:bg-neutral-200 rounded transition-colors"
              title="Sync Todoist & ClickUp"
              disabled={isSyncingTodoist}
              onClick={async () => {
                setIsSyncingTodoist(true)
                try {
                  await Promise.all([
                    settings?.todoist_api_key ? syncTodoist() : Promise.resolve(),
                    settings?.clickup_api_key ? syncClickUp() : Promise.resolve(),
                  ])
                } finally {
                  setIsSyncingTodoist(false)
                }
              }}
            >
              <RefreshCw className={`w-3 h-3 text-neutral-600 ${isSyncingTodoist ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
        {dayColumns.map((column, columnIndex) => (
          <div
            key={columnIndex}
            className="py-1 px-1.5 sm:py-0.5 sm:px-1 bg-neutral-50 border-r border-neutral-200 last:border-r-0 min-w-0 flex items-center justify-between gap-1"
          >
            <h2 className="text-base sm:text-sm font-medium text-neutral-900 truncate text-center sm:text-left">
              {column.label}
            </h2>
            <BillableStatsBadge
              dayLabel={column.label}
              dayIncome={billableIncomeStats.incomeForDay(column.dateStr)}
              next7DaysIncome={billableIncomeStats.next7DaysIncome}
              restOfMonthIncome={billableIncomeStats.restOfMonthIncome}
              last7DaysPaid={pastPayWindows.last7}
              prev7DaysPaid={pastPayWindows.prev7}
            />
          </div>
        ))}
      </div>
      </div>{/* end fixed header */}

      {/* Mobile spacer — reserves the space the position:fixed header would
          otherwise overlap. Height tracks the measured header height. */}
      <div
        className="md:hidden"
        style={{ height: mobileHeaderHeight }}
        aria-hidden
      />

      {/* Calendar Grid */}
      <CalendarGrid
        containerRef={containerRef}
        hourSlots={hourSlots}
        gridCols={gridCols}
        dayColumns={dayColumns}
        renderCalendarEvents={renderCalendarEvents}
        renderNoteBadges={renderNoteBadges}
        onAddNoteClick={(timeSlot, date) => {
          const [hour, minute] = timeSlot.split(':').map(Number)
          const dateStr = format(date, 'yyyy-MM-dd')
          const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
          // Create a temporary note — only saved to DB when content is added
          setViewingNote({
            id: null,
            title: '',
            content: '',
            start_date: dateStr,
            start_time: timeStr,
            created_at: new Date().toISOString(),
            _isNew: true,
          })
        }}
        handleTimeSlotClick={handleTimeSlotClick}
        handleTimeSlotContextMenu={handleTimeSlotContextMenu}
        handleMouseDown={handleMouseDown}
        handleMouseEnter={handleMouseEnter}
        handleMouseMove={handleMouseMove}
        handleMouseUp={handleMouseUp}
        isDragging={isDragging}
        dragStart={dragStart}
        dragEnd={dragEnd}
        isInDragSelection={isInDragSelection}
        getCurrentTimeLinePosition={getCurrentTimeLinePosition}
        habitDragPreview={habitDragPreview}
        hourHeight={hourHeight}
      />

      {/* Note View Modal */}
      <NoteModal
        note={viewingNote}
        isOpen={!!viewingNote}
        onClose={() => setViewingNote(null)}
        onUpdate={(updatedNote) => {
          setHabitNotes(prev => {
            const exists = prev.some(n => n.id === updatedNote.id)
            if (exists) return prev.map(n => n.id === updatedNote.id ? { ...n, ...updatedNote } : n)
            return [updatedNote, ...prev]
          })
          setViewingNote((prev: any) => prev ? { ...prev, ...updatedNote } : prev)
        }}
        onDelete={async (noteId) => {
          await supabase.from('cassian_notes').delete().eq('id', noteId)
          setHabitNotes(prev => prev.filter(n => n.id !== noteId))
          setViewingNote(null)
        }}
      />

      {/* Conflict toast — shown when a manual billable-hour drop or
          resize was rejected by the hook's overlap guard. The block
          itself snapped back because local state was never updated. */}
      {conflictToast && (
        <div
          role="alert"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 bg-red-600 text-white rounded-md shadow-lg text-xs flex items-center gap-1.5"
        >
          <span>{conflictToast}</span>
          <button
            type="button"
            onClick={() => setConflictToast(null)}
            aria-label="Dismiss"
            className="hover:opacity-80"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}

export default memo(CalendarContent)
