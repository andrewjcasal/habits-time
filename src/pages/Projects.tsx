import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Settings, Folder, Zap, Info } from 'lucide-react'
import { useProjects, useTasks } from '../hooks/useProjects'
import { useSessions } from '../hooks/useContracts'
import { Project, Task } from '../types'
import { supabase } from '../lib/supabase'
import ProjectDropdown from '../components/ProjectDropdown'
import NewProjectModal from '../components/NewProjectModal'
import NewSessionModal from '../components/NewSessionModal'
import ProjectSettingsModal from '../components/ProjectSettingsModal'
import TaskModal from '../components/TaskModal'
import NewTaskModal from '../components/NewTaskModal'
import SessionsList from '../components/SessionsList'
import TasksList from '../components/TasksList'

const Projects = () => {
  const {
    projects,
    loading: projectsLoading,
    addProject,
    updateProject,
    deleteProject,
    fetchProjects,
  } = useProjects()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const {
    tasks,
    loading: tasksLoading,
    addTask,
    updateTask,
    deleteTask,
    refetch: refetchTasks,
  } = useTasks(selectedProject?.id)
  const {
    sessions,
    loading: sessionsLoading,
    createSessionsWithContract,
    updateSession,
    refetch: refetchSessions,
  } = useSessions(selectedProject?.id)

  // Modal states
  const [showNewProjectForm, setShowNewProjectForm] = useState(false)
  const [showNewTaskForm, setShowNewTaskForm] = useState(false)
  const [showNewSessionForm, setShowNewSessionForm] = useState(false)
  const [showProjectSettings, setShowProjectSettings] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)

  // Selected items
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [activeSessionTab, setActiveSessionTab] = useState<'past' | 'upcoming'>('upcoming')

  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleProjectSelect = useCallback(
    (project: Project | null) => {
      setShowProjectDropdown(false)

      if (project) {
        // Update URL query param first
        setSearchParams({ project: project.name })

        // Save to localStorage
        localStorage.setItem('selectedProject', JSON.stringify(project))

        // Set selected project last to prevent race condition
        setSelectedProject(project)
      } else {
        // Clear URL query param and localStorage
        setSearchParams({})
        localStorage.removeItem('selectedProject')
        setSelectedProject(null)
      }
    },
    [setSearchParams]
  )

  const handleUpdateProject = useCallback(
    async (projectId: string, data: any) => {
      await updateProject(projectId, data)

      // If a project was archived, refresh the projects list to remove it from the dropdown
      if (data.status === 'archived') {
        await fetchProjects()
      }
    },
    [updateProject, fetchProjects]
  )

  const handleToggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'todo' : 'completed'
    try {
      await updateTask(task.id, { status: newStatus })
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  const handleCompleteSessionTasks = async (sessionId: string) => {
    try {
      // Find the session to get its assigned tasks
      const session = sessionsToShow.find(s => s.id === sessionId)
      if (!session || !session.assignedTasks) {
        console.warn('Session not found or has no assigned tasks')
        return
      }

      // Mark all assigned tasks as completed
      for (const task of session.assignedTasks) {
        await updateTask(task.id, { status: 'completed' })
      }

      // Create associations in session_tasks table
      const sessionTasksData = session.assignedTasks.map(task => ({
        session_id: sessionId,
        task_id: task.id
      }))

      const { error: sessionTasksError } = await supabase
        .from('session_tasks')
        .upsert(sessionTasksData, { 
          onConflict: 'session_id,task_id',
          ignoreDuplicates: true 
        })

      if (sessionTasksError) {
        console.error('Error creating session-task associations:', sessionTasksError)
        // Don't throw here - tasks are still completed even if association fails
      }

      // Update session notes with completed tasks
      const taskNames = session.assignedTasks.map(task => task.title).join(', ')
      const updatedNotes = session.notes 
        ? `${session.notes}\n\nCompleted tasks: ${taskNames}`
        : `Completed tasks: ${taskNames}`

      await updateSession(sessionId, { 
        notes: updatedNotes,
        status: 'completed'
      })

      // Refresh tasks and sessions to show updated status
      await refetchTasks()
      await refetchSessions()
    } catch (error) {
      console.error('Error completing session tasks:', error)
      throw error // Re-throw so modal stays open on error
    }
  }

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setShowTaskModal(true)
  }

  // Initialize project from URL or localStorage
  useEffect(() => {
    if (!projects.length || projectsLoading) return

    const projectParam = searchParams.get('project')
    let projectToSelect: Project | null = null

    if (projectParam) {
      // Decode the URL parameter to handle spaces and special characters
      const decodedProjectName = decodeURIComponent(projectParam.replace(/\+/g, ' '))
      projectToSelect = projects.find(p => p.name === decodedProjectName) || null
    }

    if (!projectToSelect) {
      const savedProject = localStorage.getItem('selectedProject')
      if (savedProject) {
        try {
          const parsedProject = JSON.parse(savedProject)
          projectToSelect = projects.find(p => p.id === parsedProject.id) || null
        } catch (error) {
          console.error('Error parsing saved project:', error)
        }
      }
    }

    if (projectToSelect && (!selectedProject || selectedProject.id !== projectToSelect.id)) {
      setSelectedProject(projectToSelect)
      // Don't update URL here - it's already set
    } else if (selectedProject && !projects.find(p => p.id === selectedProject.id)) {
      // If selected project is no longer in the active projects list (e.g., archived), clear it
      setSelectedProject(null)
      setSearchParams({})
      localStorage.removeItem('selectedProject')
    }
  }, [projects, projectsLoading, searchParams])

  // Sessions logic
  const upcomingSessions = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayString = today.toISOString().split('T')[0]
    
    return sessions.filter(session => {
      const sessionDate = new Date(session.scheduled_date + 'T00:00:00')
      const hasSessionTasks = (session as any).session_tasks && (session as any).session_tasks.length > 0
      const isAfterToday = sessionDate > today
      const isTodayWithoutCompletion = session.scheduled_date === todayString && 
        session.status !== 'completed' && !hasSessionTasks
      
      return isAfterToday || isTodayWithoutCompletion
    }).sort((a, b) => {
      // Sort by scheduled_date ascending (earliest first)
      const dateA = new Date(a.scheduled_date + 'T00:00:00')
      const dateB = new Date(b.scheduled_date + 'T00:00:00')
      return dateA.getTime() - dateB.getTime()
    })
  }, [sessions])

  const pastSessions = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayString = today.toISOString().split('T')[0]
    
    return sessions.filter(session => {
      const sessionDate = new Date(session.scheduled_date + 'T00:00:00')
      const isBeforeToday = sessionDate < today
      const hasSessionTasks = (session as any).session_tasks && (session as any).session_tasks.length > 0
      const isTodayWithCompletedTasks = session.scheduled_date === todayString && 
        (session.status === 'completed' || hasSessionTasks)
      
      return isBeforeToday || isTodayWithCompletedTasks
    }).sort((a, b) => {
      // Sort by scheduled_date descending (most recent first)
      const dateA = new Date(a.scheduled_date + 'T00:00:00')
      const dateB = new Date(b.scheduled_date + 'T00:00:00')
      return dateB.getTime() - dateA.getTime()
    })
  }, [sessions])

  const sessionsWithTasks = useMemo(() => {
    const incompleteTasks = tasks.filter(task => task.status !== 'completed')

    const sessionsWithTasks = upcomingSessions.map(session => ({
      ...session,
      assignedTasks: [] as Task[],
    }))

    console.log('🔄 Task Assignment Debug:')
    console.log('📅 Sessions:', sessionsWithTasks.map(s => ({ date: s.scheduled_date, hours: s.scheduled_hours })))
    console.log('📝 Incomplete Tasks:', incompleteTasks.map(t => ({ title: t.title, hours: t.estimated_hours })))

    let currentSessionIndex = 0
    let currentSessionHours = 0

    const sortedTasks = [...incompleteTasks].sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

    console.log('🔀 Sorted Tasks:', sortedTasks.map(t => ({ title: t.title, hours: t.estimated_hours, priority: t.priority })))

    for (const task of sortedTasks) {
      // If task has subtasks, assign subtasks individually; otherwise assign the task itself
      if (task.subtasks && task.subtasks.length > 0) {
        console.log(`\n🎯 Processing parent task: ${task.title} with ${task.subtasks.length} subtasks`)
        
        // Sort subtasks by priority and creation date (same as parent tasks)
        const sortedSubtasks = [...task.subtasks]
          .filter(subtask => subtask.status !== 'completed') // Only incomplete subtasks
          .sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 }
            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
            if (priorityDiff !== 0) return priorityDiff
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          })

        for (const subtask of sortedSubtasks) {
          const subtaskHours = subtask.estimated_hours || 1
          let remainingSubtaskHours = subtaskHours
          
          console.log(`  🔹 Processing subtask: ${task.title} - ${subtask.title} (${subtaskHours}h)`)

          // Assign this subtask to sessions
          while (remainingSubtaskHours > 0 && currentSessionIndex < sessionsWithTasks.length) {
            const currentSessionCapacity = sessionsWithTasks[currentSessionIndex].scheduled_hours
            const availableCapacity = currentSessionCapacity - currentSessionHours
            
            console.log(`    📍 Session ${currentSessionIndex} (${sessionsWithTasks[currentSessionIndex].scheduled_date}): ${currentSessionHours}/${currentSessionCapacity}h used, ${availableCapacity}h available`)

            if (availableCapacity > 0) {
              // Add subtask to current session
              if (!sessionsWithTasks[currentSessionIndex].assignedTasks.find(t => t.id === subtask.id)) {
                // Create a modified subtask that shows parent task context
                const subtaskWithContext = {
                  ...subtask,
                  title: `${task.title} - ${subtask.title}` // Show as "Production - test one"
                }
                sessionsWithTasks[currentSessionIndex].assignedTasks.push(subtaskWithContext)
                console.log(`    ✅ Added subtask to session ${currentSessionIndex}`)
              }
              
              // Use available capacity
              const hoursToAllocate = Math.min(remainingSubtaskHours, availableCapacity)
              currentSessionHours += hoursToAllocate
              remainingSubtaskHours -= hoursToAllocate
              console.log(`    ⏱️ Allocated ${hoursToAllocate}h, remaining: ${remainingSubtaskHours}h, session now: ${currentSessionHours}h`)
            }

            // If current session is full or subtask is fully allocated, move to next session
            if (currentSessionHours >= currentSessionCapacity || remainingSubtaskHours <= 0) {
              if (remainingSubtaskHours > 0) {
                console.log(`    ➡️ Moving to next session (${remainingSubtaskHours}h remaining)`)
                currentSessionIndex++
                currentSessionHours = 0
              }
            }
          }
          
          if (remainingSubtaskHours > 0) {
            console.log(`    ⚠️ Subtask ${task.title} - ${subtask.title} has ${remainingSubtaskHours}h unallocated (no more sessions)`)
          }
        }
      } else {
        // Handle tasks without subtasks (original logic)
        const taskHours = task.estimated_hours || 1
        let remainingTaskHours = taskHours
        console.log(`\n🎯 Processing task: ${task.title} (${remainingTaskHours}h)`)

        // Keep assigning this task across sessions until fully allocated
        while (remainingTaskHours > 0 && currentSessionIndex < sessionsWithTasks.length) {
          const currentSessionCapacity = sessionsWithTasks[currentSessionIndex].scheduled_hours
          const availableCapacity = currentSessionCapacity - currentSessionHours
          
          console.log(`  📍 Session ${currentSessionIndex} (${sessionsWithTasks[currentSessionIndex].scheduled_date}): ${currentSessionHours}/${currentSessionCapacity}h used, ${availableCapacity}h available`)

          if (availableCapacity > 0) {
            // Add task to current session
            if (!sessionsWithTasks[currentSessionIndex].assignedTasks.find(t => t.id === task.id)) {
              sessionsWithTasks[currentSessionIndex].assignedTasks.push(task)
              console.log(`  ✅ Added task to session ${currentSessionIndex}`)
            }
            
            // Use available capacity
            const hoursToAllocate = Math.min(remainingTaskHours, availableCapacity)
            currentSessionHours += hoursToAllocate
            remainingTaskHours -= hoursToAllocate
            console.log(`  ⏱️ Allocated ${hoursToAllocate}h, remaining: ${remainingTaskHours}h, session now: ${currentSessionHours}h`)
          }

          // If current session is full or task is fully allocated, move to next session
          if (currentSessionHours >= currentSessionCapacity || remainingTaskHours <= 0) {
            if (remainingTaskHours > 0) {
              console.log(`  ➡️ Moving to next session (${remainingTaskHours}h remaining)`)
              currentSessionIndex++
              currentSessionHours = 0
            }
          }
        }
        
        if (remainingTaskHours > 0) {
          console.log(`  ⚠️ Task ${task.title} has ${remainingTaskHours}h unallocated (no more sessions)`)
        }
      }
    }

    console.log('\n📊 Final Results:')
    sessionsWithTasks.forEach((session, index) => {
      const taskTitles = session.assignedTasks.map(t => t.title).join(', ')
      console.log(`  Session ${index} (${session.scheduled_date}): ${taskTitles || 'No tasks'}`)
    })

    return sessionsWithTasks
  }, [upcomingSessions, tasks])

  const handleCopyToClipboard = useCallback(
    async (sessionIndex: number, sessionsWithTasks: any[]) => {
      const currentSession = sessionsWithTasks[sessionIndex]
      const currentTasks = currentSession?.assignedTasks || []

      const upcomingTasks = sessionsWithTasks
        .slice(sessionIndex + 1)
        .flatMap(session => session.assignedTasks || [])

      let clipboardText = ''

      if (currentTasks.length > 0) {
        clipboardText = currentTasks.map(task => task.title).join(', ')
      }

      if (upcomingTasks.length > 0) {
        const upcomingText = upcomingTasks.map(task => task.title).join(', ')
        if (clipboardText) {
          clipboardText += `, Next: ${upcomingText}`
        } else {
          clipboardText = `Next: ${upcomingText}`
        }
      }

      const text = clipboardText || 'No tasks assigned'

      try {
        await navigator.clipboard.writeText(text)
      } catch (error) {
        console.error('Failed to copy to clipboard:', error)
      }
    },
    []
  )

  // Handle dropdown clicks outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProjectDropdown(false)
      }
    }

    if (showProjectDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProjectDropdown])

  // Update selectedTask when tasks change
  useEffect(() => {
    if (selectedTask && tasks.length > 0) {
      const updatedTask = tasks.find(t => t.id === selectedTask.id)
      if (updatedTask) {
        setSelectedTask(updatedTask)
      }
    }
  }, [tasks, selectedTask?.id])

  const sessionsToShow = activeSessionTab === 'upcoming' ? sessionsWithTasks : pastSessions

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden max-w-full">
      {/* Top Navigation */}
      <nav className="border-b border-neutral-200 bg-white flex items-center flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <ProjectDropdown
            ref={dropdownRef}
            selectedProject={selectedProject}
            projects={projects}
            projectsLoading={projectsLoading}
            showDropdown={showProjectDropdown}
            onToggleDropdown={() => setShowProjectDropdown(!showProjectDropdown)}
            onProjectSelect={(project: Project) => handleProjectSelect(project)}
            onShowNewProjectForm={() => setShowNewProjectForm(true)}
          />

          {/* Project Settings Button */}
          {selectedProject && (
            <button
              onClick={() => setShowProjectSettings(true)}
              className="flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
            >
              <Settings className="w-2 h-2" />
              <span>Project Settings</span>
            </button>
          )}
        </div>
      </nav>

      {/* Info Banner - show when no projects exist */}
      {projects.length === 0 && !projectsLoading && (
        <div className="mx-4 mt-4 px-4 py-3 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-500" />
            <div>
              <h3 className="text-sm font-medium text-blue-900 mb-1">Create a project to get started!</h3>
              <p className="text-sm text-blue-700 leading-relaxed">
                Add projects and tasks to populate your calendar and watch them auto-shuffle as you complete work. 
                Projects help organize your tasks and track progress over time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner - show when projects exist but few tasks */}
      {projects.length > 0 && tasks.length < 2 && !tasksLoading && (
        <div className="px-4 py-3 bg-green-50 border-b border-green-100 mb-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 mt-0.5 flex-shrink-0 text-green-500" />
            <div>
              <h3 className="text-sm font-medium text-green-900 mb-1">Add tasks to see the magic happen!</h3>
              <p className="text-sm text-green-700 leading-relaxed">
                Fill your projects with tasks to see how they work together in the calendar. 
                Make sure to add durations to each task so they can be properly scheduled and auto-shuffled as you work.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <NewProjectModal
        isOpen={showNewProjectForm}
        onClose={() => setShowNewProjectForm(false)}
        onCreateProject={addProject}
        onProjectSelect={(project: Project) => handleProjectSelect(project)}
      />

      <NewSessionModal
        isOpen={showNewSessionForm}
        onClose={() => setShowNewSessionForm(false)}
        selectedProject={selectedProject}
        onCreateSessions={createSessionsWithContract}
      />

      <ProjectSettingsModal
        isOpen={showProjectSettings}
        onClose={() => setShowProjectSettings(false)}
        selectedProject={selectedProject}
        onUpdateProject={handleUpdateProject}
        onProjectSelect={handleProjectSelect}
        projects={projects}
      />

      <TaskModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        selectedTask={selectedTask}
        selectedProject={selectedProject}
        onAddTask={addTask}
        onUpdateTask={updateTask}
        onDeleteTask={deleteTask}
        onRefetchTasks={refetchTasks}
        onToggleTaskStatus={handleToggleTaskStatus}
      />

      <NewTaskModal
        isOpen={showNewTaskForm}
        onClose={() => setShowNewTaskForm(false)}
        selectedProject={selectedProject}
        onCreateTask={addTask}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 w-full overflow-hidden">
        {selectedProject ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Conditionally show SessionsList only if project has sessions */}
            {selectedProject.has_sessions && (
              <SessionsList
                activeSessionTab={activeSessionTab}
                onSetActiveSessionTab={setActiveSessionTab}
                onShowNewSessionForm={() => setShowNewSessionForm(true)}
                sessionsLoading={sessionsLoading}
                sessionsToShow={sessionsToShow}
                onCopyToClipboard={handleCopyToClipboard}
                onUpdateSession={updateSession}
                onCompleteSessionTasks={handleCompleteSessionTasks}
              />
            )}

            <TasksList
              tasks={tasks}
              tasksLoading={tasksLoading}
              fullWidth={!selectedProject.has_sessions}
              onShowNewTaskForm={() => setShowNewTaskForm(true)}
              onTaskClick={handleTaskClick}
              onToggleTaskStatus={handleToggleTaskStatus}
              onUpdateTask={updateTask}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-500">
            <div className="text-center">
              <div className="mb-4">
                <Folder className="w-16 h-16 mx-auto text-neutral-300" />
              </div>
              <h3 className="text-lg font-medium mb-2">Select a project to start working</h3>
              <p className="text-sm">
                Choose a project from the dropdown above
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default Projects
