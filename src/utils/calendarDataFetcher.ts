import { supabase } from '../lib/supabase'

export const fetchAllCalendarData = async (userId: string) => {
  console.log('⚡ Fetching all calendar data sources in parallel...')
  
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
    const [habitsResult, sessionsResult, projectsResult, meetingsResult, tasksDailyLogsResult, settingsResult] = await Promise.allSettled([
      withTimeout(supabase.from('habits').select('*, habits_daily_logs(*)').eq('user_id', userId).eq('is_visible', true)),
      withTimeout(supabase.from('sessions').select('*, projects(*)').eq('user_id', userId)),
      withTimeout(supabase.from('projects').select('*').eq('user_id', userId)),
      withTimeout(supabase.from('meetings').select('*').eq('user_id', userId)),
      withTimeout(supabase.from('tasks_daily_logs').select('*, tasks!inner(*, projects(*))').eq('user_id', userId)),
      withTimeout(supabase.from('user_settings').select('*').eq('user_id', userId).single())
    ])

    // Extract data with fallbacks
    const habits = habitsResult.status === 'fulfilled' ? (habitsResult.value.data || []) : []
    const sessions = sessionsResult.status === 'fulfilled' ? (sessionsResult.value.data || []) : []
    const projects = projectsResult.status === 'fulfilled' ? (projectsResult.value.data || []) : []
    const meetings = meetingsResult.status === 'fulfilled' ? (meetingsResult.value.data || []) : []
    const tasksDailyLogs = tasksDailyLogsResult.status === 'fulfilled' ? (tasksDailyLogsResult.value.data || []) : []
    const settings = settingsResult.status === 'fulfilled' ? settingsResult.value.data : null

    // Log any failures
    const failures = [
      habitsResult.status === 'rejected' && 'habits',
      sessionsResult.status === 'rejected' && 'sessions', 
      projectsResult.status === 'rejected' && 'projects',
      meetingsResult.status === 'rejected' && 'meetings',
      tasksDailyLogsResult.status === 'rejected' && 'tasksDailyLogs',
      settingsResult.status === 'rejected' && 'settings'
    ].filter(Boolean)
    
    if (failures.length > 0) {
      console.warn(`⚠️ Failed to fetch: ${failures.join(', ')}`)
    }

    console.log(`📊 Fetched: ${habits.length} habits, ${sessions.length} sessions, ${projects.length} projects, ${meetings.length} meetings, ${tasksDailyLogs.length} task daily logs, settings: ${settings ? 'loaded' : 'not found'}`)

    return { habits, sessions, projects, meetings, tasksDailyLogs, settings }
  } catch (error) {
    console.error('Critical error fetching calendar data:', error)
    // Return minimal data to prevent complete failure
    return { habits: [], sessions: [], projects: [], meetings: [], tasksDailyLogs: [], settings: null }
  }
}

export const fetchTasksForProjects = async (userId: string, projects: any[], sessions: any[]) => {
  console.log('⚡ Fetching tasks for projects without sessions...')
  
  if (projects.length === 0) return []

  const projectsWithSessions = new Set(sessions.map(s => s.project_id))
  const projectsWithoutSessions = projects.filter(p => !projectsWithSessions.has(p.id))

  if (projectsWithoutSessions.length === 0) return []

  const projectIds = projectsWithoutSessions.map(p => p.id)
  const tasksResult = await supabase
    .from('tasks')
    .select(`*, projects!inner(*)`)
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

  console.log(`📝 Fetched ${tasks.length} tasks`)
  return tasks
}