import { format } from 'date-fns'

export const getAvailableTimeBlocks = (
  date: Date, 
  conflictMaps: any, 
  getWorkHoursRange: () => { start: number; end: number },
  alreadyScheduledTasks: any[] = []
) => {
  const blocks = []
  const dateStr = format(date, 'yyyy-MM-dd')
  const { start, end } = getWorkHoursRange()
  
  console.log(`🕐 Work hours for ${dateStr}: ${start}:00 - ${end}:00`)
  
  if (start === 7 && end === 23) {
    console.warn('⚠️ Using fallback work hours instead of user settings!')
  }
  
  // Don't filter by current time - allow scheduling from start of day
  // const now = new Date()
  // const isToday = format(now, 'yyyy-MM-dd') === dateStr
  // const currentHour = isToday ? now.getHours() + now.getMinutes() / 60 : start

  for (let hour = start; hour < end; hour++) {
    for (let quarterHour = 0; quarterHour < 4; quarterHour++) {
      const minutes = quarterHour * 15
      const timeInHours = hour + minutes / 60
      const timeSlot = hour.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0')

      // Use pre-computed conflict maps for O(1) lookups
      const conflictKey = `${dateStr}-${timeInHours}`
      const habitConflict = conflictMaps.habitConflicts.get(conflictKey)
      const sessionConflict = conflictMaps.sessionConflicts.get(conflictKey)
      const meetingConflict = conflictMaps.meetingConflicts.get(conflictKey)
      const tasksDailyLogsConflict = conflictMaps.tasksDailyLogsConflicts?.get(conflictKey)
      
      const habitConflicts = habitConflict ? [habitConflict] : []
      const sessionConflicts = sessionConflict ? [sessionConflict] : []
      const meetingConflicts = meetingConflict ? [meetingConflict] : []
      const tasksDailyLogsConflicts = tasksDailyLogsConflict ? [tasksDailyLogsConflict] : []

      const scheduledTasksInSlot = alreadyScheduledTasks.filter(
        task =>
          format(task.date, 'yyyy-MM-dd') === dateStr &&
          task.startTime <= timeInHours &&
          timeInHours < task.startTime + task.estimated_hours
      )

      const available =
        habitConflicts.length === 0 &&
        sessionConflicts.length === 0 &&
        meetingConflicts.length === 0 &&
        tasksDailyLogsConflicts.length === 0 &&
        scheduledTasksInSlot.length === 0

      blocks.push({ timeInHours, timeSlot, available })
    }
  }

  return blocks
}

export const scheduleTaskInAvailableSlots = (
  taskHours: number,
  date: Date,
  taskInfo: any,
  conflictMaps: any,
  getWorkHoursRange: () => { start: number; end: number },
  alreadyScheduledTasks: any[] = []
) => {
  const availableBlocks = getAvailableTimeBlocks(date, conflictMaps, getWorkHoursRange, alreadyScheduledTasks)
  const scheduledChunks = []
  let remainingHours = taskHours

  let currentChunkStart = null
  let currentChunkHours = 0

  for (let i = 0; i < availableBlocks.length && remainingHours > 0; i++) {
    const block = availableBlocks[i]

    if (block.available) {
      if (currentChunkStart === null) {
        currentChunkStart = block.timeInHours
        currentChunkHours = 0
      }
      currentChunkHours += 0.25
    } else {
      if (currentChunkStart !== null && currentChunkHours > 0) {
        const chunkHours = Math.min(currentChunkHours, remainingHours)
        const { end } = getWorkHoursRange()
        
        // Ensure chunk doesn't extend beyond work hours
        const chunkEndTime = currentChunkStart + chunkHours
        const adjustedChunkHours = chunkEndTime > end ? end - currentChunkStart : chunkHours
        
        if (adjustedChunkHours > 0) {
          scheduledChunks.push({
            ...taskInfo,
            id: `${taskInfo.id}-chunk-${scheduledChunks.length}`,
            title: `${taskInfo.title}${scheduledChunks.length > 0 ? ` (${scheduledChunks.length + 1})` : ''}`,
            startTime: currentChunkStart,
            startHour: Math.floor(currentChunkStart),
            estimated_hours: adjustedChunkHours,
            topPosition: 0,
          })
          remainingHours -= adjustedChunkHours
        }
        currentChunkStart = null
        currentChunkHours = 0
      }
    }
  }

  if (currentChunkStart !== null && currentChunkHours > 0 && remainingHours > 0) {
    const chunkHours = Math.min(currentChunkHours, remainingHours)
    const { end } = getWorkHoursRange()
    
    // Ensure chunk doesn't extend beyond work hours
    const chunkEndTime = currentChunkStart + chunkHours
    const adjustedChunkHours = chunkEndTime > end ? end - currentChunkStart : chunkHours
    
    console.log(`📋 Final chunk: start=${currentChunkStart}, hours=${chunkHours}, adjustedHours=${adjustedChunkHours}, workEnd=${end}`)
    
    if (adjustedChunkHours > 0) {
      scheduledChunks.push({
        ...taskInfo,
        id: `${taskInfo.id}-chunk-${scheduledChunks.length}`,
        title: `${taskInfo.title}${scheduledChunks.length > 0 ? ` (${scheduledChunks.length + 1})` : ''}`,
        startTime: currentChunkStart,
        startHour: Math.floor(currentChunkStart),
        estimated_hours: adjustedChunkHours,
        topPosition: 0,
      })
    }
  }

  return scheduledChunks
}

export const scheduleAllTasks = async (
  tasksData: any[],
  conflictMaps: any,
  dayColumns: any[],
  getWorkHoursRange: () => { start: number; end: number },
  scheduleTaskInAvailableSlots: any,
  saveTaskChunks: any,
  clearTaskLogsForDate: any,
  userId: string
) => {
  const unscheduledTasks = tasksData.filter(
    task =>
      !task.parent_task_id &&
      task.status !== 'completed' &&
      task.estimated_hours &&
      task.estimated_hours > 0
  )

  if (unscheduledTasks.length === 0) return new Map()

  let allScheduledChunks: any[] = []
  let remainingTasks = unscheduledTasks.map(task => ({
    ...task,
    remainingHours: task.estimated_hours,
  }))

  for (const dayColumn of dayColumns) {
    if (remainingTasks.length === 0) break

    let scheduledOnThisDay = true
    while (scheduledOnThisDay && remainingTasks.length > 0) {
      scheduledOnThisDay = false

      for (let i = 0; i < remainingTasks.length; i++) {
        const task = remainingTasks[i]
        const scheduledChunks = scheduleTaskInAvailableSlots(
          task.remainingHours,
          dayColumn.date,
          { ...task, isAutoScheduled: true },
          conflictMaps,
          getWorkHoursRange,
          allScheduledChunks
        )

        if (scheduledChunks.length > 0) {
          const chunksWithDate = scheduledChunks.map(chunk => ({
            ...chunk,
            date: dayColumn.date,
          }))
          allScheduledChunks.push(...chunksWithDate)

          const totalScheduledHours = scheduledChunks.reduce(
            (sum, chunk) => sum + chunk.estimated_hours,
            0
          )
          task.remainingHours -= totalScheduledHours

          console.log(`📅 Scheduled ${totalScheduledHours}h for "${task.title}" on ${format(dayColumn.date, 'yyyy-MM-dd')}, remaining: ${task.remainingHours}h`)

          if (task.remainingHours <= 0) {
            remainingTasks = remainingTasks.filter(t => t.id !== task.id)
            scheduledOnThisDay = true
          } else {
            scheduledOnThisDay = true
          }
          break
        } else {
          console.log(`❌ No slots found for "${task.title}" on ${format(dayColumn.date, 'yyyy-MM-dd')}`)
        }
      }
    }
  }

  // Cache the scheduled tasks
  const tasksByDate = new Map()
  allScheduledChunks.forEach(chunk => {
    const chunkDateKey = format(chunk.date, 'yyyy-MM-dd')
    if (!tasksByDate.has(chunkDateKey)) {
      tasksByDate.set(chunkDateKey, [])
    }
    tasksByDate.get(chunkDateKey).push(chunk)
  })

  // Persist today's task chunks to database
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const todayChunks = allScheduledChunks.filter(chunk => 
    format(chunk.date, 'yyyy-MM-dd') === todayStr
  )

  if (todayChunks.length > 0) {
    try {
      await clearTaskLogsForDate(userId, today)
      await saveTaskChunks(todayChunks, userId)
      console.log(`Persisted ${todayChunks.length} task chunks for today`)
    } catch (error) {
      console.error('Error persisting task chunks:', error)
    }
  }

  return tasksByDate
}