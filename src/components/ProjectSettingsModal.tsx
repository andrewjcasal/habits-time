import { useState, useEffect } from 'react'
import { Project } from '../types'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import ModalWrapper from './ModalWrapper'

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
  const [projectSettings, setProjectSettings] = useState<{
    name: string
    color: string
    hourly_rate: number
    has_sessions: boolean
    is_shareable: boolean
    payment_type: 'manual' | 'upwork'
  }>({ name: '', color: '#6b7280', hourly_rate: 0, has_sessions: false, is_shareable: false, payment_type: 'manual' })

  useEffect(() => {
    if (selectedProject) {
      setProjectSettings({
        name: selectedProject.name || '',
        color: selectedProject.color || '#6b7280',
        hourly_rate: selectedProject.hourly_rate || 0,
        has_sessions: selectedProject.has_sessions || false,
        is_shareable: selectedProject.is_shareable || false,
        payment_type: selectedProject.payment_type || 'manual',
      })
    }
  }, [selectedProject])

  const handleUpdateProjectSettings = async () => {
    if (!selectedProject) return

    try {
      await onUpdateProject(selectedProject.id, {
        name: projectSettings.name.trim() || selectedProject.name,
        color: projectSettings.color,
        hourly_rate: projectSettings.hourly_rate,
        has_sessions: projectSettings.has_sessions,
        is_shareable: projectSettings.is_shareable,
        payment_type: projectSettings.payment_type,
      })
      onClose()
    } catch (error) {
      console.error('Error updating project settings:', error)
    }
  }

  const colorOptions = [
    { name: 'Gray', value: '#6b7280' },
    { name: 'Slate', value: '#475569' },
    { name: 'Red', value: '#dc2626' },
    { name: 'Rose', value: '#e11d48' },
    { name: 'Orange', value: '#ea580c' },
    { name: 'Amber', value: '#d97706' },
    { name: 'Yellow', value: '#ca8a04' },
    { name: 'Lime', value: '#65a30d' },
    { name: 'Green', value: '#16a34a' },
    { name: 'Emerald', value: '#059669' },
    { name: 'Teal', value: '#0d9488' },
    { name: 'Cyan', value: '#0891b2' },
    { name: 'Blue', value: '#2563eb' },
    { name: 'Indigo', value: '#4f46e5' },
    { name: 'Purple', value: '#9333ea' },
    { name: 'Pink', value: '#c2185b' },
  ]

  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [futureLogCount, setFutureLogCount] = useState(0)
  const [archiving, setArchiving] = useState(false)

  const handleArchiveClick = async () => {
    if (!selectedProject) return
    // Check how many future task_daily_logs exist for this project's tasks
    const today = format(new Date(), 'yyyy-MM-dd')
    const { count } = await supabase
      .from('cassian_tasks_daily_logs')
      .select('id', { count: 'exact', head: true })
      .in('task_id',
        (await supabase.from('cassian_tasks').select('id').eq('project_id', selectedProject.id)).data?.map(t => t.id) || []
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
        const taskIds = (await supabase.from('cassian_tasks').select('id').eq('project_id', selectedProject.id)).data?.map(t => t.id) || []
        if (taskIds.length > 0) {
          await supabase
            .from('cassian_tasks_daily_logs')
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

  if (!selectedProject) return null

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Project Settings" maxWidth="sm">
      <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Name</label>
            <input
              type="text"
              value={projectSettings.name}
              onChange={e =>
                setProjectSettings({ ...projectSettings, name: e.target.value })
              }
              className="w-full px-1 py-1 border border-neutral-300 rounded-md text-xs"
              placeholder="Project name"
            />
            {selectedProject.description && (
              <p className="text-xs text-neutral-600 mt-1">{selectedProject.description}</p>
            )}
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
            <label className="block text-xs font-medium text-neutral-700 mb-1">Color</label>
            <div className="flex flex-wrap gap-1">
              {colorOptions.map(color => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() =>
                    setProjectSettings({ ...projectSettings, color: color.value })
                  }
                  className={`w-4 h-4 rounded-full border transition-all ${
                    projectSettings.color === color.value
                      ? 'border-neutral-400 scale-110'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Payment Type</label>
            <select
              value={projectSettings.payment_type}
              onChange={e =>
                setProjectSettings({
                  ...projectSettings,
                  payment_type: e.target.value as 'manual' | 'upwork',
                })
              }
              className="w-full px-1 py-1 border border-neutral-300 rounded-md text-xs"
            >
              <option value="manual">Manual</option>
              <option value="upwork">Upwork</option>
            </select>
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
    </ModalWrapper>
  )
}

export default ProjectSettingsModal
