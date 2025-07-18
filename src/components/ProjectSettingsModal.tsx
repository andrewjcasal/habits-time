import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Project } from '../types'

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
  const [projectSettings, setProjectSettings] = useState({ hourly_rate: 0 })

  useEffect(() => {
    if (selectedProject) {
      setProjectSettings({ hourly_rate: selectedProject.hourly_rate || 0 })
    }
  }, [selectedProject])

  const handleUpdateProjectSettings = async () => {
    if (!selectedProject) return

    try {
      await onUpdateProject(selectedProject.id, {
        hourly_rate: projectSettings.hourly_rate,
      })
      onClose()
    } catch (error) {
      console.error('Error updating project settings:', error)
    }
  }

  const handleArchiveProject = async () => {
    if (!selectedProject) return

    try {
      await onUpdateProject(selectedProject.id, { status: 'archived' })

      // Find the first active project to navigate to
      const firstActiveProject = projects.find(
        p => p.id !== selectedProject.id && p.status === 'active'
      )

      onProjectSelect(firstActiveProject || null)
      onClose()
    } catch (error) {
      console.error('Error archiving project:', error)
    }
  }

  if (!isOpen || !selectedProject) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">Project Settings</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-neutral-900 mb-2">{selectedProject.name}</h3>
            <p className="text-sm text-neutral-600">{selectedProject.description}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Hourly Rate</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-600">$</span>
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
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-neutral-200">
            <button
              onClick={handleArchiveProject}
              className="px-4 py-2 text-red-600 hover:text-red-800 text-sm"
            >
              Archive Project
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-neutral-600 text-sm hover:text-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateProjectSettings}
                className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
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
