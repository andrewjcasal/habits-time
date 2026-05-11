import React from 'react'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Info,
  Plus,
  Sun,
  Settings,
  Menu,
  Minimize2,
  Maximize2,
} from 'lucide-react'
import CalendarSettingsPanel from './CalendarSettingsPanel'
import { useModal } from '../contexts/useModal'

interface CalendarTopBarProps {
  settings: any
  showWorkHoursTooltip: boolean
  setShowWorkHoursTooltip: (show: boolean) => void
  navigateBackWeek: () => void
  navigateBackDay: () => void
  navigateToToday: () => void
  navigateForwardDay: () => void
  navigateForwardWeek: () => void
  showCalendarSettings: boolean
  setShowCalendarSettings: (show: boolean) => void
  onSyncGoogleCalendar: () => void
  onToggleMobileMenu?: () => void
  onAddMeeting?: () => void
  mobileDayLabel?: string
  mobileDayNotePreview?: string | null
  onOpenMobileDayNote?: () => void
  hourHeight?: number
  setHourHeight?: (height: number) => void
  dayColumnCount?: number
  setDayColumnCount?: (count: number) => void
  archivedHabits?: { id: string; name: string }[]
  /** Default rate per upcoming billable hour, used to render the
   *  dollar amount alongside the Remaining Month hours stat. */
  upcomingBillableRate?: number
  /** Hours of upcoming billable_hours through end of current month. */
  restOfMonthHours?: number
  /** Sum of upcoming-payment rows that arrive within the current
   *  month, computed at each project's real rate. Headlined alongside
   *  the hours figure so the headline matches the tooltip Total. */
  remainingMonthTotal?: number
  /** Forecast payment rows shown in the Remaining Month tooltip.
   *  Each row is one (date × project) or (week × "Possible Pay")
   *  bucket, sorted ascending by date. */
  upcomingPayments?: Array<{ dateLabel: string; label: string; amount: number }>
}

export default function CalendarTopBar({
  settings,
  showWorkHoursTooltip,
  setShowWorkHoursTooltip,
  navigateBackWeek,
  navigateBackDay,
  navigateToToday,
  navigateForwardDay,
  navigateForwardWeek,
  showCalendarSettings,
  setShowCalendarSettings,
  onSyncGoogleCalendar,
  onToggleMobileMenu,
  onAddMeeting,
  mobileDayLabel,
  mobileDayNotePreview,
  onOpenMobileDayNote,
  hourHeight = 64,
  setHourHeight,
  dayColumnCount = 7,
  setDayColumnCount,
  archivedHabits = [],
  upcomingBillableRate: _upcomingBillableRate = 100,
  restOfMonthHours = 0,
  remainingMonthTotal = 0,
  upcomingPayments = [],
}: CalendarTopBarProps) {
  const { openNeedHelpModal } = useModal()
  const showBar = settings ? (settings.metadata?.showWorkHoursBar ?? true) : false
  const [showRemainingTooltip, setShowRemainingTooltip] = React.useState(false)

  return (
    // Top Bar with Navigation and Work Hours
    <div className="bg-neutral-100 border-b border-neutral-200 px-2 py-0.5 sm:px-0">
    {/* Navigation, Work Hours Label, and Planned/Actual all on one line */}
    <div className="flex items-center justify-between sm:px-2">
      {/* Left side: Navigation Controls */}
      <div className="flex items-center">
        {onAddMeeting && (
          <button
            onClick={onAddMeeting}
            className="md:hidden hover:bg-neutral-200 rounded transition-colors mr-1"
            title="Add meeting"
          >
            <Plus className="w-4 h-4 text-neutral-600" />
          </button>
        )}
        <button
          onClick={navigateBackWeek}
          className="hidden sm:block hover:bg-neutral-200 rounded transition-colors"
          title="Go back 7 days"
        >
          <ChevronsLeft className="w-3 h-3 text-neutral-600" />
        </button>
        <button
          onClick={navigateBackDay}
          className="hover:bg-neutral-200 rounded transition-colors"
          title="Go back 1 day"
        >
          <ChevronLeft className="w-4 h-4 sm:w-3 sm:h-3 text-neutral-600" />
        </button>
        {mobileDayLabel && (
          <button
            onClick={navigateToToday}
            className="md:hidden hover:bg-neutral-200 rounded transition-colors mx-1 text-sm font-medium text-neutral-700"
            title="Go to today"
          >
            {mobileDayLabel}
          </button>
        )}
        <button
          onClick={navigateToToday}
          className="hidden md:block hover:bg-neutral-200 rounded transition-colors mx-1"
          title="Go to today"
        >
          <Sun className="w-3 h-3 text-yellow-600" />
        </button>
        <button
          onClick={navigateForwardDay}
          className="hover:bg-neutral-200 rounded transition-colors"
          title="Go forward 1 day"
        >
          <ChevronRight className="w-4 h-4 sm:w-3 sm:h-3 text-neutral-600" />
        </button>
        <button
          onClick={navigateForwardWeek}
          className="hidden sm:block hover:bg-neutral-200 rounded transition-colors"
          title="Go forward 7 days"
        >
          <ChevronsRight className="w-3 h-3 text-neutral-600" />
        </button>

        {/* Mobile "add note" affordance — shown only when no day note exists.
            When a day note is present it renders as a full-width banner below
            the top bar (see Calendar.tsx). */}
        {onOpenMobileDayNote && !mobileDayNotePreview && (
          <button
            onClick={onOpenMobileDayNote}
            className="md:hidden ml-1 flex-1 min-w-0 text-left text-sm hover:bg-neutral-200 rounded px-1.5 py-0.5 transition-colors truncate"
            title="Add note for this day"
          >
            <span className="italic text-neutral-400">Add note</span>
          </button>
        )}

        {/* Work-schedule info icon — kept (the label "Work Hours" was
            removed alongside the planned/actual stats). Toggles a
            tooltip with the user's daily window + week-ending day. */}
        {showBar && (
          <div className="hidden sm:block text-sm text-neutral-700 ml-2 work-hours-tooltip relative">
            {settings ? (
              <div className="flex items-center">
                <button
                  onClick={() => setShowWorkHoursTooltip(!showWorkHoursTooltip)}
                  className="hover:bg-neutral-200 rounded p-0.5 transition-colors"
                  title="Work hours details"
                  aria-label="Work hours details"
                >
                  <Info className="w-2 h-2 text-neutral-500" />
                </button>
                {showWorkHoursTooltip && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg p-3 text-xs whitespace-nowrap z-50">
                    <div className="font-medium mb-1">Work Schedule:</div>
                    <div>
                      Daily: {settings.work_hours_start} - {settings.work_hours_end}
                    </div>
                    <div>
                      Week ends:{' '}
                      {settings.week_ending_day?.charAt(0).toUpperCase() +
                        settings.week_ending_day?.slice(1)}{' '}
                      {new Date(
                        `1970-01-01T${settings.week_ending_time || '20:30'}`
                      ).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </div>
                    <div>
                      Timezone: {settings.week_ending_timezone?.split('/')[1]?.replace('_', ' ')}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-neutral-400">Loading…</span>
            )}
          </div>
        )}
      </div>

      {/* Right side: billable-hours summary stats. "Bill 7d" is the
          sum of upcoming cassian_billable_hours durations × the flat
          rate; "Billed 7d" is duration only (past project_activity
          rows fold in via the hook but don't carry rates). */}
      {showBar && (
        <div className="hidden sm:flex items-center gap-3 text-sm">
          <div
            className="relative"
            onMouseEnter={() => setShowRemainingTooltip(true)}
            onMouseLeave={() => setShowRemainingTooltip(false)}
          >
            <span className="text-neutral-600">Remaining Month:</span>
            <span className="font-medium text-neutral-900 ml-1">
              {restOfMonthHours.toFixed(2)}h (${remainingMonthTotal.toFixed(0)})
            </span>
            {showRemainingTooltip && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg p-2 text-xs whitespace-nowrap z-50 min-w-[180px]">
                {upcomingPayments.length === 0 ? (
                  <div className="text-neutral-500">No upcoming payments</div>
                ) : (
                  <>
                    {upcomingPayments.map((row, i) => (
                      <div key={i} className="flex justify-between gap-3">
                        <span className="text-neutral-600">
                          {row.dateLabel}{row.label !== 'Possible Pay' ? ` (${row.label})` : ''}:
                        </span>
                        <span className="font-medium text-neutral-900">
                          ${row.amount.toFixed(0)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between gap-3 mt-1 pt-1 border-t border-neutral-200">
                      <span className="text-neutral-700 font-medium">Total:</span>
                      <span className="font-semibold text-neutral-900">
                        ${upcomingPayments.reduce((sum, r) => sum + r.amount, 0).toFixed(0)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calendar Settings Gear + Mobile Hamburger */}
      <div className="relative ml-2 flex items-center gap-1">
        {setDayColumnCount && (
          <select
            value={dayColumnCount}
            onChange={e => setDayColumnCount(parseInt(e.target.value, 10))}
            className="hidden md:block bg-transparent text-xs text-neutral-600 hover:bg-neutral-200 rounded px-1 py-0.5 border-0 focus:outline-none focus:ring-1 focus:ring-neutral-300 cursor-pointer"
            title="Days visible"
            aria-label="Days visible"
          >
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
          </select>
        )}
        <select
          value=""
          onChange={() => {}}
          disabled={archivedHabits.length === 0}
          className="hidden md:block bg-transparent text-xs text-neutral-600 hover:bg-neutral-200 rounded px-1 py-0.5 border-0 focus:outline-none focus:ring-1 focus:ring-neutral-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed max-w-[140px]"
          title="Hidden habits"
          aria-label="Hidden habits"
        >
          <option value="">
            {archivedHabits.length === 0 ? 'No hidden' : `Hidden (${archivedHabits.length})`}
          </option>
          {archivedHabits.map(h => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        {setHourHeight && (
          <button
            onClick={() => setHourHeight(hourHeight >= 80 ? 64 : 80)}
            className="hidden md:block p-0.5 hover:bg-neutral-200 rounded transition-colors text-neutral-500"
            title={hourHeight >= 80 ? 'Compact rows' : 'Expand rows'}
            aria-label={hourHeight >= 80 ? 'Compact rows' : 'Expand rows'}
          >
            {hourHeight >= 80 ? (
              <Minimize2 className="w-2.5 h-2.5" />
            ) : (
              <Maximize2 className="w-2.5 h-2.5" />
            )}
          </button>
        )}
        <button
          onClick={() => setShowCalendarSettings(!showCalendarSettings)}
          className="hidden md:block p-0.5 hover:bg-neutral-200 rounded transition-colors"
          title="Calendar settings"
        >
          <Settings className="w-2.5 h-2.5 text-neutral-500" />
        </button>
        <button
          onClick={openNeedHelpModal}
          className="md:hidden p-0.5 rounded-full text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200 transition-colors"
          title="Need help?"
          aria-label="Need help"
        >
          <AlertCircle className="w-2.5 h-2.5" />
        </button>
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-0.5 hover:bg-neutral-200 rounded transition-colors"
            title="Menu"
          >
            <Menu className="w-2.5 h-2.5 text-neutral-500" />
          </button>
        )}
        <CalendarSettingsPanel
          isOpen={showCalendarSettings}
          onClose={() => setShowCalendarSettings(false)}
          onSync={onSyncGoogleCalendar}
        />
      </div>
      </div>
    </div>
  )
}