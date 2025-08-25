import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Settings, Folder, Zap, Info, Crown, Calendar } from 'lucide-react'
import { useOptimizedProjectsData } from '../hooks/useOptimizedProjects'
import { Project, Task } from '../types'
import { supabase } from '../lib/supabase'
import ProjectDropdown from '../components/ProjectDropdown'
import NewProjectModal from '../components/NewProjectModal'
import NewSessionModal from '../components/NewSessionModal'
import ProjectSettingsModal from '../components/ProjectSettingsModal'
import TaskModal from '../components/TaskModal'
import DayViewModal from '../components/DayViewModal'
import SessionsList from '../components/SessionsList'
import TasksList from '../components/TasksList'

const ProjectsOptimized = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Use the optimized hook that consolidates all API calls
  const {
    user,
    userLoading,
    projects,
    projectsLoading,
    selectedProject,
    tasks,
    tasksLoading,
    sessions,
    sessionsLoading,
    error,
    setSelectedProjectId,
    addProject,
    addTask,
    updateTask,
    createSessionsWithContract,
    refetchTasks,
  } = useOptimizedProjectsData()

  // Modal states
  const [showNewProjectForm, setShowNewProjectForm] = useState(false)
  const [showNewSessionForm, setShowNewSessionForm] = useState(false)
  const [showProjectSettings, setShowProjectSettings] = useState(false)
  const [showDayView, setShowDayView] = useState(false)
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

        // Set selected project ID for the optimized hook
        setSelectedProjectId(project.id)
      } else {
        // Clear URL query param and localStorage
        setSearchParams({})
        localStorage.removeItem('selectedProject')
        setSelectedProjectId(null)
      }
    },
    [setSearchParams, setSelectedProjectId]
  )

  const handleUpdateProject = useCallback(
    async (projectId: string, data: any) => {
      // For now, keep the original update logic since it's not in the optimized hook yet
      const { error } = await supabase
        .from('projects')
        .update(data)
        .eq('id', projectId)

      if (error) throw error

      // If a project was archived, we might want to refresh projects
      if (data.status === 'archived') {
        // The optimized hook would need a refetch projects method
        window.location.reload() // Temporary solution
      }
    },
    []
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
        task_id: task.id,
      }))

      const { error: sessionTasksError } = await supabase
        .from('session_tasks')
        .upsert(sessionTasksData, {
          onConflict: 'session_id,task_id',
          ignoreDuplicates: true,
        })

      if (sessionTasksError) {
        console.error('Error creating session-task associations:', sessionTasksError)
      }

      // Update session notes and status
      const taskNames = session.assignedTasks.map(task => task.title).join(', ')
      const updatedNotes = session.notes
        ? `${session.notes}\n\nCompleted tasks: ${taskNames}`
        : `Completed tasks: ${taskNames}`

      await supabase
        .from('sessions')
        .update({
          notes: updatedNotes,
          status: 'completed',
        })
        .eq('id', sessionId)

      // Refresh tasks to show updated status
      await refetchTasks()
    } catch (error) {
      console.error('Error completing session tasks:', error)
      throw error
    }
  }

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setShowTaskModal(true)
  }

  // Initialize project from URL or localStorage
  useEffect(() => {
    if (userLoading || projectsLoading || !projects.length) return

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
      setSelectedProjectId(projectToSelect.id)
    } else if (selectedProject && !projects.find(p => p.id === selectedProject.id)) {
      // If selected project is no longer in the active projects list (e.g., archived), clear it
      setSelectedProjectId(null)
      setSearchParams({})
      localStorage.removeItem('selectedProject')
    }
  }, [userLoading, projectsLoading, projects, searchParams, selectedProject, setSelectedProjectId])

  // Sessions logic (unchanged from original)
  const upcomingSessions = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayString = today.toISOString().split('T')[0]

    return sessions
      .filter(session => {
        const sessionDate = new Date(session.scheduled_date + 'T00:00:00')
        const hasSessionTasks =
          (session as any).session_tasks && (session as any).session_tasks.length > 0
        const isAfterToday = sessionDate > today
        const isTodayWithoutCompletion =
          session.scheduled_date === todayString &&
          session.status !== 'completed' &&
          !hasSessionTasks

        return isAfterToday || isTodayWithoutCompletion
      })
      .sort((a, b) => {
        const dateA = new Date(a.scheduled_date + 'T00:00:00')
        const dateB = new Date(b.scheduled_date + 'T00:00:00')
        return dateA.getTime() - dateB.getTime()
      })
  }, [sessions])

  const pastSessions = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayString = today.toISOString().split('T')[0]

    return sessions
      .filter(session => {
        const sessionDate = new Date(session.scheduled_date + 'T00:00:00')
        const isBeforeToday = sessionDate < today
        const hasSessionTasks =
          (session as any).session_tasks && (session as any).session_tasks.length > 0
        const isTodayWithCompletedTasks =
          session.scheduled_date === todayString &&
          (session.status === 'completed' || hasSessionTasks)

        return isBeforeToday || isTodayWithCompletedTasks
      })
      .sort((a, b) => {
        const dateA = new Date(a.scheduled_date + 'T00:00:00')
        const dateB = new Date(b.scheduled_date + 'T00:00:00')
        return dateB.getTime() - dateA.getTime()
      })
  }, [sessions])

  // Sessions with tasks logic (unchanged from original)
  const sessionsWithTasks = useMemo(() => {
    const incompleteTasks = tasks.filter(task => task.status !== 'completed')

    const sessionsWithTasks = upcomingSessions.map(session => ({
      ...session,
      assignedTasks: [] as Task[],
    }))

    let currentSessionIndex = 0
    let currentSessionHours = 0

    const sortedTasks = [...incompleteTasks].sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

    for (const task of sortedTasks) {
      if (task.subtasks && task.subtasks.length > 0) {
        const sortedSubtasks = [...task.subtasks]
          .filter(subtask => subtask.status !== 'completed')
          .sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 }
            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
            if (priorityDiff !== 0) return priorityDiff
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          })

        for (const subtask of sortedSubtasks) {
          const subtaskHours = subtask.estimated_hours || 1
          let remainingSubtaskHours = subtaskHours

          while (remainingSubtaskHours > 0 && currentSessionIndex < sessionsWithTasks.length) {
            const currentSessionCapacity = sessionsWithTasks[currentSessionIndex].scheduled_hours
            const availableCapacity = currentSessionCapacity - currentSessionHours

            if (availableCapacity > 0) {
              if (
                !sessionsWithTasks[currentSessionIndex].assignedTasks.find(t => t.id === subtask.id)
              ) {
                const subtaskWithContext = {
                  ...subtask,
                  title: `${task.title} - ${subtask.title}`,
                }
                sessionsWithTasks[currentSessionIndex].assignedTasks.push(subtaskWithContext)
              }

              const hoursToAllocate = Math.min(remainingSubtaskHours, availableCapacity)
              currentSessionHours += hoursToAllocate
              remainingSubtaskHours -= hoursToAllocate
            }

            if (currentSessionHours >= currentSessionCapacity || remainingSubtaskHours <= 0) {
              if (remainingSubtaskHours > 0) {
                currentSessionIndex++
                currentSessionHours = 0
              }
            }
          }
        }
      } else {
        const taskHours = task.estimated_hours || 1
        let remainingTaskHours = taskHours

        while (remainingTaskHours > 0 && currentSessionIndex < sessionsWithTasks.length) {
          const currentSessionCapacity = sessionsWithTasks[currentSessionIndex].scheduled_hours
          const availableCapacity = currentSessionCapacity - currentSessionHours

          if (availableCapacity > 0) {
            if (!sessionsWithTasks[currentSessionIndex].assignedTasks.find(t => t.id === task.id)) {
              sessionsWithTasks[currentSessionIndex].assignedTasks.push(task)
            }

            const hoursToAllocate = Math.min(remainingTaskHours, availableCapacity)
            currentSessionHours += hoursToAllocate
            remainingTaskHours -= hoursToAllocate
          }

          if (currentSessionHours >= currentSessionCapacity || remainingTaskHours <= 0) {
            if (remainingTaskHours > 0) {
              currentSessionIndex++
              currentSessionHours = 0
            }
          }
        }
      }
    }

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

  // Show loading while checking user authentication
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // Show error if there's an authentication or data error
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="mb-4">
            <Folder className="w-16 h-16 mx-auto text-neutral-300" />
          </div>
          <h3 className="text-lg font-medium mb-2 text-neutral-900">Error</h3>
          <p className="text-sm text-neutral-600">{error}</p>
        </div>
      </div>
    )
  }

  const ProjectContent = () => (
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
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowProjectSettings(true)}
                className="flex items-center gap-1 px-2 py-1 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
              >
                <Settings className="w-3 h-3" />
                <span>Project Settings</span>
              </button>
              
              <button
                onClick={() => setShowDayView(true)}
                className="flex items-center gap-1 px-2 py-1 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
              >
                <Calendar className="w-3 h-3" />
                <span>Day View</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Info Banner - show when no projects exist */}
      {projects.length === 0 && !projectsLoading && (
        <div className="mx-4 mt-4 px-4 py-3 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-500" />
            <div>
              <h3 className="text-sm font-medium text-blue-900 mb-1">
                Create a project to get started!
              </h3>
              <p className="text-sm text-blue-700 leading-relaxed">
                Add projects and tasks to populate your calendar and watch them auto-shuffle as you
                complete work. Projects help organize your tasks and track progress over time.
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
              <h3 className="text-sm font-medium text-green-900 mb-1">
                Add tasks to see the magic happen!
              </h3>
              <p className="text-sm text-green-700 leading-relaxed">
                Fill your projects with tasks to see how they work together in the calendar. Make
                sure to add durations to each task so they can be properly scheduled and
                auto-shuffled as you work.
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
        onDeleteTask={async (id: string) => {
          // Implement delete task in the optimized hook if needed
          await supabase.from('tasks').delete().eq('id', id)
          await refetchTasks()
        }}
        onRefetchTasks={refetchTasks}
        onToggleTaskStatus={handleToggleTaskStatus}
      />

      <DayViewModal
        isOpen={showDayView}
        onClose={() => setShowDayView(false)}
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
                onUpdateSession={async (id: string, updates: any) => {
                  // Implement session update if needed
                  await supabase.from('sessions').update(updates).eq('id', id)
                }}
                onCompleteSessionTasks={handleCompleteSessionTasks}
              />
            )}

            <TasksList
              tasks={tasks}
              tasksLoading={tasksLoading}
              fullWidth={!selectedProject.has_sessions}
              selectedProject={selectedProject}
              onAddTask={addTask}
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
              <p className="text-sm">Choose a project from the dropdown above</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )

  return <ProjectContent />
}

export default ProjectsOptimized