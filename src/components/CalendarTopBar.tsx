import React from 'react'
import { format } from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Info,
  ListTodo,
  Sun,
} from 'lucide-react'

interface CalendarTopBarProps {
  settings: any
  plannedHours: number
  actualHours: number
  plannedHoursBreakdown: any[]
  actualHoursBreakdown: any[]
  showWorkHoursTooltip: boolean
  showActualHoursTooltip: boolean
  showPlannedHoursTooltip: boolean
  showTaskScheduleModal: boolean
  setShowWorkHoursTooltip: (show: boolean) => void
  setShowActualHoursTooltip: (show: boolean) => void
  setShowPlannedHoursTooltip: (show: boolean) => void
  setShowTaskScheduleModal: (show: boolean) => void
  navigateBackWeek: () => void
  navigateBackDay: () => void
  navigateToToday: () => void
  navigateForwardDay: () => void
  navigateForwardWeek: () => void
}

export default function CalendarTopBar({
  settings,
  plannedHours,
  actualHours,
  plannedHoursBreakdown,
  actualHoursBreakdown,
  showWorkHoursTooltip,
  showActualHoursTooltip,
  showPlannedHoursTooltip,
  showTaskScheduleModal,
  setShowWorkHoursTooltip,
  setShowActualHoursTooltip,
  setShowPlannedHoursTooltip,
  setShowTaskScheduleModal,
  navigateBackWeek,
  navigateBackDay,
  navigateToToday,
  navigateForwardDay,
  navigateForwardWeek,
}: CalendarTopBarProps) {
  return (
    // Top Bar with Navigation and Work Hours
    <div className="bg-neutral-100 border-b border-neutral-200 px-2 py-0.5 sm:px-0">
    {/* Navigation, Work Hours Label, and Planned/Actual all on one line */}
    <div className="flex items-center justify-between sm:px-2">
      {/* Left side: Navigation Controls */}
      <div className="flex items-center">
        <button
          onClick={navigateBackWeek}
          className=" hover:bg-neutral-200 rounded transition-colors"
          title="Go back 5 days"
        >
          <ChevronsLeft className="w-2 h-2 text-neutral-600" />
        </button>
        <button
          onClick={navigateBackDay}
          className="hover:bg-neutral-200 rounded transition-colors"
          title="Go back 1 day"
        >
          <ChevronLeft className="w-2 h-2 text-neutral-600" />
        </button>
        <button
          onClick={navigateToToday}
          className="hover:bg-neutral-200 rounded transition-colors mx-1"
          title="Go to today"
        >
          <Sun className="w-2 h-2 text-yellow-600" />
        </button>
        <button
          onClick={navigateForwardDay}
          className="hover:bg-neutral-200 rounded transition-colors"
          title="Go forward 1 day"
        >
          <ChevronRight className="w-2 h-2 text-neutral-600" />
        </button>
        <button
          onClick={navigateForwardWeek}
          className="hover:bg-neutral-200 rounded transition-colors"
          title="Go forward 5 days"
        >
          <ChevronsRight className="w-2 h-2 text-neutral-600" />
        </button>

        {/* Work Hours Label - desktop only */}
        <div className="hidden sm:block text-sm text-neutral-700 ml-2 work-hours-tooltip relative">
          {settings ? (
            <div className="flex items-center">
              <span>Work Hours</span>
              <button
                onClick={() => setShowWorkHoursTooltip(!showWorkHoursTooltip)}
                className="ml-0 hover:bg-neutral-200 rounded p-0.5 transition-colors"
                title="Work hours details"
              >
                <Info className="w-2 h-2 text-neutral-500" />
              </button>
              <button
                onClick={() => setShowTaskScheduleModal(!showTaskScheduleModal)}
                className="ml-0.5 hover:bg-neutral-200 rounded p-0.5 transition-colors"
                title="View upcoming tasks"
              >
                <ListTodo className="w-2 h-2 text-neutral-500" />
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
            <span className="text-neutral-400">Loading work hours...</span>
          )}
        </div>
      </div>

      {/* Right side: Planned and Actual hours */}
      <div className="flex items-center gap-2">
        <div className="text-sm relative planned-hours-tooltip">
          <span className="text-neutral-600">Planned:</span>
          <span
            className="font-medium text-neutral-900 ml-1 cursor-pointer hover:underline"
            onClick={() => setShowPlannedHoursTooltip(!showPlannedHoursTooltip)}
          >
            {plannedHours.toFixed(1)}h ($
            {plannedHoursBreakdown
              .filter(item => item.hourlyRate && Number(item.hourlyRate) > 0)
              .reduce((sum, item) => sum + item.hours * Number(item.hourlyRate), 0)
              .toFixed(0)}
            )
          </span>
          {showPlannedHoursTooltip && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-neutral-200 shadow-lg rounded-md p-2 z-50">
              <div className="text-sm font-medium text-neutral-900">
                Planned Hours Breakdown
              </div>
              {plannedHoursBreakdown.filter(
                item => item.hourlyRate && Number(item.hourlyRate) > 0
              ).length > 0 ? (
                <div className="space-y-2">
                  {(() => {
                    // Group by project
                    const groupedByProject = plannedHoursBreakdown
                      .filter(item => item.hourlyRate && Number(item.hourlyRate) > 0)
                      .reduce((acc, item) => {
                        const existingProject = acc.find(
                          group => group.projectName === item.projectName
                        )
                        if (existingProject) {
                          existingProject.sessions.push(item)
                          existingProject.totalHours += item.hours
                          existingProject.totalValue += item.hours * Number(item.hourlyRate)
                        } else {
                          acc.push({
                            projectName: item.projectName,
                            hourlyRate: item.hourlyRate,
                            totalHours: item.hours,
                            totalValue: item.hours * Number(item.hourlyRate),
                            sessions: [item],
                          })
                        }
                        return acc
                      }, [])

                    return groupedByProject.map((project, projectIndex) => (
                      <div
                        key={projectIndex}
                        className="border-b border-neutral-100 last:border-b-0 pb-2 last:pb-0"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-neutral-900">
                              {project.projectName}
                            </div>
                            <div className="text-neutral-500 text-xs">
                              ${Number(project.hourlyRate)}/hr
                            </div>
                          </div>
                          <div className="text-neutral-900 font-medium">
                            {project.totalHours.toFixed(1)}h
                            <div className="text-blue-600 text-xs">
                              ${project.totalValue.toFixed(0)}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-0.5 ml-2">
                          {project.sessions.map((session, sessionIndex) => (
                            <div
                              key={sessionIndex}
                              className="flex justify-between items-center text-xs"
                            >
                              <div className="flex-1">
                                <div className="text-neutral-600 truncate flex items-center">
                                  {session.sessionName}
                                  {session.isCompleted && (
                                    <span className="ml-2 text-green-600">✓</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-neutral-600">
                                {session.hours.toFixed(1)}h
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  })()}
                  <div className="border-t border-neutral-200 pt-1 mt-2">
                    <div className="flex justify-between items-center text-sm font-medium">
                      <span>Total</span>
                      <span>
                        {plannedHoursBreakdown
                          .filter(item => item.hourlyRate && Number(item.hourlyRate) > 0)
                          .reduce((sum, item) => sum + item.hours, 0)
                          .toFixed(1)}
                        h
                      </span>
                    </div>
                    {plannedHoursBreakdown.some(
                      item => item.hourlyRate && Number(item.hourlyRate) > 0
                    ) && (
                      <div className="flex justify-between items-center text-sm text-blue-600">
                        <span>Est. Value</span>
                        <span>
                          $
                          {plannedHoursBreakdown
                            .reduce(
                              (sum, item) =>
                                sum +
                                item.hours *
                                  (Number(item.hourlyRate) > 0 ? Number(item.hourlyRate) : 0),
                              0
                            )
                            .toFixed(0)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-neutral-500">No planned work found</div>
              )}
            </div>
          )}
        </div>
        <div className="hidden sm:block text-sm relative actual-hours-tooltip">
          <span className="text-neutral-600">Actual:</span>
          <span
            className="font-medium text-neutral-900 ml-1 cursor-pointer hover:underline"
            onClick={() => setShowActualHoursTooltip(!showActualHoursTooltip)}
          >
            {actualHours.toFixed(1)}h
          </span>
          {showActualHoursTooltip && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-neutral-200 shadow-lg rounded-md p-3 z-50">
              <div className="text-sm font-medium text-neutral-900 mb-2">
                Actual Hours Breakdown
              </div>
              {actualHoursBreakdown.length > 0 ? (
                <div className="space-y-1">
                  {actualHoursBreakdown.map((item, index) => (
                    <div key={index} className="flex justify-between items-center text-xs">
                      <div className="flex-1">
                        <div className="font-medium text-neutral-900">{item.projectName}</div>
                        <div className="text-neutral-600">
                          {format(new Date(item.date), 'MMM d')}
                        </div>
                        {item.hourlyRate && Number(item.hourlyRate) > 0 && (
                          <div className="text-neutral-500">${Number(item.hourlyRate)}/hr</div>
                        )}
                      </div>
                      <div className="text-neutral-900 font-medium">
                        {item.hours.toFixed(1)}h
                        {item.hourlyRate && item.hourlyRate > 0 && (
                          <div className="text-green-600 text-xs">
                            ${(item.hours * item.hourlyRate).toFixed(0)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-neutral-200 pt-1 mt-2">
                    <div className="flex justify-between items-center text-sm font-medium">
                      <span>Total</span>
                      <span>{actualHours.toFixed(1)}h</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-neutral-500">No completed sessions yet</div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}