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
    console.log('🚀 Starting task rollover process...')
    console.log('📅 Meeting details:', {
      title: meeting.title,
      start_time: meeting.start_time,
      end_time: meeting.end_time,
      userId
    })

    const meetingDate = new Date(meeting.start_time)
    const today = startOfDay(new Date())
    
    console.log('🕐 Date comparison:', {
      meetingDate: format(meetingDate, 'yyyy-MM-dd HH:mm:ss'),
      today: format(today, 'yyyy-MM-dd HH:mm:ss'),
      isPast: isBefore(meetingDate, today)
    })
    
    // Only process if the meeting is in the past
    if (!isBefore(meetingDate, today)) {
      console.log('⏭️ Meeting is not in the past, skipping rollover')
      return
    }

    console.log(`🔄 Processing task rollover for past meeting on ${format(meetingDate, 'yyyy-MM-dd')}`)
    
    // Get the meeting time range
    const meetingStart = new Date(meeting.start_time)
    const meetingEnd = new Date(meeting.end_time)
    const meetingStartHour = meetingStart.getHours() + meetingStart.getMinutes() / 60
    const meetingEndHour = meetingEnd.getHours() + meetingEnd.getMinutes() / 60

    console.log('⏰ Meeting time range:', {
      startHour: meetingStartHour,
      endHour: meetingEndHour,
      duration: meetingEndHour - meetingStartHour
    })

    // Find tasks that were scheduled during this meeting time on this date
    const queryDate = format(meetingDate, 'yyyy-MM-dd')
    console.log('🔍 Querying task logs for date:', queryDate)

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

    console.log(`📋 Found ${conflictingTaskLogs?.length || 0} total incomplete task logs for the date`)
    
    if (conflictingTaskLogs) {
      conflictingTaskLogs.forEach((log, index) => {
        console.log(`  ${index + 1}. Task Log ID: ${log.id}, Task: ${log.tasks?.title}, Time: ${log.scheduled_start_time}-${log.scheduled_end_time}`)
      })
    }

    const affectedTaskLogs = conflictingTaskLogs?.filter(log => {
      if (!log.scheduled_start_time || !log.scheduled_end_time) {
        console.log(`⚠️ Skipping log ${log.id} - missing time data`)
        return false
      }
      
      const logStart = parse(log.scheduled_start_time, 'HH:mm:ss', new Date())
      const logEnd = parse(log.scheduled_end_time, 'HH:mm:ss', new Date())
      const logStartHour = logStart.getHours() + logStart.getMinutes() / 60
      const logEndHour = logEnd.getHours() + logEnd.getMinutes() / 60

      console.log(`🔍 Checking task ${log.tasks?.title}:`, {
        taskTime: `${logStartHour}-${logEndHour}`,
        meetingTime: `${meetingStartHour}-${meetingEndHour}`,
        overlaps: (logStartHour < meetingEndHour && logEndHour > meetingStartHour)
      })

      // Check if task overlaps with meeting time
      return (logStartHour < meetingEndHour && logEndHour > meetingStartHour)
    }) || []

    if (affectedTaskLogs.length === 0) {
      console.log('✅ No conflicting tasks found')
      return
    }

    console.log(`🎯 Found ${affectedTaskLogs.length} conflicting task logs:`)
    affectedTaskLogs.forEach((log, index) => {
      console.log(`  ${index + 1}. ${log.tasks?.title} (${log.scheduled_start_time}-${log.scheduled_end_time})`)
    })

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

      console.log(`📊 Calculating overlap for ${log.tasks?.title}:`, {
        taskRange: `${logStartHour}-${logEndHour}`,
        meetingRange: `${meetingStartHour}-${meetingEndHour}`,
        overlapRange: `${overlapStart}-${overlapEnd}`,
        overlapHours
      })

      if (overlapHours > 0) {
        totalHoursToRollover += overlapHours
        
        // Track which tasks need rollover
        const taskId = log.task_id
        const currentRollover = tasksToRollover.get(taskId) || 0
        tasksToRollover.set(taskId, currentRollover + overlapHours)

        // Determine how to handle the conflicted task log
        const isTaskCompletelyWithinMeeting = logStartHour >= meetingStartHour && logEndHour <= meetingEndHour
        const isMeetingCompletelyWithinTask = meetingStartHour >= logStartHour && meetingEndHour <= logEndHour
        
        console.log(`🔍 Conflict analysis for ${log.tasks?.title}:`, {
          isTaskCompletelyWithinMeeting,
          isMeetingCompletelyWithinTask,
          taskStartsBeforeMeeting: logStartHour < meetingStartHour,
          taskEndsAfterMeeting: logEndHour > meetingEndHour
        })

        if (isTaskCompletelyWithinMeeting) {
          // Task is completely within meeting time - mark as conflicted
          console.log(`📝 Task completely conflicts with meeting - updating log ${log.id}`)
          await supabase
            .from('tasks_daily_logs')
            .update({
              notes: log.notes ? `${log.notes} [Completely conflicted with meeting: ${meeting.title}]` : `Completely conflicted with meeting: ${meeting.title}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', log.id)

        } else if (isMeetingCompletelyWithinTask) {
          // Meeting splits the task - need to update existing log and potentially create new ones
          console.log(`✂️ Meeting splits task - updating existing log and creating new segments`)
          
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
            console.log(`📝 Updating existing log to end at ${newEndTime}`)
            
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
                console.log(`⚠️ Conflict detected for time slot ${newStartTime} to ${originalEndTime}, skipping continuation log creation`)
              } else {
                console.log(`➕ Creating new log segment from ${newStartTime} to ${originalEndTime}`)
                
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
                  console.log(`✅ Created continuation log for ${afterMeetingHours}h`)
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
            
            console.log(`📝 Adjusting task end time to ${newEndTime} (${newDuration}h)`)
            
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
            
            console.log(`📝 Adjusting task start time to ${newStartTime} (${newDuration}h)`)
            
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
      console.log(`🔄 Processing rollover for task ${taskId}: ${hoursToAdd}h`)

      const { data: currentTask, error: fetchError } = await supabase
        .from('tasks')
        .select('id, title, estimated_hours, hours_completed, hours_remaining')
        .eq('id', taskId)
        .single()

      if (fetchError) {
        console.error(`❌ Error fetching task ${taskId}:`, fetchError)
        continue
      }

      console.log(`📋 Current task state:`, currentTask)

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
      } else {
        console.log(`✅ Rolled over ${hoursToAdd}h for task "${currentTask.title}" (${taskId}). New remaining: ${newRemainingHours}h`)
      }
    }

    console.log(`🎯 Rollover complete! Successfully rolled over ${totalHoursToRollover}h total across ${tasksToRollover.size} tasks`)

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