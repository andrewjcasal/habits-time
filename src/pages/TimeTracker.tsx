import React, { useState, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Play,
  Square,
  MoreHorizontal,
  Edit,
  ArrowRight,
  Scissors,
  Copy,
  Check,
} from 'lucide-react'
import { format, startOfDay, endOfDay, subDays, addDays } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import SplitLogModal from '../components/SplitLogModal'
import AddLogModal from '../components/AddLogModal'
import TimeLogRow from '../components/TimeLogRow'

interface TimeLog {
  id: string
  habits_activity_types: {
    id: string
    name: string
    is_favorite?: boolean
  }
  start_time: string
  end_time: string | null
  duration?: number
  categories?: Array<{
    id: string
    name: string
    color: string
    is_favorite?: boolean
  }>
}

interface CategorySummary {
  name: string
  color: string
  totalTime: number
}

interface ActivityType {
  id: string
  name: string
  is_favorite?: boolean
}

interface FavoriteSummary {
  id: string
  name: string
  type: 'activity' | 'category'
  totalTime: number
  color?: string
}

const TimeTracker = () => {
  const { user } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([])
  const [updating, setUpdating] = useState<string | null>(null)
  const [favoriteCategories, setFavoriteCategories] = useState<CategorySummary[]>([])
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  const [splitting, setSplitting] = useState<string | null>(null)
  const [splitModalLog, setSplitModalLog] = useState<TimeLog | null>(null)
  const [splitTime, setSplitTime] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [showAddLogModal, setShowAddLogModal] = useState(false)
  const [newLogActivityType, setNewLogActivityType] = useState<string>('')
  const [newLogStartTime, setNewLogStartTime] = useState<string>('')
  const [newLogEndTime, setNewLogEndTime] = useState<string>('')
  const [newLogIsInProgress, setNewLogIsInProgress] = useState(false)
  const [creatingLog, setCreatingLog] = useState(false)
  const [activityTypeInput, setActivityTypeInput] = useState<string>('')
  const [filteredActivityTypes, setFilteredActivityTypes] = useState<ActivityType[]>([])

  // Calculate total time for the day
  const totalTime = timeLogs.reduce((acc, log) => {
    if (log.end_time) {
      const start = new Date(log.start_time)
      const end = new Date(log.end_time)
      return acc + (end.getTime() - start.getTime())
    }
    return acc
  }, 0)

  // Calculate category summaries
  const categorySummaries = timeLogs
    .reduce((acc, log) => {
      if (log.end_time && log.categories) {
        const duration = new Date(log.end_time).getTime() - new Date(log.start_time).getTime()

        log.categories.forEach(category => {
          const existing = acc.find(c => c.name === category.name)
          if (existing) {
            existing.totalTime += duration
          } else {
            acc.push({
              name: category.name,
              color: category.color,
              totalTime: duration,
            })
          }
        })
      }
      return acc
    }, [] as CategorySummary[])
    .sort((a, b) => b.totalTime - a.totalTime)

  // Calculate favorite summaries (both activity types and categories)
  const favoriteSummaries = React.useMemo(() => {
    const summaries: FavoriteSummary[] = []

    // Add favorite activity types
    timeLogs.forEach(log => {
      if (log.end_time && log.habits_activity_types?.is_favorite) {
        const duration = new Date(log.end_time).getTime() - new Date(log.start_time).getTime()
        const existing = summaries.find(
          s => s.id === log.habits_activity_types.id && s.type === 'activity'
        )

        if (existing) {
          existing.totalTime += duration
        } else {
          summaries.push({
            id: log.habits_activity_types.id,
            name: log.habits_activity_types.name,
            type: 'activity',
            totalTime: duration,
          })
        }
      }
    })

    // Add favorite categories
    timeLogs.forEach(log => {
      if (log.end_time && log.categories) {
        const duration = new Date(log.end_time).getTime() - new Date(log.start_time).getTime()

        log.categories.forEach(category => {
          if (category.is_favorite) {
            const existing = summaries.find(s => s.id === category.id && s.type === 'category')

            if (existing) {
              existing.totalTime += duration
            } else {
              summaries.push({
                id: category.id,
                name: category.name,
                type: 'category',
                totalTime: duration,
                color: category.color,
              })
            }
          }
        })
      }
    })

    return summaries.sort((a, b) => b.totalTime - a.totalTime)
  }, [timeLogs])

  // Get logs for a specific category
  const getLogsForCategory = (categoryName: string) => {
    return timeLogs
      .filter(log => log.categories?.some(category => category.name === categoryName))
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
  }

  // Check if category has many logs (for scroll indicator)
  const categoryHasManyLogs = (categoryName: string) => {
    return getLogsForCategory(categoryName).length > 3
  }

  const copyToClipboard = async () => {
    const dateStr = format(selectedDate, 'EEEE, MMMM d, yyyy')
    const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

    let content = `# Time Tracking Report${isToday ? ' (Today)' : ''}\n`
    content += `**Date:** ${dateStr}\n\n`
    content += `**Time:** ${format(new Date(), 'h:mm a')}\n\n`

    // Summary Section
    content += `## Summary\n`
    content += `- **Total Time Logged:** ${formatDuration(totalTime)}\n`
    content += `- **Number of Logs:** ${timeLogs.length}\n\n`

    // Category Breakdown
    if (categorySummaries.length > 0) {
      content += `## Time by Category\n`
      categorySummaries.forEach(category => {
        content += `- **${category.name}:** ${formatDuration(category.totalTime)}\n`
      })
      content += `\n`
    }

    // Favorites Breakdown
    if (favoriteSummaries.length > 0) {
      content += `## Favorites\n`
      favoriteSummaries.forEach(favorite => {
        content += `- **${favorite.name}** (${favorite.type}): ${formatDuration(
          favorite.totalTime
        )}\n`
      })
      content += `\n`
    }

    // Individual Logs
    if (timeLogs.length > 0) {
      content += `## Individual Logs\n`
      timeLogs.forEach((log, index) => {
        content += `${index + 1}. **${log.habits_activity_types?.name}**\n`
        content += `   - Time: ${formatTime(log.start_time)}`
        if (log.end_time) {
          content += ` → ${formatTime(log.end_time)}`
          if (log.duration) {
            content += ` (${formatDuration(log.duration)})`
          }
        } else {
          content += ` → *In Progress*`
        }
        content += `\n`

        // Add categories if available
        if (log.categories && log.categories.length > 0) {
          content += `   - Categories: ${log.categories.map(c => c.name).join(', ')}\n`
        }
        content += `\n`
      })
    }

    // Add context for ChatGPT
    content += `---\n`
    content += `*Please analyze this time tracking data and provide insights about productivity patterns, time allocation, and suggestions for improvement.*`

    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      setError('Failed to copy to clipboard')
    }
  }

  const formatDuration = (milliseconds: number) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60))
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  const formatTime = (timeString: string) => {
    return format(new Date(timeString), 'h:mm a')
  }

  const fetchActivityTypes = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('habits_activity_types')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name')

      if (error) throw error
      setActivityTypes(data || [])
    } catch (err) {
      console.error('Error fetching activity types:', err)
    }
  }

  const openSplitModal = (timeLogId: string) => {
    const log = timeLogs.find(l => l.id === timeLogId)
    if (!log) {
      setError('Log not found')
      return
    }

    setSplitModalLog(log)
    setOpenMenuId(null)

    // Set default split time
    const startTime = new Date(log.start_time)
    let defaultTime: string

    if (log.end_time) {
      // For completed logs, set to middle
      const endTime = new Date(log.end_time)
      const duration = endTime.getTime() - startTime.getTime()
      const midTime = new Date(startTime.getTime() + duration / 2)
      defaultTime = format(midTime, 'HH:mm')
    } else {
      // For in-progress logs, set to current time
      const now = new Date()
      defaultTime = format(now, 'HH:mm')
    }

    setSplitTime(defaultTime)
  }

  const openAddLogModal = () => {
    setShowAddLogModal(true)
    // Set default start time to current time
    const now = new Date()
    setNewLogStartTime(format(now, 'HH:mm'))
    setNewLogEndTime('')
    setNewLogActivityType('')
    setNewLogIsInProgress(false)
  }

  const closeAddLogModal = () => {
    setShowAddLogModal(false)
    setNewLogActivityType('')
    setNewLogStartTime('')
    setNewLogEndTime('')
    setNewLogIsInProgress(false)
  }

  const createNewLog = async () => {
    if (!user || !newLogActivityType.trim() || !newLogStartTime) return

    setCreatingLog(true)
    try {
      // Parse start time
      const [startHours, startMinutes] = newLogStartTime.split(':').map(Number)
      const startDateTime = new Date(selectedDate)
      startDateTime.setHours(startHours, startMinutes, 0, 0)

      // Parse end time if provided
      let endDateTime: Date | null = null
      if (!newLogIsInProgress && newLogEndTime) {
        const [endHours, endMinutes] = newLogEndTime.split(':').map(Number)
        endDateTime = new Date(selectedDate)
        endDateTime.setHours(endHours, endMinutes, 0, 0)

        // Handle day crossing - if end time is before start time, assume next day
        if (endDateTime <= startDateTime) {
          endDateTime.setDate(endDateTime.getDate() + 1)
        }

        // Validate end time is after start time
        if (endDateTime <= startDateTime) {
          setError('End time must be after start time')
          return
        }
      }

      // Find or create activity type
      let activityTypeId: string
      const existingActivityType = activityTypes.find(
        at => at.name.toLowerCase() === newLogActivityType.trim().toLowerCase()
      )

      if (existingActivityType) {
        activityTypeId = existingActivityType.id
      } else {
        // Create new activity type
        const { data: newActivityType, error: createError } = await supabase
          .from('habits_activity_types')
          .insert([
            {
              name: newLogActivityType.trim(),
              user_id: user.id,
            },
          ])
          .select()
          .single()

        if (createError) throw createError
        activityTypeId = newActivityType.id
      }

      // Create the time log
      const logData = {
        activity_type_id: activityTypeId,
        user_id: user.id,
        start_time: startDateTime.toISOString(),
        ...(endDateTime && { end_time: endDateTime.toISOString() }),
      }

      const { error: insertError } = await supabase.from('habits_time_logs').insert([logData])

      if (insertError) throw insertError

      // Refresh data and close modal
      await fetchTimeLogs()
      await fetchActivityTypes()
      closeAddLogModal()
    } catch (err) {
      console.error('Error creating time log:', err)
      setError('Failed to create time log')
    } finally {
      setCreatingLog(false)
    }
  }

  const startEditingActivityType = (logId: string, currentName: string) => {
    setActivityTypeInput(currentName)
    setFilteredActivityTypes(activityTypes)
  }

  const handleActivityTypeInputChange = (value: string) => {
    setActivityTypeInput(value)

    if (value.trim() === '') {
      setFilteredActivityTypes(activityTypes)
    } else {
      const filtered = activityTypes.filter(type =>
        type.name.toLowerCase().includes(value.toLowerCase())
      )
      setFilteredActivityTypes(filtered)
    }
  }

  const selectActivityType = async (logId: string, activityTypeName: string) => {
    if (!user) return

    setUpdating(logId)
    try {
      // Find existing activity type or create new one
      let activityTypeId: string
      const existingActivityType = activityTypes.find(
        at => at.name.toLowerCase() === activityTypeName.toLowerCase()
      )

      if (existingActivityType) {
        activityTypeId = existingActivityType.id
      } else {
        // Create new activity type
        const { data: newActivityType, error: createError } = await supabase
          .from('habits_activity_types')
          .insert([
            {
              name: activityTypeName.trim(),
              user_id: user.id,
            },
          ])
          .select()
          .single()

        if (createError) throw createError
        activityTypeId = newActivityType.id
      }

      // Update the time log
      const { error } = await supabase
        .from('habits_time_logs')
        .update({ activity_type_id: activityTypeId })
        .eq('id', logId)
        .eq('user_id', user.id)

      if (error) throw error

      // Refresh data
      await fetchTimeLogs()
      await fetchActivityTypes()
      setOpenMenuId(null)
    } catch (err) {
      console.error('Error updating activity type:', err)
      setError('Failed to update activity type')
    } finally {
      setUpdating(null)
    }
  }

  const splitTimeLog = async () => {
    if (!user || !splitModalLog) return

    setSplitting(splitModalLog.id)
    try {
      const startTime = new Date(splitModalLog.start_time)
      const endTime = splitModalLog.end_time ? new Date(splitModalLog.end_time) : null

      // Parse the split time and handle day crossing
      const [hours, minutes] = splitTime.split(':').map(Number)
      const splitDateTime = new Date(startTime)
      splitDateTime.setHours(hours, minutes, 0, 0)

      // If split time appears to be before start time, it's likely the next day
      if (splitDateTime < startTime) {
        splitDateTime.setDate(splitDateTime.getDate() + 1)
      }

      // Validate split time
      if (splitDateTime <= startTime) {
        setError('Split time must be after start time')
        return
      }

      // For completed logs, validate that split time is before end time
      if (endTime && splitDateTime >= endTime) {
        setError('Split time must be before end time')
        return
      }

      // For in-progress logs, validate that split time is not in the future
      if (!endTime && splitDateTime > new Date()) {
        setError('Split time cannot be in the future for in-progress logs')
        return
      }

      // Update the original log to end at split time
      const { error: updateError } = await supabase
        .from('habits_time_logs')
        .update({ end_time: splitDateTime.toISOString() })
        .eq('id', splitModalLog.id)
        .eq('user_id', user.id)

      if (updateError) throw updateError

      // Create a new log for the second part
      const newLogData = {
        activity_type_id: splitModalLog.habits_activity_types.id,
        user_id: user.id,
        start_time: splitDateTime.toISOString(),
        // Only set end_time if the original log was completed
        ...(endTime && { end_time: endTime.toISOString() }),
      }

      const { error: insertError } = await supabase.from('habits_time_logs').insert([newLogData])

      if (insertError) throw insertError

      // Refresh the logs and close modal
      await fetchTimeLogs()
      setSplitModalLog(null)
      setSplitTime('')
    } catch (err) {
      console.error('Error splitting time log:', err)
      setError('Failed to split time log')
    } finally {
      setSplitting(null)
    }
  }

  const fetchTimeLogs = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const startOfSelectedDay = startOfDay(selectedDate)
      const endOfSelectedDay = endOfDay(selectedDate)

      const { data, error } = await supabase
        .from('habits_time_logs')
        .select(
          `
          *,
          habits_activity_types (
            id,
            name,
            is_favorite,
            habits_activity_type_categories (
              habits_categories (
                id,
                name,
                color,
                is_favorite
              )
            )
          )
        `
        )
        .eq('user_id', user.id)
        .gte('start_time', startOfSelectedDay.toISOString())
        .lte('start_time', endOfSelectedDay.toISOString())
        .order('start_time', { ascending: false })

        console.log('data', data)
      if (error) {
        throw error
      }

      // Calculate duration for completed logs and flatten categories
      const logsWithDuration =
        data?.map(log => ({
          ...log,
          duration: log.end_time
            ? new Date(log.end_time).getTime() - new Date(log.start_time).getTime()
            : null,
          categories:
            log.habits_activity_types?.habits_activity_type_categories
              ?.map((atc: any) => atc.habits_categories)
              .filter(Boolean) || [],
        })) || []

      setTimeLogs(logsWithDuration)
    } catch (err) {
      console.error('Error fetching time logs:', err)
      setError('Failed to load time logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTimeLogs()
    fetchActivityTypes()
  }, [selectedDate, user])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId) {
        const target = event.target as Element
        // Don't close if clicking inside the dropdown menu
        if (!target.closest('[data-dropdown-menu="true"]')) {
          setOpenMenuId(null)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenuId])

  const navigateDate = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => (direction === 'prev' ? subDays(prev, 1) : addDays(prev, 1)))
  }

  return (
    <div className="p-1 pt-4 max-w-4xl mx-auto">
      {/* Date Navigation */}
      <div className="bg-white rounded-lg border border-neutral-200 p-2 mb-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateDate('prev')}
            className="hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-neutral-600" />
          </button>

          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-neutral-500" />
            <h2 className="text-sm font-semibold text-neutral-900">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h2>
          </div>

          <button
            onClick={() => navigateDate('next')}
            className="hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-neutral-600" />
          </button>
          {/* 
          {!isToday && (
            <button onClick={goToToday} className="btn btn-outline text-sm">
              Today
            </button>
          )} */}

          {/* Copy to Clipboard Button */}
          <button
            onClick={copyToClipboard}
            className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors flex items-center text-neutral-600 hover:text-neutral-900"
            title="Copy data for ChatGPT analysis"
          >
            {copied ? (
              <Check className="h-3 w-3 text-success-600" />
            ) : (
              <Copy className="h-3 w-3 text-blue-500" />
            )}
          </button>
        </div>

        {/* Daily Summary */}
        <div className="mt-2 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-600">Total time logged:</span>
            <span className="font-semibold text-neutral-900">{formatDuration(totalTime)}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm text-neutral-600">Number of logs:</span>
            <span className="font-semibold text-neutral-900">{timeLogs.length}</span>
          </div>

          {/* Category and Favorites Breakdown */}
          {(categorySummaries.length > 0 || favoriteSummaries.length > 0) && (
            <div className="mt-2 pt-2 border-t border-neutral-200">
              <div className="flex flex-row gap-2">
                {/* Time by Category */}
                {categorySummaries.length > 0 && (
                  <div className="flex flex-col gap-1 w-[54%]">
                    <div className="text-xs font-medium text-neutral-700 mb-1">
                      Time by Category
                    </div>
                    <div className="space-y-1">
                      {categorySummaries.map(category => (
                        <div key={category.name} className="relative">
                          <div
                            className="flex items-center justify-between cursor-pointer hover:bg-neutral-50 rounded transition-colors"
                            onMouseEnter={() => setHoveredCategory(category.name)}
                            onMouseLeave={e => {
                              // Don't hide if moving to the popover
                              const relatedTarget = e.relatedTarget as Element
                              if (!relatedTarget?.closest('[data-popover="true"]')) {
                                setHoveredCategory(null)
                              }
                            }}
                          >
                            <div className="flex items-center space-x-1">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: category.color }}
                              ></div>
                              <span className="text-xs text-neutral-600 truncate">
                                {category.name}
                              </span>
                            </div>
                            <span className="text-xs font-medium text-neutral-900">
                              {formatDuration(category.totalTime)}
                            </span>
                          </div>

                          {/* Category Logs Popover */}
                          <AnimatePresence>
                            {hoveredCategory === category.name && (
                              <motion.div
                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                className="absolute top-full left-0 mt-1 z-50 w-56 bg-white rounded-lg shadow-lg border border-neutral-200 p-2"
                                style={{ zIndex: 1000 }}
                                data-popover="true"
                                onMouseEnter={() => setHoveredCategory(category.name)}
                                onMouseLeave={() => setHoveredCategory(null)}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center space-x-1">
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{
                                        backgroundColor: category.color,
                                      }}
                                    ></div>
                                    <div className="text-xs font-medium text-neutral-900">
                                      {category.name} Logs
                                    </div>
                                  </div>
                                  {categoryHasManyLogs(category.name) && (
                                    <div className="text-xs text-neutral-500">
                                      {getLogsForCategory(category.name).length} logs
                                    </div>
                                  )}
                                </div>

                                <div className="max-h-32 overflow-y-auto space-y-0.5 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent">
                                  {getLogsForCategory(category.name).map(log => (
                                    <div
                                      key={log.id}
                                      className="p-1.5 bg-neutral-50 rounded text-xs hover:bg-neutral-100 transition-colors"
                                    >
                                      <div className="font-medium text-neutral-900">
                                        {log.habits_activity_types?.name}
                                      </div>
                                      <div className="flex items-center justify-between text-neutral-600 mt-0.5">
                                        <div className="flex items-center gap-0.5">
                                          <span>{formatTime(log.start_time)}</span>
                                          {log.end_time && (
                                            <>
                                              <ArrowRight className="h-2 w-2" />
                                              <span>{formatTime(log.end_time)}</span>
                                            </>
                                          )}
                                        </div>
                                        {log.duration && (
                                          <span className="font-medium">
                                            {formatDuration(log.duration)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Arrow pointing up to category */}
                                <div className="absolute bottom-full left-2">
                                  <div className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-white"></div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Favorites */}
                {favoriteSummaries.length > 0 && (
                  <div className="flex flex-col gap-1 w-[46%]">
                    <div className="text-xs font-medium text-neutral-700 mb-1">Favorites</div>
                    <div className="space-y-1">
                      {favoriteSummaries.map(favorite => (
                        <div
                          key={`${favorite.type}-${favorite.id}`}
                          className="flex items-center justify-between gap-1"
                        >
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-neutral-600 truncate">
                              {favorite.name}
                            </span>
                          </div>
                          <span className="text-xs font-medium text-neutral-900">
                            {formatDuration(favorite.totalTime)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Time Logs */}
      <div className="bg-white rounded-lg border border-neutral-200">
        <div className="px-2 py-1 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="font-semibold text-neutral-900">Time Logs</h3>
          <button
            onClick={openAddLogModal}
            className="p-1 hover:bg-neutral-100 rounded transition-colors text-neutral-600 hover:text-neutral-900"
            title="Add New Log"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </button>
        </div>

        <div className="divide-y divide-neutral-200">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="text-neutral-600 mt-2">Loading time logs...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-error-600">{error}</p>
              <button onClick={fetchTimeLogs} className="mt-2 btn btn-outline text-sm">
                Try Again
              </button>
            </div>
          ) : timeLogs.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-600">No time logs for this date</p>
              <p className="text-sm text-neutral-500 mt-1">
                Start tracking your time to see logs here
              </p>
            </div>
          ) : (
            timeLogs.map((log, index) => (
              <TimeLogRow
                key={log.id}
                log={log}
                index={index}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                updating={updating}
                splitting={splitting}
                activityTypeInput={activityTypeInput}
                filteredActivityTypes={filteredActivityTypes}
                formatTime={formatTime}
                formatDuration={formatDuration}
                openSplitModal={openSplitModal}
                startEditingActivityType={startEditingActivityType}
                handleActivityTypeInputChange={handleActivityTypeInputChange}
                selectActivityType={selectActivityType}
              />
            ))
          )}
        </div>
      </div>

      <SplitLogModal
        splitModalLog={splitModalLog}
        setSplitModalLog={setSplitModalLog}
        splitTime={splitTime}
        setSplitTime={setSplitTime}
        splitting={splitting}
        splitTimeLog={splitTimeLog}
        formatTime={formatTime}
        formatDuration={formatDuration}
      />

      <AddLogModal
        showAddLogModal={showAddLogModal}
        closeAddLogModal={closeAddLogModal}
        selectedDate={selectedDate}
        newLogActivityType={newLogActivityType}
        setNewLogActivityType={setNewLogActivityType}
        newLogStartTime={newLogStartTime}
        setNewLogStartTime={setNewLogStartTime}
        newLogEndTime={newLogEndTime}
        setNewLogEndTime={setNewLogEndTime}
        newLogIsInProgress={newLogIsInProgress}
        setNewLogIsInProgress={setNewLogIsInProgress}
        creatingLog={creatingLog}
        createNewLog={createNewLog}
        activityTypes={activityTypes}
      />
    </div>
  )
}

export default TimeTracker
