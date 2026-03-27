import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { MoreVertical, Trash2, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import LoadingSpinner from '../components/LoadingSpinner'

interface Issue {
  id: string
  name: string
  is_archived: boolean
}

interface NoteIssueRow {
  issue_id: string
  intensity: number
  note: {
    id: string
    start_time: string
    created_at: string
  }
}

const Issues = () => {
  const { user } = useAuth()
  const [issues, setIssues] = useState<Issue[]>([])
  const [noteIssues, setNoteIssues] = useState<NoteIssueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredCell, setHoveredCell] = useState<{ issueId: string; monthKey: string } | null>(null)
  const [dropdownIssueId, setDropdownIssueId] = useState<string | null>(null)
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownIssueId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const renameIssue = async (issueId: string, name: string) => {
    if (!name.trim()) return
    await supabase.from('cassian_issues').update({ name: name.trim() }).eq('id', issueId)
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, name: name.trim() } : i))
    setEditingIssueId(null)
  }

  const deleteIssue = async (issueId: string) => {
    if (!confirm('Delete this issue? This will remove it from all notes.')) return
    await supabase.from('cassian_note_issues').delete().eq('issue_id', issueId)
    await supabase.from('cassian_issues').delete().eq('id', issueId)
    setIssues(prev => prev.filter(i => i.id !== issueId))
    setNoteIssues(prev => prev.filter(ni => ni.issue_id !== issueId))
    setDropdownIssueId(null)
  }

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    const [issuesRes, noteIssuesRes] = await Promise.all([
      supabase
        .from('cassian_issues')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_archived', false)
        .order('name'),
      supabase
        .from('cassian_note_issues')
        .select('issue_id, intensity, note:cassian_habits_notes(id, start_time, created_at)')
        .eq('user_id', user!.id),
    ])
    setIssues(issuesRes.data || [])
    setNoteIssues(noteIssuesRes.data || [])
    setLoading(false)
  }

  // Build month columns from the data
  const monthColumns = useMemo(() => {
    if (noteIssues.length === 0) return []
    const monthSet = new Set<string>()
    noteIssues.forEach(ni => {
      const noteData = ni.note as any
      const d = new Date(noteData?.start_time || noteData?.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthSet.add(key)
    })
    return [...monthSet].sort()
  }, [noteIssues])

  // Check if two month keys are consecutive
  const areConsecutive = (a: string, b: string) => {
    const [aY, aM] = a.split('-').map(Number)
    const [bY, bM] = b.split('-').map(Number)
    const aTotal = aY * 12 + aM
    const bTotal = bY * 12 + bM
    return bTotal - aTotal === 1
  }

  // Build the grid data: issue -> month -> average intensity
  const gridData = useMemo(() => {
    const data = new Map<string, Map<string, { total: number; count: number }>>()
    noteIssues.forEach(ni => {
      const noteData = ni.note as any
      const d = new Date(noteData?.start_time || noteData?.created_at)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

      if (!data.has(ni.issue_id)) data.set(ni.issue_id, new Map())
      const issueMap = data.get(ni.issue_id)!
      if (!issueMap.has(monthKey)) issueMap.set(monthKey, { total: 0, count: 0 })
      const cell = issueMap.get(monthKey)!
      cell.total += ni.intensity
      cell.count += 1
    })
    return data
  }, [noteIssues])

  const getAverage = (issueId: string, monthKey: string): number | null => {
    const issueMap = gridData.get(issueId)
    if (!issueMap) return null
    const cell = issueMap.get(monthKey)
    if (!cell) return null
    return Math.round(cell.total / cell.count * 10) / 10
  }

  const getIntensityColor = (avg: number) => {
    if (avg <= 3) return 'bg-yellow-100 text-yellow-800'
    if (avg <= 6) return 'bg-orange-100 text-orange-800'
    return 'bg-red-100 text-red-800'
  }

  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-')
    const d = new Date(Number(year), Number(month) - 1)
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="p-4 pb-20 max-w-full overflow-x-auto">
      <h1 className="text-lg font-semibold text-neutral-900 mb-4">Issues</h1>

      {issues.length === 0 ? (
        <p className="text-sm text-neutral-500">No issues yet. Add issues to notes from the Notes page.</p>
      ) : (
        <div className="inline-block min-w-0 overflow-visible">
          <table className="border-collapse overflow-visible">
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-neutral-600 pr-3 pb-2 sticky left-0 z-10 min-w-[200px] max-w-[300px] pl-5">
                  Issue
                </th>
                {monthColumns.map((monthKey, i) => (
                  <Fragment key={monthKey}>
                    {i > 0 && !areConsecutive(monthColumns[i - 1], monthKey) && (
                      <th className="w-1 p-0" />
                    )}
                    <th className="text-center text-xs font-medium text-neutral-600 px-1.5 pb-2 min-w-[44px]">
                      {formatMonth(monthKey)}
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {issues.map(issue => (
                <tr key={issue.id} className="group">
                  <td
                    className={`text-sm text-neutral-800 pr-3 py-1 sticky left-0 max-w-[300px] ${dropdownIssueId === issue.id ? 'z-50' : 'z-10'}`}
                  >
                    <div className="flex items-center gap-1">
                      <div className="relative" ref={dropdownIssueId === issue.id ? dropdownRef : undefined}>
                        <button
                          onClick={() => setDropdownIssueId(dropdownIssueId === issue.id ? null : issue.id)}
                          className="p-0.5 text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-neutral-600 rounded hover:bg-neutral-100 transition-all"
                        >
                          <MoreVertical className="w-3 h-3" />
                        </button>
                        {dropdownIssueId === issue.id && (
                          <div className="absolute left-0 top-6 bg-white border border-neutral-200 rounded-md shadow-lg z-50 min-w-28">
                            <button
                              onClick={() => {
                                setEditingIssueId(issue.id)
                                setEditingName(issue.name)
                                setDropdownIssueId(null)
                              }}
                              className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 transition-colors"
                            >
                              <Pencil className="w-2 h-2" />
                              Rename
                            </button>
                            <button
                              onClick={() => deleteIssue(issue.id)}
                              className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-2 h-2" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                      {editingIssueId === issue.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onBlur={() => renameIssue(issue.id, editingName)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') renameIssue(issue.id, editingName)
                            if (e.key === 'Escape') setEditingIssueId(null)
                          }}
                          autoFocus
                          className="text-sm text-neutral-800 bg-transparent border-b border-primary-500 outline-none flex-1 min-w-0"
                        />
                      ) : (
                        <span className="truncate" title={issue.name}>{issue.name}</span>
                      )}
                    </div>
                  </td>
                  {monthColumns.map((monthKey, i) => {
                    const avg = getAverage(issue.id, monthKey)
                    const isHovered = hoveredCell?.issueId === issue.id && hoveredCell?.monthKey === monthKey
                    const hasGap = i > 0 && !areConsecutive(monthColumns[i - 1], monthKey)
                    return (
                      <Fragment key={monthKey}>
                        {hasGap && (
                          <td className="w-1 p-0 relative">
                            <svg width="4" height="100%" viewBox="0 0 4 48" preserveAspectRatio="none" className="absolute inset-0 w-full h-full text-neutral-300">
                              <path d="M0 0 L4 4 L0 8 L4 12 L0 16 L4 20 L0 24 L4 28 L0 32 L4 36 L0 40 L4 44 L0 48" fill="none" stroke="currentColor" strokeWidth="0.75" />
                            </svg>
                          </td>
                        )}
                      <td
                        className="text-center py-1 px-1.5"
                        onMouseEnter={() => setHoveredCell({ issueId: issue.id, monthKey })}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        {avg !== null ? (
                          <div
                            className={`inline-flex items-center justify-center w-9 h-7 rounded text-xs font-medium ${getIntensityColor(avg)} ${
                              isHovered ? 'ring-2 ring-neutral-400' : ''
                            }`}
                            title={`${issue.name} — ${formatMonth(monthKey)}: avg ${avg}`}
                          >
                            {avg}
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-center w-9 h-7 rounded text-xs text-neutral-300 bg-neutral-50">
                            —
                          </div>
                        )}
                      </td>
                      </Fragment>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Issues
