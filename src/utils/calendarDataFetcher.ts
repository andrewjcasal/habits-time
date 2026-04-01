import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

export const fetchAllCalendarData = async (userId: string) => {
  
  
  // Add timeout wrapper for each query
  const withTimeout = <T>(promise: Promise<T>, ms: number = 5000): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Query timeout after ${ms}ms`)), ms)
      )
    ])
  }

  try {
    // Fetch all data sources in parallel with timeout protection
    const [habitsResult, sessionsResult, projectsResult, meetingsResult, tasksDailyLogsResult, tasksResult, settingsResult, calendarNotesResult, habitNotesResult, categoryBuffersResult] = await Promise.allSettled([
      withTimeout(supabase.from('cassian_habits').select('*, habits_daily_logs:cassian_habits_daily_logs(*), habits_types:cassian_habits_types(*), subhabits:cassian_subhabits(*), habit_todoist_tasks:cassian_habit_todoist_tasks(*)').eq('user_id', userId).eq('is_visible', true).or('is_archived.eq.false,is_archived.is.null')),
      withTimeout(supabase.from('cassian_sessions').select('*, projects:cassian_projects(*)').eq('user_id', userId)),
      withTimeout(supabase.from('cassian_projects').select('*').eq('user_id', userId).neq('status', 'archived')),
      withTimeout(supabase.from('cassian_meetings').select('*, meeting_habits:cassian_meeting_habits(habit_id)').eq('user_id', userId).or('is_ignored.is.null,is_ignored.eq.false')),
      withTimeout(supabase.from('cassian_tasks_daily_logs').select('*, tasks:cassian_tasks(*, projects:cassian_projects(*))').eq('user_id', userId)),
      withTimeout(supabase.from('cassian_tasks').select('*, projects:cassian_projects!inner(*)').eq('user_id', userId).neq('projects.status', 'archived')),
      withTimeout(supabase.from('cassian_user_settings').select('*').eq('user_id', userId).single()),
      withTimeout(supabase.from('cassian_calendar_notes').select('*, habits_notes:cassian_habits_notes!calendar_notes_note_id_fkey(id, content, created_at)').order('pinned_date', { ascending: true })),
      withTimeout(supabase.from('cassian_habits_notes').select('*').order('created_at', { ascending: false })),
      withTimeout(supabase.from('cassian_category_buffers').select('*, meeting_categories:cassian_meeting_categories(id, name, color)').eq('user_id', userId))
    ])

    // Extract data with fallbacks
    const habits = habitsResult.status === 'fulfilled' ? (habitsResult.value.data || []) : []
    const sessions = sessionsResult.status === 'fulfilled' ? (sessionsResult.value.data || []) : []
    const projects = projectsResult.status === 'fulfilled' ? (projectsResult.value.data || []) : []
    const meetings = meetingsResult.status === 'fulfilled' ? (meetingsResult.value.data || []) : []
    const tasksDailyLogs = tasksDailyLogsResult.status === 'fulfilled' ? (tasksDailyLogsResult.value.data || []) : []
    const tasks = tasksResult.status === 'fulfilled' ? (tasksResult.value.data || []) : []
    const settings = settingsResult.status === 'fulfilled' ? settingsResult.value.data : null
    const calendarNotes = calendarNotesResult.status === 'fulfilled' ? (calendarNotesResult.value.data || []) : []
    const habitNotes = habitNotesResult.status === 'fulfilled' ? (habitNotesResult.value.data || []) : []
    const categoryBuffers = categoryBuffersResult.status === 'fulfilled' ? (categoryBuffersResult.value.data || []) : []

    // Log any failures
    const failures = [
      habitsResult.status === 'rejected' && 'habits',
      sessionsResult.status === 'rejected' && 'sessions',
      projectsResult.status === 'rejected' && 'projects',
      meetingsResult.status === 'rejected' && 'meetings',
      tasksDailyLogsResult.status === 'rejected' && 'tasksDailyLogs',
      tasksResult.status === 'rejected' && 'tasks',
      settingsResult.status === 'rejected' && 'settings',
      calendarNotesResult.status === 'rejected' && 'calendarNotes',
      habitNotesResult.status === 'rejected' && 'habitNotes',
      categoryBuffersResult.status === 'rejected' && 'categoryBuffers'
    ].filter(Boolean)
    
    if (failures.length > 0) {
      console.warn(`⚠️ Failed to fetch: ${failures.join(', ')}`)
    }

    

    return { habits, sessions, projects, meetings, tasksDailyLogs, tasks, settings, calendarNotes, habitNotes, categoryBuffers }
  } catch (error) {
    console.error('Critical error fetching calendar data:', error)
    // Return minimal data to prevent complete failure
    return { habits: [], sessions: [], projects: [], meetings: [], tasksDailyLogs: [], tasks: [], settings: null, calendarNotes: [], habitNotes: [], categoryBuffers: [] }
  }
}

export const fetchTasksForProjects = async (userId: string, projects: any[], sessions: any[]) => {
  
  
  if (projects.length === 0) return []

  // Hide ALL tasks from projects that have ANY sessions (past, present, or future)
  const projectsWithSessions = new Set(sessions.map(s => s.project_id))
  const projectsWithoutSessions = projects.filter(p => !projectsWithSessions.has(p.id))

  if (projectsWithoutSessions.length === 0) return []

  const activeProjects = projectsWithoutSessions.filter(p => p.status !== 'archived')
  if (activeProjects.length === 0) return []

  const projectIds = activeProjects.map(p => p.id)
  const tasksResult = await supabase
    .from('cassian_tasks')
    .select(`*, projects:cassian_projects!inner(*)`)
    .in('project_id', projectIds)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (tasksResult.error) {
    console.error('Error fetching tasks:', tasksResult.error)
    return []
  }

  const tasks = (tasksResult.data || []).map(task => ({
    ...task,
    project: task.projects
  }))

  
  return tasks
}