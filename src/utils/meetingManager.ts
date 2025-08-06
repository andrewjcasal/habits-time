import { supabase } from '../lib/supabase'
import { format, parse, isBefore, startOfDay } from 'date-fns'

export const addMeeting = async (meetingData: any) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('meetings')
      .insert({ ...meetingData, user_id: user.id })
      .select()
      .single()

    if (error) throw error

    // Check if this meeting is in the past and handle task rollover
    await handleTaskRolloverForPastMeeting(data, user.id)

    return data
  } catch (error) {
    console.error('Error adding meeting:', error)
    throw error
  }
}

// Function to handle task rollover when meetings are added to past dates
export const handleTaskRolloverForPastMeeting = async (meeting: any, userId: string) => {
  try {

    const meetingDate = new Date(meeting.start_time)
    const today = startOfDay(new Date())
    
    // Only process if the meeting is in the past
    if (!isBefore(meetingDate, today)) {
      return
    }
    
    // Get the meeting time range
    const meetingStart = new Date(meeting.start_time)
    const meetingEnd = new Date(meeting.end_time)
    const meetingStartHour = meetingStart.getHours() + meetingStart.getMinutes() / 60
    const meetingEndHour = meetingEnd.getHours() + meetingEnd.getMinutes() / 60


    // Find tasks that were scheduled during this meeting time on this date
    const queryDate = format(meetingDate, 'yyyy-MM-dd')
    

    const { data: conflictingTaskLogs, error: taskLogsError } = await supabase
      .from('tasks_daily_logs')
      .select(`
        *,
        tasks!inner(*)
      `)
      .eq('user_id', userId)
      .eq('log_date', queryDate)
      .is('completed_at', null) // Only incomplete tasks

    if (taskLogsError) {
      console.error('❌ Error fetching task logs:', taskLogsError)
      return
    }

    
    
    if (conflictingTaskLogs) {
      conflictingTaskLogs.forEach((log, index) => {
        
      })
    }

    const affectedTaskLogs = conflictingTaskLogs?.filter(log => {
      if (!log.scheduled_start_time || !log.scheduled_end_time) {
        
        return false
      }
      
      const logStart = parse(log.scheduled_start_time, 'HH:mm:ss', new Date())
      const logEnd = parse(log.scheduled_end_time, 'HH:mm:ss', new Date())
      const logStartHour = logStart.getHours() + logStart.getMinutes() / 60
      const logEndHour = logEnd.getHours() + logEnd.getMinutes() / 60


      // Check if task overlaps with meeting time
      return (logStartHour < meetingEndHour && logEndHour > meetingStartHour)
    }) || []

    if (affectedTaskLogs.length === 0) {
      
      return
    }

    // Calculate total hours that need to be rolled over
    let totalHoursToRollover = 0
    const tasksToRollover = new Map()

    for (const log of affectedTaskLogs) {
      const logStart = parse(log.scheduled_start_time, 'HH:mm:ss', new Date())
      const logEnd = parse(log.scheduled_end_time, 'HH:mm:ss', new Date())
      const logStartHour = logStart.getHours() + logStart.getMinutes() / 60
      const logEndHour = logEnd.getHours() + logEnd.getMinutes() / 60

      // Calculate the overlapping time
      const overlapStart = Math.max(logStartHour, meetingStartHour)
      const overlapEnd = Math.min(logEndHour, meetingEndHour)
      const overlapHours = Math.max(0, overlapEnd - overlapStart)

      

      if (overlapHours > 0) {
        totalHoursToRollover += overlapHours
        
        // Track which tasks need rollover
        const taskId = log.task_id
        const currentRollover = tasksToRollover.get(taskId) || 0
        tasksToRollover.set(taskId, currentRollover + overlapHours)

        // Determine how to handle the conflicted task log
        const isTaskCompletelyWithinMeeting = logStartHour >= meetingStartHour && logEndHour <= meetingEndHour
        const isMeetingCompletelyWithinTask = meetingStartHour >= logStartHour && meetingEndHour <= logEndHour
        

        if (isTaskCompletelyWithinMeeting) {
          // Task is completely within meeting time - mark as conflicted
          
          await supabase
            .from('tasks_daily_logs')
            .update({
              notes: log.notes ? `${log.notes} [Completely conflicted with meeting: ${meeting.title}]` : `Completely conflicted with meeting: ${meeting.title}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', log.id)

        } else if (isMeetingCompletelyWithinTask) {
          // Meeting splits the task - need to update existing log and potentially create new ones
          
          
          const beforeMeetingHours = meetingStartHour - logStartHour
          const afterMeetingHours = logEndHour - meetingEndHour
          
          console.log(`📏 Task segments:`, {
            beforeMeetingHours,
            conflictHours: overlapHours,
            afterMeetingHours
          })

          // Update the existing log to end before the meeting
          if (beforeMeetingHours > 0) {
            const newEndTime = `${Math.floor(meetingStartHour).toString().padStart(2, '0')}:${Math.floor((meetingStartHour % 1) * 60).toString().padStart(2, '0')}:00`
            
            
            await supabase
              .from('tasks_daily_logs')
              .update({
                scheduled_end_time: newEndTime,
                estimated_hours: beforeMeetingHours,
                notes: log.notes ? `${log.notes} [Adjusted due to meeting: ${meeting.title}]` : `Adjusted due to meeting: ${meeting.title}`,
                updated_at: new Date().toISOString()
              })
              .eq('id', log.id)
          } else {
            // No time before meeting, mark existing log as conflicted
            await supabase
              .from('tasks_daily_logs')
              .update({
                notes: log.notes ? `${log.notes} [Start time conflicted with meeting: ${meeting.title}]` : `Start time conflicted with meeting: ${meeting.title}`,
                updated_at: new Date().toISOString()
              })
              .eq('id', log.id)
          }

          // Create a new log for the time after the meeting if there's remaining time
          if (afterMeetingHours > 0) {
            const newStartTime = `${Math.floor(meetingEndHour).toString().padStart(2, '0')}:${Math.floor((meetingEndHour % 1) * 60).toString().padStart(2, '0')}:00`
            const originalEndTime = log.scheduled_end_time
            
            // Check if the proposed time slot conflicts with existing tasks
            const newStartTimeInHours = meetingEndHour
            const newEndTimeInHours = parse(originalEndTime, 'HH:mm:ss', new Date()).getHours() + parse(originalEndTime, 'HH:mm:ss', new Date()).getMinutes() / 60
            
            // Query for existing task logs in the proposed time range
            const { data: existingLogs, error: existingLogsError } = await supabase
              .from('tasks_daily_logs')
              .select('*')
              .eq('user_id', userId)
              .eq('log_date', log.log_date)
              .is('completed_at', null)
            
            if (existingLogsError) {
              console.error(`❌ Error checking for existing logs:`, existingLogsError)
            } else {
              // Check for time conflicts with existing logs
              const hasConflict = existingLogs?.some(existingLog => {
                if (!existingLog.scheduled_start_time || !existingLog.scheduled_end_time) return false
                
                const existingStart = parse(existingLog.scheduled_start_time, 'HH:mm:ss', new Date())
                const existingEnd = parse(existingLog.scheduled_end_time, 'HH:mm:ss', new Date())
                const existingStartInHours = existingStart.getHours() + existingStart.getMinutes() / 60
                const existingEndInHours = existingEnd.getHours() + existingEnd.getMinutes() / 60
                
                // Check if proposed time overlaps with existing task
                return (newStartTimeInHours < existingEndInHours && newEndTimeInHours > existingStartInHours)
              })
              
              if (hasConflict) {
                
              } else {
                
                
                const { error: insertError } = await supabase
                  .from('tasks_daily_logs')
                  .insert({
                    task_id: log.task_id,
                    user_id: userId,
                    log_date: log.log_date,
                    scheduled_start_time: newStartTime,
                    scheduled_end_time: originalEndTime,
                    estimated_hours: afterMeetingHours,
                    notes: `Continuation after meeting: ${meeting.title}`,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  })

                if (insertError) {
                  console.error(`❌ Error creating continuation log:`, insertError)
                } else {
                  
                }
              }
            }
          }

        } else {
          // Partial overlap - adjust the existing log times
          if (logStartHour < meetingStartHour && logEndHour > meetingStartHour) {
            // Task starts before meeting and overlaps with meeting start
            const newEndTime = `${Math.floor(meetingStartHour).toString().padStart(2, '0')}:${Math.floor((meetingStartHour % 1) * 60).toString().padStart(2, '0')}:00`
            const newDuration = meetingStartHour - logStartHour
            
            
            await supabase
              .from('tasks_daily_logs')
              .update({
                scheduled_end_time: newEndTime,
                estimated_hours: newDuration,
                notes: log.notes ? `${log.notes} [End time adjusted due to meeting: ${meeting.title}]` : `End time adjusted due to meeting: ${meeting.title}`,
                updated_at: new Date().toISOString()
              })
              .eq('id', log.id)

          } else if (logStartHour < meetingEndHour && logEndHour > meetingEndHour) {
            // Task starts during meeting and extends after meeting
            const newStartTime = `${Math.floor(meetingEndHour).toString().padStart(2, '0')}:${Math.floor((meetingEndHour % 1) * 60).toString().padStart(2, '0')}:00`
            const newDuration = logEndHour - meetingEndHour
            
            await supabase
              .from('tasks_daily_logs')
              .update({
                scheduled_start_time: newStartTime,
                estimated_hours: newDuration,
                notes: log.notes ? `${log.notes} [Start time adjusted due to meeting: ${meeting.title}]` : `Start time adjusted due to meeting: ${meeting.title}`,
                updated_at: new Date().toISOString()
              })
              .eq('id', log.id)
          }
        }
      }
    }

    console.log(`💰 Total rollover calculation:`, {
      totalHours: totalHoursToRollover,
      affectedTasks: tasksToRollover.size,
      taskBreakdown: Array.from(tasksToRollover.entries()).map(([taskId, hours]) => ({ taskId, hours }))
    })

    // Update tasks to add the rolled-over hours back to their remaining hours
    for (const [taskId, hoursToAdd] of tasksToRollover) {
      

      const { data: currentTask, error: fetchError } = await supabase
        .from('tasks')
        .select('id, title, estimated_hours, hours_completed, hours_remaining')
        .eq('id', taskId)
        .single()

      if (fetchError) {
        console.error(`❌ Error fetching task ${taskId}:`, fetchError)
        continue
      }

      

      // Add the conflicted hours back to the remaining hours
      const newRemainingHours = (currentTask.hours_remaining || 0) + hoursToAdd

      console.log(`🔢 Hours calculation:`, {
        currentRemaining: currentTask.hours_remaining || 0,
        hoursToAdd,
        newRemaining: newRemainingHours
      })

      const { error: updateTaskError } = await supabase
        .from('tasks')
        .update({
          hours_remaining: newRemainingHours,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)

      if (updateTaskError) {
        console.error(`❌ Error updating task ${taskId}:`, updateTaskError)
      } 
    }

    

  } catch (error) {
    console.error('💥 Error handling task rollover:', error)
    console.error('Stack trace:', error.stack)
  }
}

export const updateMeeting = async (id: string, meetingData: any) => {
  try {
    const { data, error } = await supabase
      .from('meetings')
      .update(meetingData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating meeting:', error)
    throw error
  }
}

export const deleteMeeting = async (id: string) => {
  try {
    const { error } = await supabase
      .from('meetings')
      .delete()
      .eq('id', id)

    if (error) throw error
  } catch (error) {
    console.error('Error deleting meeting:', error)
    throw error
  }
}