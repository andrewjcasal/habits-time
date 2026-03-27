import { useState, useRef, useEffect } from 'react'
import { X, FolderOpen } from 'lucide-react'
import { Project } from '../types'

interface NewProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateProject: (projectData: {
    name: string
    description: string
    status: string
  }) => Promise<Project>
  onProjectSelect: (project: Project) => void
}

const NewProjectModal = ({
  isOpen,
  onClose,
  onCreateProject,
  onProjectSelect,
}: NewProjectModalProps) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => nameRef.current?.focus(), 50)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      const project = await onCreateProject({
        name: name.trim(),
        description: description.trim(),
        status: 'active',
      })
      onProjectSelect(project)
      setName('')
      setDescription('')
      onClose()
    } catch (error) {
      console.error('Error creating project:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-primary-600" />
            <h2 className="text-sm font-semibold text-neutral-900">New Project</h2>
          </div>
          <button
            onClick={onClose}
            className="p-0.5 text-neutral-400 hover:text-neutral-600 rounded hover:bg-neutral-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Name</label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Project name"
              className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional"
              className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-none"
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default NewProjectModal
