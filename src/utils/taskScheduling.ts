import { format } from 'date-fns'
import { supabase } from '../lib/supabase'

export const getAvailableTimeBlocks = (
  date: Date,
  conflictMaps: any,
  getWorkHoursRange: (date?: Date) => { start: number; end: number },
  alreadyScheduledTasks: any[] = [],
  weekendDays: string[] = []
) => {
  const dateStr = format(date, 'yyyy-MM-dd')

  // Skip weekend days for task scheduling
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  if (weekendDays.includes(dayOfWeek)) {
    return []
  }

  const blocks = []
  const { start, end } = getWorkHoursRange(date)
  
  // Filter by current time for today - start from next 15-minute block
  const now = new Date()
  const isToday = format(now, 'yyyy-MM-dd') === dateStr
  
  // Calculate the next 15-minute block
  let startHour = start
  if (isToday) {
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    
    // Round up to next 15-minute block
    const next15MinBlock = Math.ceil(currentMinute / 15) * 15
    if (next15MinBlock >= 60) {
      // Move to next hour if rounding up goes past 60 minutes
      startHour = Math.max(start, currentHour + 1)
    } else {
      startHour = Math.max(start, currentHour + next15MinBlock / 60)
    }
    
  }

  for (let hour = Math.floor(startHour); hour < end; hour++) {
    for (let quarterHour = 0; quarterHour < 4; quarterHour++) {
      const minutes = quarterHour * 15
      const timeInHours = hour + minutes / 60
      
      // Skip time blocks before the calculated start time for today
      if (isToday && timeInHours < startHour) {
        continue
      }
      
      const timeSlot = hour.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0')

      // Use pre-computed conflict maps for O(1) lookups
      // Round to avoid floating point precision issues
      const normalizedTime = Math.round(timeInHours * 4) / 4
      const conflictKey = `${dateStr}-${normalizedTime}`
      const habitConflict = conflictMaps.habitConflicts.get(conflictKey)
      const sessionConflict = conflictMaps.sessionConflicts.get(conflictKey)
      const meetingConflict = conflictMaps.meetingConflicts.get(conflictKey)
      const tasksDailyLogsConflict = conflictMaps.tasksDailyLogsConflicts?.get(conflictKey)
      const bufferConflict = conflictMaps.bufferConflicts?.get(conflictKey)
      const billableHoursConflict = conflictMaps.billableHoursConflicts?.get(conflictKey)

      const habitConflicts = habitConflict ? [habitConflict] : []
      const sessionConflicts = sessionConflict ? [sessionConflict] : []
      const meetingConflicts = meetingConflict ? [meetingConflict] : []
      const tasksDailyLogsConflicts = tasksDailyLogsConflict ? [tasksDailyLogsConflict] : []
      const bufferConflicts = bufferConflict ? [bufferConflict] : []
      const billableHoursConflicts = billableHoursConflict ? [billableHoursConflict] : []

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
        bufferConflicts.length === 0 &&
        billableHoursConflicts.length === 0 &&
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
  alreadyScheduledTasks: any[] = [],
  weekendDays: string[] = []
) => {
  const availableBlocks = getAvailableTimeBlocks(date, conflictMaps, getWorkHoursRange, alreadyScheduledTasks, weekendDays)
  const dateStr = format(date, 'yyyy-MM-dd')
  
  
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
          const chunk = {
            ...taskInfo,
            id: `${taskInfo.id}-chunk-${scheduledChunks.length}`,
            title: `${taskInfo.title}${scheduledChunks.length > 0 ? ` (${scheduledChunks.length + 1})` : ''}`,
            startTime: currentChunkStart,
            startHour: Math.floor(currentChunkStart),
            estimated_hours: adjustedChunkHours,
            topPosition: 0,
          }
          
          scheduledChunks.push(chunk)
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
    
    if (adjustedChunkHours > 0) {
      const chunk = {
        ...taskInfo,
        id: `${taskInfo.id}-chunk-${scheduledChunks.length}`,
        title: `${taskInfo.title}${scheduledChunks.length > 0 ? ` (${scheduledChunks.length + 1})` : ''}`,
        startTime: currentChunkStart,
        startHour: Math.floor(currentChunkStart),
        estimated_hours: adjustedChunkHours,
        topPosition: 0,
      }
      
      scheduledChunks.push(chunk)
    }
  }


  return scheduledChunks
}

// Priority sorting function
const sortTasksByPriority = (tasks: any[]) => {
  const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2, 'placeholder': 3 }
  return tasks.sort((a, b) => {
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1
    return aPriority - bPriority
  })
}

export const scheduleAllTasks = async (
  tasksData: any[],
  conflictMaps: any,
  dayColumns: any[],
  getWorkHoursRange: () => { start: number; end: number },
  scheduleTaskInAvailableSlots: any,
  saveTaskChunks: any,
  userId: string,
  tasksDailyLogsData: any[] = [],
  weekendDays: string[] = []
) => {
  // Filter unscheduled, non-completed root tasks with estimated work.
  const unscheduledTasks = tasksData.filter(
    task =>
      !task.parent_task_id &&
      task.status !== 'completed' &&
      task.estimated_hours &&
      task.estimated_hours > 0
  )

  let tasksToSchedule = sortTasksByPriority([...unscheduledTasks])

  if (tasksToSchedule.length === 0) return new Map()

  // Calculate completed hours for each task from task daily logs.
  const completedHoursByTask = new Map()
  tasksDailyLogsData.forEach(log => {
    if (log.task_id && log.completed_at) {
      const completedHours =
        log.actual_duration || log.time_spent_hours || log.scheduled_duration || log.estimated_hours || 0
      const currentCompleted = completedHoursByTask.get(log.task_id) || 0
      completedHoursByTask.set(log.task_id, currentCompleted + completedHours)
    }
  })

  let allScheduledChunks: any[] = []
  let remainingTasks = tasksToSchedule.map(task => {
    const completedHours = completedHoursByTask.get(task.id) || 0
    const remainingHours = Math.max(0, task.estimated_hours - completedHours)

    return {
      ...task,
      remainingHours,
    }
  }).filter(task => task.remainingHours > 0)

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
          allScheduledChunks,
          weekendDays
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

          remainingTasks = remainingTasks.filter(t => t.id !== task.id)
          scheduledOnThisDay = true
          break
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

  // Persist all task chunks to database
  if (allScheduledChunks.length > 0) {
    try {
      await saveTaskChunks(allScheduledChunks, userId)
    } catch (error) {
      console.error('Error persisting task chunks:', error)
    }
  }


  return tasksByDate
}