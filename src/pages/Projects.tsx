import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  FolderOpen,
  MoreVertical,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Edit,
  Trash2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
} from 'lucide-react';
import { useProjects, useTasks } from '../hooks/useProjects';
import { useSessions } from '../hooks/useContracts';
import { Project, Task } from '../types';

const Projects = () => {
  const { projects, loading: projectsLoading, addProject, updateProject, deleteProject } = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const { tasks, loading: tasksLoading, addTask, updateTask, deleteTask, refetch: refetchTasks } = useTasks(selectedProject?.id);
  const { sessions, loading: sessionsLoading, createSessionsWithContract } = useSessions(selectedProject?.id);
  
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [newSubtask, setNewSubtask] = useState({ title: '', description: '', priority: 'medium' as const, estimated_hours: 1 });
  const [newProject, setNewProject] = useState({ name: '', description: '', color: '#3B82F6' });
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' as const, estimated_hours: 1 });
  const [activeSessionTab, setActiveSessionTab] = useState<'past' | 'upcoming'>('upcoming');
  const [showNewSessionForm, setShowNewSessionForm] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [sessionHours, setSessionHours] = useState<{[key: string]: number}>({});
  const [showPreview, setShowPreview] = useState(false);
  const [contractName, setContractName] = useState('');
  const [modalStep, setModalStep] = useState<'contract' | 'dates' | 'preview'>('contract');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(() => new Date());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      archived: 'bg-gray-100 text-gray-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-600" />;
      default:
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      high: 'text-red-600',
      medium: 'text-yellow-600',
      low: 'text-green-600',
    };
    return colors[priority as keyof typeof colors] || 'text-gray-600';
  };

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const project = await addProject({
        name: newProject.name,
        description: newProject.description,
        color: newProject.color,
        status: 'active',
      });
      handleProjectSelect(project);
      setNewProject({ name: '', description: '', color: '#3B82F6' });
      setShowNewProjectForm(false);
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      await addTask({
        project_id: selectedProject.id,
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        estimated_hours: newTask.estimated_hours,
        status: 'todo',
      });
      setNewTask({ title: '', description: '', priority: 'medium', estimated_hours: 1 });
      setShowNewTaskForm(false);
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !selectedTask) return;

    try {
      console.log('Creating subtask with data:', {
        project_id: selectedProject.id,
        title: newSubtask.title,
        description: newSubtask.description,
        priority: newSubtask.priority,
        estimated_hours: newSubtask.estimated_hours,
        parent_task_id: selectedTask.id,
        status: 'todo',
      });

      const taskData = {
        project_id: selectedProject.id,
        title: newSubtask.title,
        priority: newSubtask.priority,
        status: 'todo' as const,
        ...(newSubtask.description && { description: newSubtask.description }),
        ...(newSubtask.estimated_hours && { estimated_hours: newSubtask.estimated_hours }),
        ...(selectedTask.id && { parent_task_id: selectedTask.id }),
      };

      await addTask(taskData);
      
      // Refresh tasks to get updated subtasks
      await refetchTasks();
      
      setNewSubtask({ title: '', description: '', priority: 'medium', estimated_hours: 1 });
      setShowAddSubtask(false);
    } catch (error) {
      console.error('Error creating subtask:', error);
      console.error('Full error details:', JSON.stringify(error, null, 2));
    }
  };

  const handleToggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'todo' : 'completed';
    try {
      await updateTask(task.id, { status: newStatus });
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setShowProjectDropdown(false);
    
    // Update URL query param
    setSearchParams({ project: project.name });
    
    // Save to localStorage
    localStorage.setItem('selectedProject', JSON.stringify(project));
  };

  // Initialize project from URL or localStorage
  useEffect(() => {
    if (!projects.length || projectsLoading) return;
    
    const projectParam = searchParams.get('project');
    let projectToSelect: Project | null = null;
    
    if (projectParam) {
      // Try to find project by name from URL
      projectToSelect = projects.find(p => p.name === projectParam) || null;
    }
    
    if (!projectToSelect) {
      // Try to get from localStorage
      const savedProject = localStorage.getItem('selectedProject');
      if (savedProject) {
        try {
          const parsedProject = JSON.parse(savedProject);
          projectToSelect = projects.find(p => p.id === parsedProject.id) || null;
        } catch (error) {
          console.error('Error parsing saved project:', error);
        }
      }
    }
    
    if (projectToSelect) {
      setSelectedProject(projectToSelect);
      setSearchParams({ project: projectToSelect.name });
    }
  }, [projects, projectsLoading, searchParams, setSearchParams]);

  const handleDateToggle = (date: Date) => {
    const dateStr = date.toDateString();
    setSelectedDates(prev => {
      const exists = prev.find(d => d.toDateString() === dateStr);
      if (exists) {
        // Remove from sessionHours when date is deselected
        setSessionHours(prevHours => {
          const newHours = { ...prevHours };
          delete newHours[dateStr];
          return newHours;
        });
        return prev.filter(d => d.toDateString() !== dateStr);
      } else {
        // Add default hours when date is selected
        setSessionHours(prevHours => ({
          ...prevHours,
          [dateStr]: 2
        }));
        return [...prev, date];
      }
    });
  };

  const handleCreateSessions = async () => {
    if (!selectedProject) {
      console.error('No project selected');
      return;
    }

    try {
      // Prepare session data
      const sessionData = selectedDates.map(date => ({
        date,
        hours: sessionHours[date.toDateString()] || 2
      }));

      // Create sessions with contract
      await createSessionsWithContract(contractName, selectedProject.id, sessionData);

      // Reset form state
      setShowNewSessionForm(false);
      setSelectedDates([]);
      setSessionHours({});
      setContractName('');
      setModalStep('contract');
      setShowPreview(false);
    } catch (error) {
      console.error('Error creating sessions:', error);
      // You might want to show a toast notification here
    }
  };

  const generateCalendarDays = (month: number, year: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const isDateSelected = (date: Date) => {
    return selectedDates.some(d => d.toDateString() === date.toDateString());
  };

  const getUpcomingSessions = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sessions.filter(session => {
      const sessionDate = new Date(session.scheduled_date + 'T00:00:00');
      return sessionDate >= today && session.status === 'scheduled';
    });
  };

  const getPastSessions = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sessions.filter(session => {
      const sessionDate = new Date(session.scheduled_date + 'T00:00:00');
      return sessionDate < today || session.status === 'completed';
    });
  };

  const distributeTasksAcrossSessions = () => {
    const upcomingSessions = getUpcomingSessions();
    const incompleteTasks = tasks.filter(task => task.status !== 'completed');
    
    // Create a copy of sessions with task assignments
    const sessionsWithTasks = upcomingSessions.map(session => ({
      ...session,
      assignedTasks: [] as Task[]
    }));

    let currentSessionIndex = 0;
    let currentSessionHours = 0;
    const sessionCapacity = 2; // Each session is 2 hours

    // Sort tasks by priority (high -> medium -> low) then by creation date
    const sortedTasks = [...incompleteTasks].sort((a, b) => {
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    // Distribute tasks across sessions
    for (const task of sortedTasks) {
      const taskHours = task.estimated_hours || 1;
      
      // If task fits in current session
      if (currentSessionHours + taskHours <= sessionCapacity && 
          currentSessionIndex < sessionsWithTasks.length) {
        sessionsWithTasks[currentSessionIndex].assignedTasks.push(task);
        currentSessionHours += taskHours;
      } else {
        // Move to next session
        currentSessionIndex++;
        currentSessionHours = 0;
        
        if (currentSessionIndex < sessionsWithTasks.length) {
          sessionsWithTasks[currentSessionIndex].assignedTasks.push(task);
          currentSessionHours += taskHours;
        }
        // If we run out of sessions, remaining tasks won't be assigned
      }
    }

    return sessionsWithTasks;
  };

  const generateClipboardText = (currentSessionIndex: number, sessionsWithTasks: any[]) => {
    const currentSession = sessionsWithTasks[currentSessionIndex];
    const currentTasks = currentSession?.assignedTasks || [];
    
    // Get all upcoming tasks from next sessions
    const upcomingTasks = sessionsWithTasks
      .slice(currentSessionIndex + 1)
      .flatMap(session => session.assignedTasks || []);
    
    let clipboardText = '';
    
    // Add current session tasks
    if (currentTasks.length > 0) {
      clipboardText = currentTasks.map(task => task.title).join(', ');
    }
    
    // Add upcoming tasks with "Next:" prefix
    if (upcomingTasks.length > 0) {
      const upcomingText = upcomingTasks.map(task => task.title).join(', ');
      if (clipboardText) {
        clipboardText += `, Next: ${upcomingText}`;
      } else {
        clipboardText = `Next: ${upcomingText}`;
      }
    }
    
    return clipboardText || 'No tasks assigned';
  };

  const handleCopyToClipboard = async (sessionIndex: number, sessionsWithTasks: any[]) => {
    const text = generateClipboardText(sessionIndex, sessionsWithTasks);
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
      console.log('Copied to clipboard:', text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProjectDropdown(false);
      }
    };

    if (showProjectDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProjectDropdown]);

  // Update selectedTask when tasks change (for subtasks refresh)
  useEffect(() => {
    if (selectedTask && tasks.length > 0) {
      const updatedTask = tasks.find(t => t.id === selectedTask.id);
      if (updatedTask) {
        setSelectedTask(updatedTask);
      }
    }
  }, [tasks, selectedTask?.id]);

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden max-w-full">
      {/* Top Navigation */}
      <nav className="h-5 border-b border-neutral-200 bg-white flex items-center px-4 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-semibold text-neutral-900 flex-shrink-0">Projects</h1>
          
          {/* Project Selector Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowProjectDropdown(!showProjectDropdown)}
              className="flex items-center gap-2 px-3 py-0.5 text-sm bg-neutral-50 border-l border-r border-neutral-200 hover:bg-neutral-100 transition-colors min-w-0 max-w-64"
            >
              {selectedProject ? (
                <>
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: selectedProject.color || '#3B82F6' }}
                  />
                  <span className="text-neutral-900 truncate">{selectedProject.name}</span>
                </>
              ) : (
                <span className="text-neutral-500">Select a project</span>
              )}
              <ChevronDown className="w-4 h-4 text-neutral-500 flex-shrink-0" />
            </button>
            
            {showProjectDropdown && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-neutral-200 shadow-lg z-50 max-h-80 overflow-y-auto">
                <div className="p-1 border-b border-neutral-100">
                  <button
                    onClick={() => {
                      setShowNewProjectForm(true);
                      setShowProjectDropdown(false);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    <Plus className="w-4 h-4" />
                    Create new project
                  </button>
                </div>
                <div className="p-1">
                  {projectsLoading ? (
                    <div className="p-2 text-neutral-500 text-sm text-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mx-auto mb-1"></div>
                      Loading projects...
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="p-2 text-neutral-500 text-sm text-center">
                      No projects yet
                    </div>
                  ) : (
                    projects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => handleProjectSelect(project)}
                        className={`w-full text-left p-1.5 hover:bg-neutral-50 transition-colors ${
                          selectedProject?.id === project.id ? 'bg-primary-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: project.color || '#3B82F6' }}
                          />
                          <div className={`text-sm truncate ${
                            selectedProject?.id === project.id ? 'font-bold text-neutral-900' : 'font-medium text-neutral-900'
                          }`}>
                            {project.name}
                          </div>
                        </div>
                        {project.description && (
                          <div className="text-xs text-neutral-600 mt-0.5 line-clamp-1 ml-3.5">
                            {project.description}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* New Project Form Modal */}
      {showNewProjectForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Create New Project</h2>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <input
                type="text"
                placeholder="Project name"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                required
              />
              <textarea
                placeholder="Description (optional)"
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm resize-none"
                rows={3}
              />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newProject.color}
                  onChange={(e) => setNewProject({ ...newProject, color: e.target.value })}
                  className="w-8 h-8 border border-neutral-300 rounded"
                />
                <span className="text-sm text-neutral-600">Project color</span>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowNewProjectForm(false)}
                  className="px-4 py-2 text-neutral-600 text-sm hover:text-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Session Form Modal */}
      {showNewSessionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Schedule Sessions</h2>
            
            {modalStep === 'contract' ? (
              <div className="space-y-4">
                <div className="text-sm text-neutral-600 mb-4">
                  Enter contract name for these sessions
                </div>
                
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Contract name"
                    value={contractName}
                    onChange={(e) => setContractName(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                    required
                  />
                </div>
                
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewSessionForm(false);
                      setSelectedDates([]);
                      setSessionHours({});
                      setContractName('');
                      setModalStep('contract');
                      setShowPreview(false);
                    }}
                    className="px-4 py-2 text-neutral-600 text-sm hover:text-neutral-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setModalStep('dates')}
                    disabled={!contractName.trim()}
                    className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : modalStep === 'dates' ? (
              <div className="space-y-4">
                <div className="text-sm text-neutral-600 mb-4">
                  Select multiple dates to schedule sessions
                </div>
                
                {/* Dual Calendar */}
                <div className="border border-neutral-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Current Month */}
                    {(() => {
                      const today = new Date();
                      const currentMonth = today.getMonth();
                      const currentYear = today.getFullYear();
                      const days = generateCalendarDays(currentMonth, currentYear);
                      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
                      
                      return (
                        <div>
                          <div className="text-center mb-4">
                            <h3 className="text-lg font-medium text-neutral-900">
                              {monthNames[currentMonth]} {currentYear}
                            </h3>
                          </div>
                          
                          {/* Day headers */}
                          <div className="grid grid-cols-7 gap-1 mb-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                              <div key={day} className="text-xs font-medium text-neutral-500 text-center py-1">
                                {day}
                              </div>
                            ))}
                          </div>
                          
                          {/* Calendar days */}
                          <div className="grid grid-cols-7 gap-1">
                            {days.map((date, index) => (
                              <div key={index} className="aspect-square">
                                {date && (
                                  <button
                                    onClick={() => handleDateToggle(date)}
                                    className={`w-full h-full text-sm rounded-md transition-colors ${
                                      isDateSelected(date)
                                        ? 'bg-primary-600 text-white'
                                        : 'hover:bg-neutral-100 text-neutral-700'
                                    }`}
                                  >
                                    {date.getDate()}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* Next Month */}
                    {(() => {
                      const today = new Date();
                      const nextMonth = today.getMonth() + 1;
                      const nextYear = nextMonth > 11 ? today.getFullYear() + 1 : today.getFullYear();
                      const adjustedMonth = nextMonth > 11 ? 0 : nextMonth;
                      const days = generateCalendarDays(adjustedMonth, nextYear);
                      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
                      
                      return (
                        <div>
                          <div className="text-center mb-4">
                            <h3 className="text-lg font-medium text-neutral-900">
                              {monthNames[adjustedMonth]} {nextYear}
                            </h3>
                          </div>
                          
                          {/* Day headers */}
                          <div className="grid grid-cols-7 gap-1 mb-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                              <div key={day} className="text-xs font-medium text-neutral-500 text-center py-1">
                                {day}
                              </div>
                            ))}
                          </div>
                          
                          {/* Calendar days */}
                          <div className="grid grid-cols-7 gap-1">
                            {days.map((date, index) => (
                              <div key={index} className="aspect-square">
                                {date && (
                                  <button
                                    onClick={() => handleDateToggle(date)}
                                    className={`w-full h-full text-sm rounded-md transition-colors ${
                                      isDateSelected(date)
                                        ? 'bg-primary-600 text-white'
                                        : 'hover:bg-neutral-100 text-neutral-700'
                                    }`}
                                  >
                                    {date.getDate()}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                
                {selectedDates.length > 0 && (
                  <div className="text-sm text-neutral-600">
                    {selectedDates.length} date{selectedDates.length > 1 ? 's' : ''} selected
                  </div>
                )}
                
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setModalStep('contract')}
                    className="px-4 py-2 text-neutral-600 text-sm hover:text-neutral-800"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewSessionForm(false);
                      setSelectedDates([]);
                      setSessionHours({});
                      setContractName('');
                      setModalStep('contract');
                      setShowPreview(false);
                    }}
                    className="px-4 py-2 text-neutral-600 text-sm hover:text-neutral-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setModalStep('preview')}
                    disabled={selectedDates.length === 0}
                    className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Preview
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-neutral-600 mb-4">
                  Review sessions to be created
                </div>
                
                <div className="bg-neutral-50 p-3 rounded-lg mb-4">
                  <div className="text-sm font-medium text-neutral-900">Contract: {contractName}</div>
                </div>
                
                <div className="max-h-64 overflow-y-auto">
                  <div className="space-y-0">
                    {selectedDates
                      .sort((a, b) => a.getTime() - b.getTime())
                      .map((date, index) => {
                        const dateStr = date.toDateString();
                        return (
                          <div key={index}>
                            <div className="flex items-center justify-between py-2">
                              <span className="text-sm text-neutral-900">
                                {date.toLocaleDateString('en-US', { 
                                  weekday: 'long', 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}
                              </span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={sessionHours[dateStr] !== undefined ? sessionHours[dateStr] : 2}
                                  onChange={(e) => {
                                    const inputValue = e.target.value;
                                    
                                    // Store the actual input value (including empty string)
                                    setSessionHours(prev => ({
                                      ...prev,
                                      [dateStr]: inputValue
                                    }));
                                  }}
                                  onBlur={(e) => {
                                    // On blur, ensure minimum value of 0.5
                                    const numValue = parseFloat(e.target.value);
                                    if (isNaN(numValue) || numValue < 0.5) {
                                      setSessionHours(prev => ({
                                        ...prev,
                                        [dateStr]: 0.5
                                      }));
                                    } else {
                                      // Convert to number if valid
                                      setSessionHours(prev => ({
                                        ...prev,
                                        [dateStr]: numValue
                                      }));
                                    }
                                  }}
                                  min="0.5"
                                  step="0.5"
                                  className="w-16 px-2 py-1 text-sm border border-neutral-300 rounded text-center"
                                />
                                <span className="text-xs text-neutral-500">hours</span>
                              </div>
                            </div>
                            {index < selectedDates.length - 1 && (
                              <div className="border-t border-neutral-200 my-0"></div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-3 border-t border-neutral-200">
                  <span className="text-sm text-neutral-600">Total Hours:</span>
                  <span className="text-sm font-medium text-neutral-900">
                    {selectedDates.reduce((total, date) => {
                      const dateStr = date.toDateString();
                      const hours = sessionHours[dateStr];
                      if (hours === undefined) return total + 2;
                      const numHours = typeof hours === 'string' ? parseFloat(hours) : hours;
                      return total + (isNaN(numHours) ? 0 : numHours);
                    }, 0)} hours
                  </span>
                </div>
                
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setModalStep('dates')}
                    className="px-4 py-2 text-neutral-600 text-sm hover:text-neutral-800"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewSessionForm(false);
                      setSelectedDates([]);
                      setSessionHours({});
                      setContractName('');
                      setModalStep('contract');
                      setShowPreview(false);
                    }}
                    className="px-4 py-2 text-neutral-600 text-sm hover:text-neutral-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateSessions}
                    className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
                  >
                    Create {selectedDates.length} Session{selectedDates.length > 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 w-full overflow-hidden">
        {selectedProject ? (
          <>
            {/* New Task Form Modal */}
            {showNewTaskForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                  <h2 className="text-lg font-semibold text-neutral-900 mb-4">Create New Task</h2>
                  <form onSubmit={handleCreateTask} className="space-y-4">
                    <input
                      type="text"
                      placeholder="Task title"
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                      required
                    />
                    <textarea
                      placeholder="Description (optional)"
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm resize-none"
                      rows={3}
                    />
                    <select
                      value={newTask.priority}
                      onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as 'low' | 'medium' | 'high' })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Estimated hours"
                        value={newTask.estimated_hours}
                        onChange={(e) => setNewTask({ ...newTask, estimated_hours: Math.max(0.5, parseFloat(e.target.value) || 0.5) })}
                        min="0.5"
                        step="0.5"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                      />
                      <span className="text-sm text-neutral-500">hours</span>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowNewTaskForm(false)}
                        className="px-4 py-2 text-neutral-600 text-sm hover:text-neutral-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
                      >
                        Create Task
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Task Modal */}
            {showTaskModal && selectedTask && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-neutral-900">{selectedTask.title}</h2>
                    <button
                      onClick={() => {
                        setShowTaskModal(false);
                        setSelectedTask(null);
                      }}
                      className="text-neutral-500 hover:text-neutral-700"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedTask.status === 'todo' ? 'bg-gray-100 text-gray-800' :
                        selectedTask.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {selectedTask.status.replace('_', ' ')}
                      </span>
                      <span className={`text-sm font-medium ${getPriorityColor(selectedTask.priority)}`}>
                        {selectedTask.priority} priority
                      </span>
                      {selectedTask.estimated_hours && (
                        <span className="text-sm text-neutral-600">
                          {selectedTask.estimated_hours} hours estimated
                        </span>
                      )}
                    </div>
                    
                    {selectedTask.description && (
                      <div>
                        <h3 className="text-sm font-medium text-neutral-900 mb-2">Description</h3>
                        <p className="text-sm text-neutral-600">{selectedTask.description}</p>
                      </div>
                    )}
                    
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-neutral-900">Subtasks</h3>
                        <button
                          onClick={() => setShowAddSubtask(true)}
                          className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                        >
                          Add Subtask
                        </button>
                      </div>
                      
                      {showAddSubtask && (
                        <div className="mb-2 p-2 border border-neutral-200 rounded bg-neutral-50">
                          <form onSubmit={handleCreateSubtask} className="space-y-2">
                            <input
                              type="text"
                              placeholder="Subtask title"
                              value={newSubtask.title}
                              onChange={(e) => setNewSubtask({ ...newSubtask, title: e.target.value })}
                              className="w-full px-2 py-1 border border-neutral-300 rounded text-sm"
                              required
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <select
                                value={newSubtask.priority}
                                onChange={(e) => setNewSubtask({ ...newSubtask, priority: e.target.value as 'low' | 'medium' | 'high' })}
                                className="flex-1 px-2 py-1 border border-neutral-300 rounded text-sm"
                              >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                              </select>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={newSubtask.estimated_hours}
                                  onChange={(e) => setNewSubtask({ ...newSubtask, estimated_hours: Math.max(0.5, parseFloat(e.target.value) || 0.5) })}
                                  min="0.5"
                                  step="0.5"
                                  className="w-14 px-1 py-1 border border-neutral-300 rounded text-sm text-center"
                                />
                                <span className="text-xs text-neutral-500">h</span>
                              </div>
                            </div>
                            <div className="flex gap-1 justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowAddSubtask(false);
                                  setNewSubtask({ title: '', description: '', priority: 'medium', estimated_hours: 1 });
                                }}
                                className="px-2 py-1 text-xs text-neutral-600 hover:text-neutral-800"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                              >
                                Add
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        {selectedTask.subtasks && selectedTask.subtasks.length > 0 ? (
                          selectedTask.subtasks.map((subtask) => (
                            <div
                              key={subtask.id}
                              className="p-3 border border-neutral-200 rounded bg-neutral-50"
                            >
                              <div className="flex items-start gap-3">
                                <button
                                  onClick={() => handleToggleTaskStatus(subtask)}
                                  className="mt-0.5 hover:scale-110 transition-transform flex-shrink-0"
                                >
                                  {getTaskStatusIcon(subtask.status)}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <h4 className={`text-sm font-medium leading-tight ${
                                      subtask.status === 'completed' ? 'line-through text-neutral-500' : 'text-neutral-900'
                                    }`}>
                                      {subtask.title}
                                    </h4>
                                    {subtask.estimated_hours && (
                                      <span className="text-xs text-neutral-500 flex-shrink-0">
                                        {subtask.estimated_hours}h
                                      </span>
                                    )}
                                  </div>
                                  {subtask.description && (
                                    <p className="text-xs text-neutral-600 mb-2">
                                      {subtask.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-medium ${getPriorityColor(subtask.priority)}`}>
                                      {subtask.priority}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-neutral-500 text-center py-4">
                            No subtasks yet
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 justify-end mt-6">
                    <button
                      onClick={() => {
                        setShowTaskModal(false);
                        setSelectedTask(null);
                      }}
                      className="px-4 py-2 text-neutral-600 text-sm hover:text-neutral-800"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Split Layout: Sessions and Tasks */}
            <div className="flex-1 flex overflow-hidden">
              {/* Sessions List - Left Half */}
              <div className="w-1/2 border-r border-neutral-200 flex flex-col">
                <div className="bg-white">
                  <div className="px-2 py-2 flex items-center justify-between">
                    <h3 className="text-lg font-medium text-neutral-900">Sessions</h3>
                    <button 
                      onClick={() => setShowNewSessionForm(true)}
                      className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 rounded-md transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Tabs */}
                  <div className="flex border-b border-neutral-200">
                    <button
                      onClick={() => setActiveSessionTab('upcoming')}
                      className={`px-2 py-2 text-sm font-medium transition-colors relative ${
                        activeSessionTab === 'upcoming'
                          ? 'text-neutral-900'
                          : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      Upcoming
                      {activeSessionTab === 'upcoming' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900"></div>
                      )}
                    </button>
                    <button
                      onClick={() => setActiveSessionTab('past')}
                      className={`px-2 py-2 text-sm font-medium transition-colors relative ${
                        activeSessionTab === 'past'
                          ? 'text-neutral-900'
                          : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      Past
                      {activeSessionTab === 'past' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900"></div>
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-1">
                  {sessionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto mb-2"></div>
                        <p className="text-neutral-500 text-sm">Loading sessions...</p>
                      </div>
                    </div>
                  ) : (
                    (() => {
                      const sessionsToShow = activeSessionTab === 'upcoming' 
                        ? distributeTasksAcrossSessions() 
                        : getPastSessions();
                      
                      if (sessionsToShow.length === 0) {
                        return (
                          <div className="text-center py-8 text-neutral-500">
                            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">
                              {activeSessionTab === 'upcoming' ? 'No upcoming sessions' : 'No past sessions'}
                            </p>
                            <p className="text-xs text-neutral-400">
                              {activeSessionTab === 'upcoming' 
                                ? 'Schedule your work sessions' 
                                : 'Your completed sessions will appear here'
                              }
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-0">
                          {sessionsToShow.map((session, index) => {
                            const taskDescription = activeSessionTab === 'upcoming' && session.assignedTasks?.length 
                              ? session.assignedTasks.map(task => task.title).join(', ')
                              : '';
                            
                            return (
                              <div
                                key={session.id}
                                className="py-2 px-1 border-b border-neutral-100 hover:bg-neutral-50 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="text-sm text-neutral-900">
                                    {new Date(session.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', {
                                      weekday: 'long',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-neutral-500">
                                      {session.scheduled_hours}h
                                    </span>
                                    {activeSessionTab === 'upcoming' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopyToClipboard(index, sessionsToShow);
                                        }}
                                        className="p-0.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200 rounded transition-colors"
                                        title="Copy task list to clipboard"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {taskDescription && (
                                  <div className="text-xs text-neutral-600 mt-0.5 line-clamp-2">
                                    {taskDescription}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>

              {/* Tasks List - Right Half */}
              <div className="w-1/2 flex flex-col">
                <div className="px-2 py-2 border-b border-neutral-200 bg-white flex items-center justify-between">
                  <h3 className="text-lg font-medium text-neutral-900">Tasks</h3>
                  <button 
                    onClick={() => setShowNewTaskForm(true)}
                    className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 rounded-md transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-1">
                  {tasksLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto mb-2"></div>
                        <p className="text-neutral-500 text-sm">Loading tasks...</p>
                      </div>
                    </div>
                  ) : tasks.length === 0 ? (
                    <div className="text-center py-8 text-neutral-500">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No tasks yet</p>
                      <p className="text-xs text-neutral-400">Add tasks to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {tasks.map((task) => (
                        <div
                          key={task.id}
                          className="py-2 px-1 border-b border-neutral-100 hover:bg-neutral-50 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedTask(task);
                            setShowTaskModal(true);
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleTaskStatus(task);
                              }}
                              className="mt-0.5 hover:scale-110 transition-transform flex-shrink-0"
                            >
                              {getTaskStatusIcon(task.status)}
                            </button>
                            {task.subtasks && task.subtasks.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTaskExpansion(task.id);
                                }}
                                className="mt-0.5 hover:bg-neutral-100 p-0.5 rounded transition-colors flex-shrink-0"
                              >
                                {expandedTasks.has(task.id) ? (
                                  <ChevronDown className="w-3 h-3 text-neutral-500" />
                                ) : (
                                  <ChevronRight className="w-3 h-3 text-neutral-500" />
                                )}
                              </button>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className={`text-sm font-medium leading-tight ${
                                  task.status === 'completed' ? 'line-through text-neutral-500' : 'text-neutral-900'
                                }`}>
                                  {task.title}
                                </h4>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {task.subtasks && task.subtasks.length > 0 ? (
                                    // Show readonly total of subtask hours if subtasks exist
                                    <>
                                      <div className="w-10 px-1 py-0.5 text-xs text-center text-neutral-500">
                                        {task.subtasks.reduce((total, subtask) => total + (subtask.estimated_hours || 0), 0)}
                                      </div>
                                      <span className="text-xs text-neutral-500">h</span>
                                    </>
                                  ) : (
                                    // Show editable input if no subtasks
                                    <>
                                      <input
                                        type="number"
                                        value={task.estimated_hours || 1}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const newHours = Math.max(0.5, parseFloat(e.target.value) || 0.5);
                                          updateTask(task.id, { estimated_hours: newHours });
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        onFocus={(e) => e.stopPropagation()}
                                        min="0.5"
                                        step="0.5"
                                        className="w-10 px-1 py-0.5 text-xs border border-neutral-300 rounded text-center hover:border-neutral-400 focus:border-primary-500 focus:outline-none"
                                      />
                                      <span className="text-xs text-neutral-500">h</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              {task.description && (
                                <div className="text-xs text-neutral-600 mt-0.5 line-clamp-2">
                                  {task.description}
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-xs font-medium ${getPriorityColor(task.priority)}`}>
                                  {task.priority}
                                </span>
                                <span className="text-xs text-neutral-500">
                                  {task.created_at ? new Date(task.created_at).toLocaleDateString() : ''}
                                </span>
                              </div>
                              
                              {/* Subtasks list */}
                              {task.subtasks && task.subtasks.length > 0 && expandedTasks.has(task.id) && (
                                <div className="mt-1 pl-2 border-l border-neutral-200 space-y-0">
                                  {task.subtasks.map((subtask) => (
                                    <div key={subtask.id} className="flex items-center gap-1 py-0.5">
                                      <div className="flex-1 min-w-0">
                                        <span className={`text-xs ${
                                          subtask.status === 'completed' ? 'line-through text-neutral-500' : 'text-neutral-700'
                                        }`}>
                                          {subtask.title}
                                        </span>
                                      </div>
                                      {subtask.estimated_hours && (
                                        <span className="text-xs text-neutral-500 flex-shrink-0">
                                          {subtask.estimated_hours}h
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-500">
            <div className="text-center">
              <div className="text-6xl mb-4">📁</div>
              <h3 className="text-lg font-medium mb-2">Select a project to start working</h3>
              <p className="text-sm">Choose a project from the dropdown above or create a new one</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Projects;