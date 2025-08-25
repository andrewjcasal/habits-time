import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Project, Task, Session } from '../types'
import { useUserContext } from '../contexts/UserContext'

// Single hook that consolidates all Projects page data fetching
export function useProjectsPageData(selectedProjectId?: string) {
  const { user, loading: userLoading, error: userError } = useUserContext()
  
  // Data states
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  
  // Loading states
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [tasksLoading, setTasksLoading] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  
  // Error state
  const [error, setError] = useState<string | null>(null)

  // Define fetchProjects function that can be used both internally and externally
  const fetchProjects = useCallback(async (includeArchived = false) => {
    if (!user) return

    try {
      setProjectsLoading(true)
      setError(null)

      console.log('123 fetching')
      let query = supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!includeArchived) {
        query = query.neq('status', 'archived')
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      setProjects(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects')
    } finally {
      setProjectsLoading(false)
    }
  }, [user?.id])

  // Fetch projects once when user is available
  useEffect(() => {
    if (userLoading || !user) {
      setProjectsLoading(false)
      return
    }

    console.log('234 users', user.id)
    console.log('234 userLoading', userLoading)
    console.log('234 project', projects)
    
    fetchProjects()
  }, [user?.id, userLoading, fetchProjects])

  // Fetch tasks and sessions when selectedProjectId changes
  useEffect(() => {
    if (userLoading || !user || !selectedProjectId) {
      setTasks([])
      setSessions([])
      setTasksLoading(false)
      setSessionsLoading(false)
      return
    }

    const fetchProjectData = async () => {
      try {
        setTasksLoading(true)
        setSessionsLoading(true)
        setError(null)

        // Fetch tasks and sessions in parallel with a single user context
        const [tasksResponse, sessionsResponse] = await Promise.all([
          supabase
            .from('tasks')
            .select('*')
            .eq('project_id', selectedProjectId)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          
          supabase
            .from('sessions')
            .select(`
              *, 
              projects(name, color),
              session_tasks(id, task_id, tasks(id, title, status))
            `)
            .eq('project_id', selectedProjectId)
            .eq('user_id', user.id)
            .order('scheduled_date', { ascending: true })
        ])

        // Handle tasks
        if (tasksResponse.error) {
          setError(tasksResponse.error.message)
        } else {
          // Group tasks by parent/child relationship
          const allTasks = tasksResponse.data || []
          const taskMap = new Map(allTasks.map(task => [task.id, { ...task, subtasks: [] }]))
          const topLevelTasks: Task[] = []

          allTasks.forEach(task => {
            if (task.parent_task_id) {
              const parentTask = taskMap.get(task.parent_task_id)
              if (parentTask) {
                parentTask.subtasks = parentTask.subtasks || []
                parentTask.subtasks.push(taskMap.get(task.id)!)
              }
            } else {
              topLevelTasks.push(taskMap.get(task.id)!)
            }
          })

          setTasks(topLevelTasks)
        }

        // Handle sessions
        if (sessionsResponse.error) {
          setError(sessionsResponse.error.message)
        } else {
          setSessions(sessionsResponse.data || [])
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch project data')
      } finally {
        setTasksLoading(false)
        setSessionsLoading(false)
      }
    }

    fetchProjectData()
  }, [user, userLoading, selectedProjectId])

  // Selected project derived state
  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || null
  }, [projects, selectedProjectId])

  // CRUD operations that reuse the cached user
  const addProject = async (projectData: Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('projects')
      .insert([{ ...projectData, user_id: user.id }])
      .select()
      .single()

    if (error) throw error

    setProjects(prev => [data, ...prev])
    return data
  }

  const updateProject = async (
    id: string,
    updates: Partial<Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ) => {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    setProjects(prev => prev.map(p => (p.id === id ? data : p)))
    return data
  }

  const deleteProject = async (id: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', id)

    if (error) throw error

    setProjects(prev => prev.filter(p => p.id !== id))
  }

  const addTask = async (taskData: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('tasks')
      .insert([{ ...taskData, user_id: user.id }])
      .select()
      .single()

    if (error) throw error

    setTasks(prev => [data, ...prev])
    return data
  }

  const updateTask = async (
    id: string,
    updates: Partial<Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ) => {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    setTasks(prev => prev.map(t => (t.id === id ? data : t)))
    return data
  }

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)

    if (error) throw error

    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const updateSession = async (
    id: string,
    updates: Partial<Omit<Session, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ) => {
    const { data, error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    setSessions(prev => prev.map(s => (s.id === id ? data : s)))
    return data
  }

  const createSessionsWithContract = async (
    contractName: string,
    projectId: string,
    sessionData: Array<{ date: Date; hours: number; startTime?: string }>
  ) => {
    if (!user) throw new Error('User not authenticated')

    // Find or create contract
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('user_id', user.id)
      .eq('name', contractName)
      .eq('status', 'active')
      .single()

    let finalContract
    if (contractError && contractError.code === 'PGRST116') {
      // Contract doesn't exist, create it
      const { data: newContract, error: createError } = await supabase
        .from('contracts')
        .insert([{ name: contractName, user_id: user.id, status: 'active' }])
        .select()
        .single()

      if (createError) throw createError
      finalContract = newContract
    } else if (contractError) {
      throw contractError
    } else {
      finalContract = contract
    }

    // Create sessions
    const sessionsToInsert = sessionData.map(({ date, hours, startTime }) => ({
      project_id: projectId,
      user_id: user.id,
      scheduled_date: date.toISOString().split('T')[0],
      scheduled_hours: hours,
      actual_start_time: startTime || null,
      status: 'scheduled' as const,
    }))

    const { data: newSessions, error: sessionsError } = await supabase
      .from('sessions')
      .insert(sessionsToInsert)
      .select()

    if (sessionsError) throw sessionsError

    // Link sessions to contract
    const contractSessionsToInsert = newSessions.map(session => ({
      contract_id: finalContract.id,
      session_id: session.id,
    }))

    const { error: linkError } = await supabase
      .from('contract_sessions')
      .insert(contractSessionsToInsert)

    if (linkError) throw linkError

    // Update local state
    setSessions(prev => [...newSessions, ...prev])

    return { contract: finalContract, sessions: newSessions }
  }

  const refetchTasks = async () => {
    if (!user || !selectedProjectId) return

    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', selectedProjectId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    // Process tasks
    const allTasks = data || []
    const taskMap = new Map(allTasks.map(task => [task.id, { ...task, subtasks: [] }]))
    const topLevelTasks: Task[] = []

    allTasks.forEach(task => {
      if (task.parent_task_id) {
        const parentTask = taskMap.get(task.parent_task_id)
        if (parentTask) {
          parentTask.subtasks = parentTask.subtasks || []
          parentTask.subtasks.push(taskMap.get(task.id)!)
        }
      } else {
        topLevelTasks.push(taskMap.get(task.id)!)
      }
    })

    setTasks(topLevelTasks)
  }

  const refetchSessions = async () => {
    if (!user || !selectedProjectId) return

    const { data, error: fetchError } = await supabase
      .from('sessions')
      .select(`
        *, 
        projects(name, color),
        session_tasks(id, task_id, tasks(id, title, status))
      `)
      .eq('project_id', selectedProjectId)
      .eq('user_id', user.id)
      .order('scheduled_date', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    setSessions(data || [])
  }

  return {
    // User state
    user,
    userLoading,
    
    // Data
    projects,
    selectedProject,
    tasks,
    sessions,
    
    // Loading states
    projectsLoading,
    tasksLoading,
    sessionsLoading,
    
    // Error state
    error: error || userError,
    
    // Actions
    addProject,
    updateProject,
    deleteProject,
    addTask,
    updateTask,
    deleteTask,
    updateSession,
    createSessionsWithContract,
    refetchTasks,
    refetchSessions,
    fetchProjects,
  }
}