import { useState } from 'react'
import { X } from 'lucide-react'
import { Project } from '../types'

interface NewProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateProject: (projectData: {
    name: string
    description: string
    color: string
    status: string
  }) => Promise<Project>
  onProjectSelect: (project: Project) => void
}

const NewProjectModal = ({ isOpen, onClose, onCreateProject, onProjectSelect }: NewProjectModalProps) => {
  const [newProject, setNewProject] = useState({ name: '', description: '', color: '#3B82F6' })

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const project = await onCreateProject({
        name: newProject.name,
        description: newProject.description,
        color: newProject.color,
        status: 'active',
      })
      onProjectSelect(project)
      setNewProject({ name: '', description: '', color: '#3B82F6' })
      onClose()
    } catch (error) {
      console.error('Error creating project:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">Create New Project</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleCreateProject} className="space-y-4">
          <input
            type="text"
            placeholder="Project name"
            value={newProject.name}
            onChange={e => setNewProject({ ...newProject, name: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
            required
          />
          <textarea
            placeholder="Description (optional)"
            value={newProject.description}
            onChange={e => setNewProject({ ...newProject, description: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm resize-none"
            rows={3}
          />
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={newProject.color}
              onChange={e => setNewProject({ ...newProject, color: e.target.value })}
              className="w-8 h-8 border border-neutral-300 rounded"
            />
            <span className="text-sm text-neutral-600">Project color</span>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
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
  )
}

export default NewProjectModal