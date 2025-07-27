import { supabase } from '../lib/supabase'

export const fetchAllCalendarData = async (userId: string) => {
  console.log('⚡ Fetching all calendar data sources in parallel...')
  
  // Fetch all data sources in parallel
  const [habitsResult, sessionsResult, projectsResult, meetingsResult, tasksDailyLogsResult, settingsResult] = await Promise.all([
    supabase.from('habits').select('*, habits_daily_logs(*)').eq('user_id', userId).eq('is_visible', true),
    supabase.from('sessions').select('*, projects(*)').eq('user_id', userId),
    supabase.from('projects').select('*').eq('user_id', userId),
    supabase.from('meetings').select('*').eq('user_id', userId),
    supabase.from('tasks_daily_logs').select('*, tasks!inner(*, projects(*))').eq('user_id', userId),
    supabase.from('user_settings').select('*').eq('user_id', userId).single()
  ])

  const habits = habitsResult.data || []
  const sessions = sessionsResult.data || []
  const projects = projectsResult.data || []
  const meetings = meetingsResult.data || []
  const tasksDailyLogs = tasksDailyLogsResult.data || []
  const settings = settingsResult.data

  console.log(`📊 Fetched: ${habits.length} habits, ${sessions.length} sessions, ${projects.length} projects, ${meetings.length} meetings, ${tasksDailyLogs.length} task daily logs, settings: ${settings ? 'loaded' : 'not found'}`)

  return { habits, sessions, projects, meetings, tasksDailyLogs, settings }
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