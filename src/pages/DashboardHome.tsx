import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderOpen, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useUserContext } from '../contexts/UserContext'

interface ProjectSummary {
  id: string
  name: string
  color: string
  status: string
  hourly_rate: number | null
  total_hours: number
}

const DashboardHome = () => {
  const { user } = useUserContext()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const fetchProjects = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, color, status, hourly_rate')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('name')

      if (error) {
        console.error('Error fetching projects:', error)
        setLoading(false)
        return
      }

      // Fetch total hours per project from sessions
      const { data: sessions } = await supabase
        .from('sessions')
        .select('project_id, scheduled_hours')
        .eq('user_id', user.id)

      const hoursByProject = new Map<string, number>()
      sessions?.forEach(s => {
        const current = hoursByProject.get(s.project_id) || 0
        hoursByProject.set(s.project_id, current + (s.scheduled_hours || 0))
      })

      setProjects(
        (data || []).map(p => ({
          ...p,
          total_hours: hoursByProject.get(p.id) || 0,
        }))
      )
      setLoading(false)
    }

    fetchProjects()
  }, [user])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold text-neutral-900 mb-4">Dashboard</h1>

      <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3">Active Projects</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {projects.map(project => (
          <Link
            key={project.id}
            to={`/projects?project=${project.id}`}
            className="flex-shrink-0 w-48 bg-white border border-neutral-200 rounded-lg p-3 hover:border-primary-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color || '#6b7280' }}
              />
              <span className="text-sm font-medium text-neutral-900 truncate">{project.name}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-neutral-500">
              <Clock className="w-3 h-3" />
              <span>{project.total_hours.toFixed(1)}h logged</span>
            </div>
            {project.hourly_rate && (
              <div className="text-xs text-neutral-400 mt-1">
                ${project.hourly_rate}/hr
              </div>
            )}
          </Link>
        ))}
        {projects.length === 0 && (
          <div className="text-sm text-neutral-500 py-4">
            No active projects. <Link to="/projects" className="text-primary-600 hover:underline">Create one</Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default DashboardHome
