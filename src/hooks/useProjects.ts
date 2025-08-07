import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Project, Task } from '../types'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async (includeArchived = false) => {
    try {
      setLoading(true)
      setError(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('User not authenticated')
        return
      }

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
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const addProject = async (
    project: Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('projects')
        .insert([{ ...project, user_id: user.id }])
        .select()
        .single()

      if (error) throw error

      setProjects(prev => [data, ...prev])
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add project')
    }
  }

  const updateProject = async (
    id: string,
    updates: Partial<Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setProjects(prev => prev.map(p => (p.id === id ? data : p)))
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update project')
    }
  }

  const deleteProject = async (id: string) => {
    try {
      const { error } = await supabase.from('projects').delete().eq('id', id)

      if (error) throw error

      setProjects(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete project')
    }
  }

  return {
    projects,
    loading,
    error,
    addProject,
    updateProject,
    deleteProject,
    refetch: fetchProjects,
    fetchProjects,
  }
}

export function usePublicProject(projectName?: string) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isShareable, setIsShareable] = useState(false)

  useEffect(() => {
    if (projectName) {
      fetchPublicProject(projectName)
    }
  }, [projectName])

  const fetchPublicProject = async (name: string) => {
    try {
      setLoading(true)
      setError(null)

      // Decode the URL parameter to handle spaces and special characters
      const decodedProjectName = decodeURIComponent(name.replace(/\+/g, ' '))

      // Query for the project by name and check if it's shareable
      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('name', decodedProjectName)
        .eq('is_shareable', true)
        .eq('status', 'active')
        .single()

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // No rows returned - project doesn't exist or isn't shareable
          setError('Project not found or not publicly accessible')
          setIsShareable(false)
        } else {
          setError(fetchError.message)
        }
        return
      }

      setProject(data)
      setIsShareable(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsShareable(false)
    } finally {
      setLoading(false)
    }
  }

  return {
    project,
    loading,
    error,
    isShareable,
    refetch: () => projectName && fetchPublicProject(projectName),
  }
}

export function usePublicTasks(projectId?: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (projectId) {
      setTasks([])
      fetchPublicTasks()
    } else {
      setTasks([])
    }
  }, [projectId])

  const fetchPublicTasks = async () => {
    if (!projectId) return

    try {
      setLoading(true)
      setError(null)

      // Fetch all tasks for the project (public access, no user_id filter)
      const { data, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      // Group tasks by parent/child relationship
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return {
    tasks,
    loading,
    error,
    refetch: fetchPublicTasks,
  }
}

export function useTasks(projectId?: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (projectId) {
      setTasks([]) // Clear tasks immediately when project changes
      fetchTasks()
    } else {
      setTasks([]) // Clear tasks when no project is selected
    }
  }, [projectId])

  const fetchTasks = async () => {
    if (!projectId) return

    try {
      setLoading(true)
      setError(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('User not authenticated')
        return
      }

      // Fetch all tasks for the project
      const { data, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      // Group tasks by parent/child relationship
      const allTasks = data || []
      const taskMap = new Map(allTasks.map(task => [task.id, { ...task, subtasks: [] }]))
      const topLevelTasks: Task[] = []

      allTasks.forEach(task => {
        if (task.parent_task_id) {
          // This is a subtask
          const parentTask = taskMap.get(task.parent_task_id)
          if (parentTask) {
            parentTask.subtasks = parentTask.subtasks || []
            parentTask.subtasks.push(taskMap.get(task.id)!)
          }
        } else {
          // This is a top-level task
          topLevelTasks.push(taskMap.get(task.id)!)
        }
      })

      setTasks(topLevelTasks)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const addTask = async (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('tasks')
        .insert([{ ...task, user_id: user.id }])
        .select()
        .single()

      if (error) throw error

      setTasks(prev => [data, ...prev])
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add task')
    }
  }

  const updateTask = async (
    id: string,
    updates: Partial<Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setTasks(prev => prev.map(t => (t.id === id ? data : t)))
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update task')
    }
  }

  const deleteTask = async (id: string) => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id)

      if (error) throw error

      setTasks(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete task')
    }
  }

  return {
    tasks,
    loading,
    error,
    addTask,
    updateTask,
    deleteTask,
    refetch: fetchTasks,
  }
}
