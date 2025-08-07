import { format } from 'date-fns'

export const calculateWorkHours = (
  scheduledTasksCache: Map<string, any[]>,
  allTasks: any[],
  tasksScheduled: boolean,
  settings: any,
  tasksDailyLogs: any[] = []
) => {
  const now = new Date()

  // Get week ending configuration from settings
  const weekEndingDay = settings?.week_ending_day || 'sunday'
  const weekEndingTime = settings?.week_ending_time || '20:30'
  const weekEndingTimezone = settings?.week_ending_timezone || 'America/New_York'

  // Calculate days until week ending day
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const targetDayIndex = dayNames.indexOf(weekEndingDay)
  const currentDayIndex = now.getDay()
  const daysUntilTarget = (targetDayIndex - currentDayIndex + 7) % 7

  const weekEndDate = new Date(now)
  weekEndDate.setDate(now.getDate() + daysUntilTarget)

  // Set to configured time
  const [hours, minutes] = weekEndingTime.split(':').map(Number)
  weekEndDate.setHours(hours, minutes, 0, 0)

  // Calculate the last week end date (7 days before current week end)
  const lastWeekEndDate = new Date(weekEndDate)
  lastWeekEndDate.setDate(weekEndDate.getDate() - 7)

  let plannedHours = 0
  let actualHours = 0
  const actualHoursBreakdown: Array<{
    sessionName: string
    projectName: string
    hours: number
    date: string
    hourlyRate?: number
  }> = []
  const plannedHoursBreakdown: Array<{
    sessionName: string
    projectName: string
    hours: number
    dueDate: string
    hourlyRate?: number
    isCompleted: boolean
  }> = []

  // Process scheduled tasks cache
  scheduledTasksCache.forEach((chunks, dateKey) => {
    const chunkDate = new Date(dateKey + 'T00:00:00')

    chunks.forEach(chunk => {
      // The chunk has the task data directly, extract the original task ID
      const originalTaskId = chunk.id.split('-chunk-')[0]

      // Calculate chunk end time
      const chunkStartHour = chunk.startTime ? Math.floor(chunk.startTime) : chunk.startHour
      const chunkStartMinute = chunk.startTime ? (chunk.startTime % 1) * 60 : 0
      const chunkDateTime = new Date(chunkDate)
      chunkDateTime.setHours(chunkStartHour, chunkStartMinute, 0, 0)

      // Add chunk duration to get end time (use estimated_hours from chunk)
      const chunkEndTime = new Date(chunkDateTime)
      chunkEndTime.setHours(chunkEndTime.getHours() + Math.floor(chunk.estimated_hours))
      chunkEndTime.setMinutes(chunkEndTime.getMinutes() + (chunk.estimated_hours % 1) * 60)

      // Include chunks that start before the cutoff (partial or full)
      if (chunkDateTime < weekEndDate) {
        const task = allTasks.find(t => t.id === originalTaskId)
        
        if (task && task.is_billable) {
          // Calculate actual hours to include (partial if chunk crosses cutoff)
          let hoursToInclude = chunk.estimated_hours
          if (chunkEndTime > weekEndDate) {
            // Chunk crosses cutoff, only include hours up to cutoff
            const timeDiff = weekEndDate.getTime() - chunkDateTime.getTime()
            hoursToInclude = timeDiff / (1000 * 60 * 60) // Convert milliseconds to hours
          }
          
          // Only include chunks with hourly rates > 0 in planned hours
          if (task.projects?.hourly_rate && Number(task.projects.hourly_rate) > 0) {
            plannedHours += hoursToInclude
          }

          // Add to planned breakdown
          plannedHoursBreakdown.push({
            sessionName: `${task.title} (${chunkStartHour}:${chunkStartMinute
              .toString()
              .padStart(2, '0')})`,
            projectName: task.projects?.name || 'Project',
            hours: hoursToInclude,
            dueDate: dateKey,
            hourlyRate: task.projects?.hourly_rate || 0,
            isCompleted: task.is_complete,
          })

          // Only count actual hours for completed work
          if (task.is_complete) {
            actualHours += hoursToInclude
            actualHoursBreakdown.push({
              sessionName: `${task.title} (${chunkStartHour}:${chunkStartMinute
                .toString()
                .padStart(2, '0')})`,
              projectName: task.projects?.name || 'Project',
              hours: hoursToInclude,
              date: dateKey,
              hourlyRate: task.projects?.hourly_rate || 0,
            })
          }
        }
      }
    })
  })

  // Process tasks daily logs for planned hours (only since last week ended)
  tasksDailyLogs.forEach(log => {
    const task = log.tasks
    if (task && task.is_billable) {
      const logDate = new Date(log.log_date + 'T00:00:00')
      const [startHour, startMinute] = log.scheduled_start_time.split(':').map(Number)
      const logDateTime = new Date(logDate)
      logDateTime.setHours(startHour, startMinute, 0, 0)

      // Include logs that are after last week end and before current week end
      if (logDateTime > lastWeekEndDate && logDateTime < weekEndDate) {
        const hoursToInclude = Number(log.estimated_hours) || 0
        
        // Only include tasks with hourly rates > 0 in planned hours
        if (task.projects?.hourly_rate && Number(task.projects.hourly_rate) > 0) {
          plannedHours += hoursToInclude
        }

        // Add to planned breakdown
        plannedHoursBreakdown.push({
          sessionName: `${task.title} (${log.scheduled_start_time})`,
          projectName: task.projects?.name || 'Project',
          hours: hoursToInclude,
          dueDate: log.log_date,
          hourlyRate: task.projects?.hourly_rate || 0,
          isCompleted: task.is_complete,
        })

        // Count actual hours for completed work
        if (task.is_complete) {
          actualHours += hoursToInclude
          actualHoursBreakdown.push({
            sessionName: `${task.title} (${log.scheduled_start_time})`,
            projectName: task.projects?.name || 'Project',
            hours: hoursToInclude,
            date: log.log_date,
            hourlyRate: task.projects?.hourly_rate || 0,
          })
        }
      }
    }
  })

  return { plannedHours, actualHours, actualHoursBreakdown, plannedHoursBreakdown }
}