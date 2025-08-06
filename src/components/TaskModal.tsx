import { useState, useEffect, useCallback } from 'react'
import { X, CheckCircle2, Circle, Clock, Plus, Trash2 } from 'lucide-react'
import { Task, Project } from '../types'

interface TaskModalProps {
  isOpen: boolean
  onClose: () => void
  selectedTask: Task | null
  selectedProject: Project | null
  onAddTask: (taskData: any) => Promise<void>
  onUpdateTask: (taskId: string, data: any) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
  onRefetchTasks: () => Promise<void>
  onToggleTaskStatus: (task: Task) => Promise<void>
}

const TaskModal = ({
  isOpen,
  onClose,
  selectedTask,
  selectedProject,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onRefetchTasks,
  onToggleTaskStatus,
}: TaskModalProps) => {
  const [showAddSubtask, setShowAddSubtask] = useState(false)
  const [showSubtaskContainer, setShowSubtaskContainer] = useState(false)
  const [mainTaskChanges, setMainTaskChanges] = useState<{[key: string]: any}>({})
  const [newSubtask, setNewSubtask] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    estimated_hours: 1,
  })
  const [editingHours, setEditingHours] = useState<{[key: string]: string}>({})
  const [selectedSubtask, setSelectedSubtask] = useState<Task | null>(null)
  const [pendingChanges, setPendingChanges] = useState<{[key: string]: any}>({})

  // Save main task changes
  const handleSaveMainTask = async () => {
    if (!selectedTask || Object.keys(mainTaskChanges).length === 0) return

    try {
      await onUpdateTask(selectedTask.id, mainTaskChanges)
      setMainTaskChanges({})
      await onRefetchTasks()
      handleClose()
    } catch (error) {
      console.error('Error saving main task:', error)
    }
  }

  // Delete selected subtask
  const handleDeleteSubtask = async () => {
    if (!selectedSubtask) return

    try {
      await onDeleteTask(selectedSubtask.id)
      
      // Clear the selected subtask
      setSelectedSubtask(null)
      
      // Refresh tasks to get updated data
      await onRefetchTasks()
    } catch (error) {
      console.error('Error deleting subtask:', error)
    }
  }

  // Save changes to selected subtask
  const handleSaveSubtask = async () => {
    if (!selectedSubtask) return

    try {
      const updates: any = {}
      
      // Include duration if it was edited
      if (editingHours[selectedSubtask.id] !== undefined) {
        const hours = parseFloat(editingHours[selectedSubtask.id])
        if (!isNaN(hours) && hours >= 0.25) {
          updates.estimated_hours = hours
        }
      }

      // Include any other pending changes
      if (pendingChanges[selectedSubtask.id]) {
        Object.assign(updates, pendingChanges[selectedSubtask.id])
      }

      if (Object.keys(updates).length > 0) {
        await onUpdateTask(selectedSubtask.id, updates)
        
        // Clear editing states
        setEditingHours(prev => {
          const updated = { ...prev }
          delete updated[selectedSubtask.id]
          return updated
        })
        setPendingChanges(prev => {
          const updated = { ...prev }
          delete updated[selectedSubtask.id]
          return updated
        })

        // Refresh tasks to get updated data
        await onRefetchTasks()
      }
    } catch (error) {
      console.error('Error saving subtask:', error)
    }
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      high: 'text-red-600',
      medium: 'text-yellow-600',
      low: 'text-green-600',
    }
    return colors[priority as keyof typeof colors] || 'text-gray-600'
  }

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-600" />
      default:
        return <Circle className="w-4 h-4 text-gray-400" />
    }
  }

  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProject || !selectedTask) return

    try {
      const taskData = {
        project_id: selectedProject.id,
        title: newSubtask.title,
        priority: newSubtask.priority,
        status: 'todo' as const,
        ...(newSubtask.description && { description: newSubtask.description }),
        ...(newSubtask.estimated_hours && { estimated_hours: newSubtask.estimated_hours }),
        ...(selectedTask.id && { parent_task_id: selectedTask.id }),
      }

      await onAddTask(taskData)

      // Refresh tasks to get updated subtasks
      await onRefetchTasks()

      setNewSubtask({ title: '', description: '', priority: 'medium', estimated_hours: 1 })
      setShowAddSubtask(false)
    } catch (error) {
      console.error('Error creating subtask:', error)
    }
  }

  const handleClose = () => {
    setShowAddSubtask(false)
    setShowSubtaskContainer(false)
    setMainTaskChanges({})
    setNewSubtask({ title: '', description: '', priority: 'medium', estimated_hours: 1 })
    setSelectedSubtask(null)
    onClose()
  }

  // Auto-select first subtask when modal opens and show container if subtasks exist
  useEffect(() => {
    if (isOpen && selectedTask?.subtasks?.length) {
      setShowSubtaskContainer(true)
      if (!selectedSubtask) {
        setSelectedSubtask(selectedTask.subtasks[0])
      }
    } else if (isOpen) {
      setShowSubtaskContainer(false)
    }
  }, [isOpen, selectedTask, selectedSubtask])

  if (!isOpen || !selectedTask) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-2 w-full max-w-4xl mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-neutral-900">{selectedTask.title}</h2>
          <button onClick={handleClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Main Task Editor */}
        <div className="mb-2 p-2 border border-neutral-200 rounded bg-neutral-50">
          <div className="space-y-1">
            <div className="flex gap-1">
              <input
                type="text"
                value={mainTaskChanges.title !== undefined ? mainTaskChanges.title : selectedTask.title}
                onChange={e => {
                  setMainTaskChanges(prev => ({ ...prev, title: e.target.value }))
                }}
                className="flex-1 px-1 py-1 border border-neutral-300 rounded text-xs"
                placeholder="Task title"
              />
              
              {(!selectedTask.subtasks || selectedTask.subtasks.length === 0) && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={mainTaskChanges.estimated_hours !== undefined ? mainTaskChanges.estimated_hours : (selectedTask.estimated_hours || '')}
                    onChange={e => {
                      const value = e.target.value
                      if (value === '') {
                        setMainTaskChanges(prev => ({ ...prev, estimated_hours: '' }))
                      } else {
                        const newHours = parseFloat(value)
                        if (!isNaN(newHours) && newHours >= 0.25) {
                          setMainTaskChanges(prev => ({ ...prev, estimated_hours: newHours }))
                        } else if (!isNaN(newHours)) {
                          setMainTaskChanges(prev => ({ ...prev, estimated_hours: newHours }))
                        }
                      }
                    }}
                    min="0.25"
                    step="0.25"
                    className="w-12 px-1 py-1 border border-neutral-300 rounded text-xs text-center"
                    placeholder="Hours"
                  />
                  <span className="text-xs text-neutral-500">h</span>
                </div>
              )}
            </div>
            
            <textarea
              value={mainTaskChanges.description !== undefined ? mainTaskChanges.description : (selectedTask.description || '')}
              onChange={e => {
                setMainTaskChanges(prev => ({ ...prev, description: e.target.value }))
              }}
              className="w-full px-1 py-1 border border-neutral-300 rounded text-xs resize-none"
              rows={2}
              placeholder="Description (optional)"
            />
            
            {/* Action buttons row */}
            <div className="flex items-center justify-between mt-1">
              {/* Add sub-task quick action - only show when no subtasks exist */}
              {(!selectedTask.subtasks || selectedTask.subtasks.length === 0) && !showSubtaskContainer && (
                <button
                  onClick={() => {
                    setShowSubtaskContainer(true)
                    setShowAddSubtask(true)
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-primary-600 border border-primary-600 hover:bg-primary-600 hover:text-white rounded transition-colors"
                >
                  <Plus className="w-2 h-2" />
                  Add sub-task
                </button>
              )}
              
              {/* Save button for main task - always visible */}
              <button
                onClick={handleSaveMainTask}
                disabled={Object.keys(mainTaskChanges).length === 0}
                className={`ml-auto px-2 py-1 text-xs rounded ${
                  Object.keys(mainTaskChanges).length > 0
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Sub-task container - only show when there are subtasks or user clicked "Add sub-task" */}
        {showSubtaskContainer && (
          <div className="flex h-80">
            {/* Left Panel - Subtasks List */}
            <div className="w-1/2 border-r border-neutral-200 flex flex-col">
            <div className="flex items-center justify-between mb-2 px-2">
              <h3 className="text-xs font-medium text-neutral-900">Subtasks ({selectedTask.subtasks?.length || 0})</h3>
              <button
                onClick={() => setShowAddSubtask(true)}
                disabled={showAddSubtask}
                className={`px-2 py-1 text-xs rounded ${
                  showAddSubtask
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                Add
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {showAddSubtask && (
                <div className="mb-2 mx-2 p-1 border border-neutral-200 rounded bg-neutral-50">
                  <form onSubmit={handleCreateSubtask} className="space-y-1">
                    <input
                      type="text"
                      placeholder="Subtask title"
                      value={newSubtask.title}
                      onChange={e => setNewSubtask({ ...newSubtask, title: e.target.value })}
                      className="w-full px-1 py-1 border border-neutral-300 rounded text-xs"
                      required
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <select
                        value={newSubtask.priority}
                        onChange={e => setNewSubtask({ ...newSubtask, priority: e.target.value as 'low' | 'medium' | 'high' })}
                        className="flex-1 px-1 py-1 border border-neutral-300 rounded text-xs"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                      <input
                        type="number"
                        value={newSubtask.estimated_hours}
                        onChange={e => setNewSubtask({ ...newSubtask, estimated_hours: Math.max(0.25, parseFloat(e.target.value) || 0.25) })}
                        min="0.25"
                        step="0.25"
                        placeholder="Hours"
                        className="w-12 px-1 py-1 border border-neutral-300 rounded text-xs text-center"
                      />
                    </div>
                    <div className="flex gap-1 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddSubtask(false)
                          setNewSubtask({ title: '', description: '', priority: 'medium', estimated_hours: 1 })
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

              {selectedTask.subtasks && selectedTask.subtasks.length > 0 ? (
                <div className="space-y-0">
                  {selectedTask.subtasks.map(subtask => (
                    <div
                      key={subtask.id}
                      className={`py-2 px-2 border-b border-neutral-100 hover:bg-neutral-50 transition-colors cursor-pointer ${
                        selectedSubtask?.id === subtask.id ? 'bg-primary-50 border-primary-200' : ''
                      }`}
                      onClick={() => setSelectedSubtask(subtask)}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleTaskStatus(subtask)
                          }}
                          className="mt-0.5 hover:scale-110 transition-transform flex-shrink-0"
                        >
                          {getTaskStatusIcon(subtask.status)}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4
                              className={`text-xs font-medium leading-tight truncate ${
                                subtask.status === 'completed'
                                  ? 'line-through text-neutral-500'
                                  : 'text-neutral-900'
                              }`}
                            >
                              {subtask.title}
                            </h4>
                            {subtask.estimated_hours !== undefined && (
                              <span className="text-xs text-neutral-500 flex-shrink-0 ml-1">
                                {subtask.estimated_hours}h
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <span className={`text-xs ${getPriorityColor(subtask.priority)}`}>
                              {subtask.priority}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-neutral-500 text-center py-8">No subtasks yet</div>
              )}
            </div>
          </div>

          {/* Right Panel - Selected Subtask Details */}
          <div className="w-1/2 flex flex-col">
            {selectedSubtask ? (
              <div className="p-2 flex flex-col h-full">
                <h3 className="text-xs font-medium text-neutral-900 mb-2">Edit Subtask</h3>
                
                <form className="space-y-1 flex-1">
                  <input
                    type="text"
                    value={selectedSubtask.title}
                    onChange={e => {
                      const updatedSubtask = { ...selectedSubtask, title: e.target.value }
                      setSelectedSubtask(updatedSubtask)
                      setPendingChanges(prev => ({
                        ...prev,
                        [selectedSubtask.id]: {
                          ...prev[selectedSubtask.id],
                          title: e.target.value
                        }
                      }))
                    }}
                    className="w-full px-1 py-1 border border-neutral-300 rounded text-xs"
                    placeholder="Subtask title"
                  />
                  
                  <div className="flex gap-1">
                    <select
                      value={selectedSubtask.priority}
                      onChange={e => {
                        const newPriority = e.target.value as 'low' | 'medium' | 'high'
                        const updatedSubtask = { ...selectedSubtask, priority: newPriority }
                        setSelectedSubtask(updatedSubtask)
                        setPendingChanges(prev => ({
                          ...prev,
                          [selectedSubtask.id]: {
                            ...prev[selectedSubtask.id],
                            priority: newPriority
                          }
                        }))
                      }}
                      className="flex-1 px-1 py-1 border border-neutral-300 rounded text-xs"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editingHours[selectedSubtask.id] !== undefined ? editingHours[selectedSubtask.id] : selectedSubtask.estimated_hours || ''}
                        onChange={e => {
                          setEditingHours(prev => ({
                            ...prev,
                            [selectedSubtask.id]: e.target.value
                          }))
                        }}
                        min="0.25"
                        step="0.25"
                        className="w-12 px-1 py-1 border border-neutral-300 rounded text-xs text-center"
                        placeholder="Hours"
                      />
                      <span className="text-xs text-neutral-500">h</span>
                    </div>
                  </div>

                  <textarea
                    value={selectedSubtask.description || ''}
                    onChange={e => {
                      const updatedSubtask = { ...selectedSubtask, description: e.target.value }
                      setSelectedSubtask(updatedSubtask)
                      setPendingChanges(prev => ({
                        ...prev,
                        [selectedSubtask.id]: {
                          ...prev[selectedSubtask.id],
                          description: e.target.value
                        }
                      }))
                    }}
                    className="w-full px-1 py-1 border border-neutral-300 rounded text-xs resize-none"
                    rows={3}
                    placeholder="Description (optional)"
                  />
                  
                  <div className="flex justify-between mt-2">
                    <button
                      type="button"
                      onClick={handleDeleteSubtask}
                      className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSubtask}
                      className="px-2 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700"
                    >
                      Save
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-neutral-500">
                Select a subtask to edit
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

export default TaskModal
