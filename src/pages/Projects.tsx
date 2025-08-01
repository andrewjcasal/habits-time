import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Settings, Folder, Zap, Info } from 'lucide-react'
import { useProjects, useTasks } from '../hooks/useProjects'
import { useSessions } from '../hooks/useContracts'
import { Project, Task } from '../types'
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
    return sessions.filter(session => {
      const sessionDate = new Date(session.scheduled_date + 'T00:00:00')
      return sessionDate >= today && session.status === 'scheduled'
    })
  }, [sessions])

  const pastSessions = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return sessions.filter(session => {
      const sessionDate = new Date(session.scheduled_date + 'T00:00:00')
      return sessionDate < today || session.status === 'completed'
    })
  }, [sessions])

  const sessionsWithTasks = useMemo(() => {
    const incompleteTasks = tasks.filter(task => task.status !== 'completed')

    const sessionsWithTasks = upcomingSessions.map(session => ({
      ...session,
      assignedTasks: [] as Task[],
    }))

    let currentSessionIndex = 0
    let currentSessionHours = 0
    const sessionCapacity = 2

    const sortedTasks = [...incompleteTasks].sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

    for (const task of sortedTasks) {
      const taskHours = task.estimated_hours || 1

      if (
        currentSessionHours + taskHours <= sessionCapacity &&
        currentSessionIndex < sessionsWithTasks.length
      ) {
        sessionsWithTasks[currentSessionIndex].assignedTasks.push(task)
        currentSessionHours += taskHours
      } else {
        currentSessionIndex++
        currentSessionHours = 0

        if (currentSessionIndex < sessionsWithTasks.length) {
          sessionsWithTasks[currentSessionIndex].assignedTasks.push(task)
          currentSessionHours += taskHours
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
