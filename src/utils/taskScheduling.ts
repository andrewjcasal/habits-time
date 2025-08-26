import { format } from 'date-fns'
import { calculateWorkHours } from './workHoursCalculation'
import { supabase } from '../lib/supabase'

export const getAvailableTimeBlocks = (
  date: Date, 
  conflictMaps: any, 
  getWorkHoursRange: () => { start: number; end: number },
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
  const { start, end } = getWorkHoursRange()
  
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
    
    console.log(`🕐 Current time: ${currentHour}:${currentMinute.toString().padStart(2, '0')}, Next 15-min block: ${startHour.toFixed(2)} (${Math.floor(startHour)}:${((startHour % 1) * 60).toString().padStart(2, '0')})`)
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
      
      const habitConflicts = habitConflict ? [habitConflict] : []
      const sessionConflicts = sessionConflict ? [sessionConflict] : []
      const meetingConflicts = meetingConflict ? [meetingConflict] : []
      const tasksDailyLogsConflicts = tasksDailyLogsConflict ? [tasksDailyLogsConflict] : []
      const bufferConflicts = bufferConflict ? [bufferConflict] : []

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

// Helper function for scheduling without billable hours logic
const scheduleTasksWithoutBillableLogic = async (
  tasksToSchedule: any[],
  conflictMaps: any,
  dayColumns: any[],
  getWorkHoursRange: () => { start: number; end: number },
  scheduleTaskInAvailableSlots: any,
  saveTaskChunks: any,
  clearTaskLogsFromTimeForward: any,
  userId: string,
  tasksDailyLogsData: any[],
  weekendDays: string[]
) => {
  const completedHoursByTask = new Map()
  tasksDailyLogsData.forEach(log => {
    if (log.task_id) {
      const completedHours = log.actual_duration || log.scheduled_duration || log.estimated_hours || 0
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

  // Sort tasks by priority (high > medium > low)
  remainingTasks = sortTasksByPriority(remainingTasks)

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

          if (task.remainingHours <= 0) {
            remainingTasks = remainingTasks.filter(t => t.id !== task.id)
            scheduledOnThisDay = true
          } else {
            scheduledOnThisDay = true
          }
          break
        }
      }
    }
  }

  const tasksByDate = new Map()
  allScheduledChunks.forEach(chunk => {
    const chunkDateKey = format(chunk.date, 'yyyy-MM-dd')
    if (!tasksByDate.has(chunkDateKey)) {
      tasksByDate.set(chunkDateKey, [])
    }
    tasksByDate.get(chunkDateKey).push(chunk)
  })

  // Persist today's task chunks
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const todayChunks = allScheduledChunks.filter(chunk => 
    format(chunk.date, 'yyyy-MM-dd') === todayStr
  )

  if (todayChunks.length > 0) {
    try {
      await saveTaskChunks(todayChunks, userId)
    } catch (error) {
      console.error('Error persisting task chunks:', error)
    }
  }

  return tasksByDate
}

export const scheduleAllTasks = async (
  tasksData: any[],
  conflictMaps: any,
  dayColumns: any[],
  getWorkHoursRange: () => { start: number; end: number },
  scheduleTaskInAvailableSlots: any,
  saveTaskChunks: any,
  clearTaskLogsFromTimeForward: any,
  userId: string,
  tasksDailyLogsData: any[] = [],
  weekendDays: string[] = [],
  userSettings: any = null,
  allTasks: any[] = [],
  scheduledTasksCache: Map<string, any[]> = new Map()
) => {
  const unscheduledTasks = tasksData.filter(
    task =>
      !task.parent_task_id &&
      task.status !== 'completed' &&
      task.estimated_hours &&
      task.estimated_hours > 0
  )

  // Calculate total billable revenue from existing tasks and completed work
  const billableHoursEnabled = userSettings?.billable_hours_enabled || false
  const TARGET_REVENUE = userSettings?.weekly_revenue_target || 1000
  const DEFAULT_HOURLY_RATE = userSettings?.default_hourly_rate || 65

  // Calculate already completed billable revenue this week using proven workHoursCalculation logic
  let completedBillableRevenueThisWeek = 0
  if (billableHoursEnabled) {
    // Use the exact same logic as the UI for consistency
    // Note: The UI uses unfiltered tasksDailyLogs, but scheduling gets filtered ones
    // Use passed tasks daily logs data instead of fetching again
    const unfilteredTasksDailyLogs = tasksDailyLogsData
    
    const { plannedHoursBreakdown } = calculateWorkHours(
      scheduledTasksCache,
      allTasks.length > 0 ? allTasks : unscheduledTasks,
      true, // tasksScheduled
      userSettings,
      unfilteredTasksDailyLogs || []
    )
    
    // Calculate total revenue from planned hours breakdown (same as UI)
    // This includes all task daily logs regardless of completion status
    completedBillableRevenueThisWeek = plannedHoursBreakdown
      .filter(item => item.hourlyRate && Number(item.hourlyRate) > 0)
      .reduce((total, entry) => {
        const revenue = entry.hours * Number(entry.hourlyRate)
        return total + revenue
      }, 0)
    
      console.log('123', plannedHoursBreakdown)
    console.log('📊 Using workHoursCalculation logic (plannedHoursBreakdown):', {
      plannedHoursBreakdown: plannedHoursBreakdown.length,
      billableEntries: plannedHoursBreakdown.filter(item => item.hourlyRate && Number(item.hourlyRate) > 0).length,
      completedBillableRevenueThisWeek
    })
  }
  
  // Skip billable hours logic if disabled
  if (!billableHoursEnabled) {
    let tasksToSchedule = [...unscheduledTasks]
    if (tasksToSchedule.length === 0) return new Map()
    
    // Continue with normal scheduling without placeholder tasks
    return scheduleTasksWithoutBillableLogic(tasksToSchedule, conflictMaps, dayColumns, getWorkHoursRange, scheduleTaskInAvailableSlots, saveTaskChunks, clearTaskLogsFromTimeForward, userId, tasksDailyLogsData, weekendDays)
  }
  
  // Calculate completed hours for each task from task daily logs
  const completedHoursByTask = new Map()
  tasksDailyLogsData.forEach(log => {
    if (log.task_id) {
      const completedHours = log.actual_duration || log.scheduled_duration || log.estimated_hours || 0
      const currentCompleted = completedHoursByTask.get(log.task_id) || 0
      completedHoursByTask.set(log.task_id, currentCompleted + completedHours)
    }
  })
  
  // Calculate existing billable revenue from remaining tasks
  const existingBillableRevenue = unscheduledTasks.reduce((total, task) => {
    const hourlyRate = task.projects?.hourly_rate || 0
    if (hourlyRate > 0) {
      const completedHours = completedHoursByTask.get(task.id) || 0
      const remainingHours = Math.max(0, task.estimated_hours - completedHours)
      return total + (remainingHours * hourlyRate)
    }
    return total
  }, 0)
  
  // Calculate remaining revenue needed
  const revenueNeeded = Math.max(0, TARGET_REVENUE - existingBillableRevenue - completedBillableRevenueThisWeek)
  
  // Convert revenue needed to hours using default hourly rate for placeholder task
  const hoursNeeded = revenueNeeded > 0 ? Math.ceil(revenueNeeded / DEFAULT_HOURLY_RATE) : 0
  
  console.log('📊 Billable revenue calculation:', {
    TARGET_REVENUE,
    existingBillableRevenue,
    completedBillableRevenueThisWeek,
    revenueNeeded,
    hoursNeeded,
    DEFAULT_HOURLY_RATE
  })
  
  // Sort tasks by priority first, then add placeholder tasks
  let tasksToSchedule = sortTasksByPriority([...unscheduledTasks])
  
  if (hoursNeeded > 0) {
    // Generate a proper UUID for placeholder task
    const crypto = window.crypto || window.msCrypto
    const uuid = crypto.randomUUID ? crypto.randomUUID() : 
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0
        const v = c == 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
      })
    
    const placeholderTask = {
      id: uuid,
      title: `Billable Work`,
      estimated_hours: hoursNeeded,
      status: 'todo',
      priority: 'placeholder',
      projects: {
        id: 'placeholder-project',
        name: 'Billable Work',
        hourly_rate: DEFAULT_HOURLY_RATE,
        color: '#10B981' // Green color for billable work
      },
      isPlaceholder: true
    }
    
    // Add placeholder task - it will be sorted to the end by priority
    tasksToSchedule.push(placeholderTask)
    
    // Re-sort to ensure placeholder comes after all real tasks
    tasksToSchedule = sortTasksByPriority(tasksToSchedule)
  }

  if (tasksToSchedule.length === 0) return new Map()

  let allScheduledChunks: any[] = []
  let remainingTasks = tasksToSchedule.map(task => {
    const completedHours = completedHoursByTask.get(task.id) || 0
    const remainingHours = Math.max(0, task.estimated_hours - completedHours)
    
    return {
      ...task,
      remainingHours,
    }
  }).filter(task => task.remainingHours > 0) // Only schedule tasks with remaining work

  // Tasks are already sorted by priority from above

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

          if (task.remainingHours <= 0) {
            remainingTasks = remainingTasks.filter(t => t.id !== task.id)
            scheduledOnThisDay = true
          } else {
            scheduledOnThisDay = true
          }
          break
        } else {
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

  // Persist today's task chunks to database (clearing already done in useCalendarData)
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const todayChunks = allScheduledChunks.filter(chunk => 
    format(chunk.date, 'yyyy-MM-dd') === todayStr
  )

  if (todayChunks.length > 0) {
    try {
      await saveTaskChunks(todayChunks, userId)
    } catch (error) {
      console.error('Error persisting task chunks:', error)
    }
  }

  console.log('[BUFFER DEBUG]', tasksByDate)

  return tasksByDate
}