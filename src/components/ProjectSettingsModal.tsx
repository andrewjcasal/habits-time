import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Project } from '../types'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

interface ProjectSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  selectedProject: Project | null
  onUpdateProject: (projectId: string, data: any) => Promise<void>
  onProjectSelect: (project: Project | null) => void
  projects: Project[]
}

const ProjectSettingsModal = ({
  isOpen,
  onClose,
  selectedProject,
  onUpdateProject,
  onProjectSelect,
  projects,
}: ProjectSettingsModalProps) => {
  const [projectSettings, setProjectSettings] = useState({ hourly_rate: 0, has_sessions: false, is_shareable: false })

  useEffect(() => {
    if (selectedProject) {
      setProjectSettings({ 
        hourly_rate: selectedProject.hourly_rate || 0,
        has_sessions: selectedProject.has_sessions || false,
        is_shareable: selectedProject.is_shareable || false
      })
    }
  }, [selectedProject])

  const handleUpdateProjectSettings = async () => {
    if (!selectedProject) return

    try {
      await onUpdateProject(selectedProject.id, {
        hourly_rate: projectSettings.hourly_rate,
        has_sessions: projectSettings.has_sessions,
        is_shareable: projectSettings.is_shareable,
      })
      onClose()
    } catch (error) {
      console.error('Error updating project settings:', error)
    }
  }

  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [futureLogCount, setFutureLogCount] = useState(0)
  const [archiving, setArchiving] = useState(false)

  const handleArchiveClick = async () => {
    if (!selectedProject) return
    // Check how many future task_daily_logs exist for this project's tasks
    const today = format(new Date(), 'yyyy-MM-dd')
    const { count } = await supabase
      .from('tasks_daily_logs')
      .select('id', { count: 'exact', head: true })
      .in('task_id',
        (await supabase.from('tasks').select('id').eq('project_id', selectedProject.id)).data?.map(t => t.id) || []
      )
      .gte('log_date', today)

    setFutureLogCount(count || 0)
    setShowArchiveConfirm(true)
  }

  const handleArchiveConfirm = async (deleteFutureEvents: boolean) => {
    if (!selectedProject) return
    setArchiving(true)

    try {
      if (deleteFutureEvents) {
        const today = format(new Date(), 'yyyy-MM-dd')
        const taskIds = (await supabase.from('tasks').select('id').eq('project_id', selectedProject.id)).data?.map(t => t.id) || []
        if (taskIds.length > 0) {
          await supabase
            .from('tasks_daily_logs')
            .delete()
            .in('task_id', taskIds)
            .gte('log_date', today)
        }
      }

      await onUpdateProject(selectedProject.id, { status: 'archived' })

      const firstActiveProject = projects.find(
        p => p.id !== selectedProject.id && p.status === 'active'
      )
      onProjectSelect(firstActiveProject || null)
      setShowArchiveConfirm(false)
      onClose()
    } catch (error) {
      console.error('Error archiving project:', error)
    } finally {
      setArchiving(false)
    }
  }

  if (!isOpen || !selectedProject) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-2 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-neutral-900">Project Settings</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-2">
          <div>
            <h3 className="text-xs font-medium text-neutral-900 mb-0.5">{selectedProject.name}</h3>
            <p className="text-xs text-neutral-600">{selectedProject.description}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Hourly Rate</label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-neutral-600">$</span>
              <input
                type="number"
                value={projectSettings.hourly_rate}
                onChange={e =>
                  setProjectSettings({
                    ...projectSettings,
                    hourly_rate: parseFloat(e.target.value) || 0,
                  })
                }
                min="0"
                step="0.01"
                className="w-full px-1 py-1 border border-neutral-300 rounded-md text-xs"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={projectSettings.has_sessions}
                onChange={e =>
                  setProjectSettings({
                    ...projectSettings,
                    has_sessions: e.target.checked,
                  })
                }
                className="w-3 h-3"
              />
              <span className="text-xs font-medium text-neutral-700">Has Sessions</span>
            </label>
          </div>

          <div>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={projectSettings.is_shareable}
                onChange={e =>
                  setProjectSettings({
                    ...projectSettings,
                    is_shareable: e.target.checked,
                  })
                }
                className="w-3 h-3"
              />
              <span className="text-xs font-medium text-neutral-700">Is Shareable</span>
            </label>
          </div>

          {showArchiveConfirm && (
            <div className="p-2 bg-red-50 rounded-md border border-red-200 space-y-2">
              <p className="text-xs text-red-800 font-medium">Archive "{selectedProject?.name}"?</p>
              {futureLogCount > 0 && (
                <p className="text-xs text-red-600">
                  This project has {futureLogCount} future calendar event{futureLogCount !== 1 ? 's' : ''}.
                </p>
              )}
              <div className="flex gap-1">
                {futureLogCount > 0 && (
                  <button
                    onClick={() => handleArchiveConfirm(true)}
                    disabled={archiving}
                    className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50"
                  >
                    {archiving ? 'Archiving...' : 'Archive & Delete Events'}
                  </button>
                )}
                <button
                  onClick={() => handleArchiveConfirm(false)}
                  disabled={archiving}
                  className="px-2 py-1 bg-neutral-200 text-neutral-700 rounded text-xs hover:bg-neutral-300 disabled:opacity-50"
                >
                  {archiving ? 'Archiving...' : futureLogCount > 0 ? 'Archive & Keep Events' : 'Archive'}
                </button>
                <button
                  onClick={() => setShowArchiveConfirm(false)}
                  className="px-2 py-1 text-neutral-500 text-xs hover:text-neutral-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-1 border-t border-neutral-200">
            {!showArchiveConfirm && (
              <button
                onClick={handleArchiveClick}
                className="px-2 py-1 text-red-600 hover:text-red-800 text-xs"
              >
                Archive
              </button>
            )}
            {showArchiveConfirm && <div />}
            <div className="flex gap-1">
              <button
                onClick={onClose}
                className="px-2 py-1 text-neutral-600 text-xs hover:text-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateProjectSettings}
                className="px-2 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProjectSettingsModal
