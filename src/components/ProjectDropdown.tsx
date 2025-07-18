import { forwardRef } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { Project } from '../types'

interface ProjectDropdownProps {
  selectedProject: Project | null
  projects: Project[]
  projectsLoading: boolean
  showDropdown: boolean
  onToggleDropdown: () => void
  onProjectSelect: (project: Project) => void
  onShowNewProjectForm: () => void
}

const ProjectDropdown = forwardRef<HTMLDivElement, ProjectDropdownProps>(
  ({ 
    selectedProject, 
    projects, 
    projectsLoading, 
    showDropdown, 
    onToggleDropdown,
    onProjectSelect,
    onShowNewProjectForm
  }, ref) => {
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={onToggleDropdown}
          className="px-2 py-1 flex items-center gap-1 text-sm bg-neutral-50 border-r border-neutral-200 transition-colors min-w-0 max-w-64"
        >
          {selectedProject ? (
            <>
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: selectedProject.color || '#3B82F6',
                }}
              />
              <span className="text-neutral-900 truncate">{selectedProject.name}</span>
            </>
          ) : (
            <span className="text-neutral-500">Select a project</span>
          )}
          <ChevronDown className="w-2 h-2 text-neutral-500 flex-shrink-0" />
        </button>

        {showDropdown && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-neutral-200 shadow-lg z-50 max-h-80 overflow-y-auto">
            <div className="border-b border-neutral-100 pl-0.5">
              <button
                onClick={() => {
                  onShowNewProjectForm()
                  onToggleDropdown()
                }}
                className="w-full flex items-center gap-1 px-1 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                <Plus className="w-2 h-2" />
                Create new project
              </button>
            </div>
            <div>
              {projectsLoading ? (
                <div className="p-2 text-neutral-500 text-sm text-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mx-auto mb-1"></div>
                  Loading projects...
                </div>
              ) : projects.length === 0 ? (
                <div className="p-2 text-neutral-500 text-sm text-center">No projects yet</div>
              ) : (
                projects.map(project => {
                  const isSelected = selectedProject?.id === project.id
                  return (
                    <button
                      key={project.id}
                      onClick={() => onProjectSelect(project)}
                      className={`w-full text-left p-1.5 hover:bg-neutral-50 transition-colors ${
                        isSelected ? 'bg-primary-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: project.color || '#3B82F6',
                          }}
                        />
                        <div
                          className={`text-sm truncate ${
                            isSelected
                              ? 'font-bold text-neutral-900'
                              : 'font-normal text-neutral-900'
                          }`}
                        >
                          {project.name}
                        </div>
                      </div>
                      {project.description && (
                        <div className="text-xs text-neutral-600 mt-0.5 line-clamp-1 ml-3.5">
                          {project.description}
                        </div>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    )
  }
)

ProjectDropdown.displayName = 'ProjectDropdown'

export default ProjectDropdown