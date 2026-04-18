import { useState, useEffect, useRef } from 'react'
import { X, MoreVertical, Tag, Trash2, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ModalWrapper from './ModalWrapper'

interface Issue {
  id: string
  name: string
}

interface NoteIssue {
  id: string
  issue_id: string
  intensity: number
  issue: Issue
}

interface NoteModalProps {
  note: any
  isOpen: boolean
  onClose: () => void
  onUpdate?: (updatedNote: any) => void
  onDelete?: (noteId: string) => void
  // Extended props for Notes page
  showExtended?: boolean
  saving?: boolean
  onSaveTitle?: (noteId: string, title: string) => void
  onSaveDate?: (noteId: string, startDate: string, startTime: string | null) => void
  onSaveContent?: (noteId: string, content: string) => void
  onAddTag?: (noteId: string, tagName: string) => void
  onRemoveTag?: (noteId: string, tagId: string) => void
  onAddAspect?: (noteId: string, aspectId: string) => void
  onRemoveAspect?: (noteId: string, aspectId: string) => void
  aspects?: { id: string; title: string }[]
  initialNoteIssues?: NoteIssue[]
  initialAllIssues?: Issue[]
  onIssuesChange?: (noteId: string, issues: NoteIssue[]) => void
}

export default function NoteModal({
  note, isOpen, onClose, onUpdate, onDelete,
  showExtended, saving, onSaveTitle, onSaveDate, onSaveContent,
  onAddTag, onRemoveTag, onAddAspect, onRemoveAspect, aspects,
  initialNoteIssues, initialAllIssues, onIssuesChange,
}: NoteModalProps) {
  const [title, setTitle] = useState(note?.title || '')
  const [content, setContent] = useState(note?.content || '')
  const [editingDate, setEditingDate] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [startDate, setStartDate] = useState<string>(
    note?.start_date || (note?.created_at ? note.created_at.slice(0, 10) : '')
  )
  const [startTime, setStartTime] = useState<string | null>(
    note?.start_time ? note.start_time.slice(0, 5) : null
  )
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Extended state
  const [showDropdown, setShowDropdown] = useState(false)
  const [addingTag, setAddingTag] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [selectedAspectId, setSelectedAspectId] = useState('')
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  // Issues state
  const [noteIssues, setNoteIssues] = useState<NoteIssue[]>(initialNoteIssues || [])
  const [allIssues, setAllIssues] = useState<Issue[]>(initialAllIssues || [])
  const [addingIssue, setAddingIssue] = useState(false)
  const [newIssueName, setNewIssueName] = useState('')
  const [selectedIssueId, setSelectedIssueId] = useState('')

  useEffect(() => {
    if (note) {
      setTitle(note.title || '')
      setContent(note.content || '')
      setStartDate(note.start_date || (note.created_at ? note.created_at.slice(0, 10) : ''))
      setStartTime(note.start_time ? note.start_time.slice(0, 5) : null)
    }
  }, [note?.id])

  // Load issues when modal opens in extended mode (skip if prefetched)
  useEffect(() => {
    if (!isOpen || !showExtended || !note?.id) return
    if (initialNoteIssues) {
      setNoteIssues(initialNoteIssues)
    } else {
      loadNoteIssues()
    }
    if (!initialAllIssues) {
      loadAllIssues()
    }
  }, [isOpen, note?.id, showExtended])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
        setAddingTag(false)
        setNewTag('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadNoteIssues = async () => {
    const { data } = await supabase
      .from('cassian_note_issues')
      .select('*, issue:cassian_issues(*)')
      .eq('note_id', note.id)
    setNoteIssues(data || [])
  }

  const loadAllIssues = async () => {
    const { data } = await supabase
      .from('cassian_issues')
      .select('*')
      .eq('is_archived', false)
      .order('name')
    setAllIssues(data || [])
  }

  const addIssueToNote = async (issueId: string, intensity: number) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('cassian_note_issues')
      .insert({ note_id: note.id, issue_id: issueId, intensity, user_id: user.id })
      .select('*, issue:cassian_issues(*)')
      .single()
    if (!error && data) {
      const updated = [...noteIssues, data]
      setNoteIssues(updated)
      onIssuesChange?.(note.id, updated)
    }
  }

  const updateIssueIntensity = async (noteIssueId: string, intensity: number) => {
    await supabase
      .from('cassian_note_issues')
      .update({ intensity })
      .eq('id', noteIssueId)
    const updated = noteIssues.map(ni => ni.id === noteIssueId ? { ...ni, intensity } : ni)
    setNoteIssues(updated)
    onIssuesChange?.(note.id, updated)
  }

  const removeIssueFromNote = async (noteIssueId: string) => {
    await supabase.from('cassian_note_issues').delete().eq('id', noteIssueId)
    const updated = noteIssues.filter(ni => ni.id !== noteIssueId)
    setNoteIssues(updated)
    onIssuesChange?.(note.id, updated)
  }

  const createNewIssue = async (name: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('cassian_issues')
      .insert({ name, user_id: user.id })
      .select()
      .single()
    if (!error && data) {
      setAllIssues(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      return data
    }
    return null
  }

  const noteIdRef = useRef<string | null>(note?.id || null)

  useEffect(() => {
    noteIdRef.current = note?.id || null
  }, [note?.id])

  const ensureSaved = async (): Promise<string | null> => {
    if (noteIdRef.current) return noteIdRef.current
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const fallbackDate = startDate || new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('cassian_notes')
      .insert({
        title,
        content,
        start_date: fallbackDate,
        start_time: startTime ? `${startTime}:00` : null,
        user_id: user.id,
      })
      .select()
      .single()
    if (error || !data) return null
    noteIdRef.current = data.id
    onUpdate?.(data)
    return data.id
  }

  const saveField = async (field: string, value: any) => {
    if (!note) return
    const id = await ensureSaved()
    if (!id) return
    await supabase.from('cassian_notes').update({ [field]: value }).eq('id', id)
    onUpdate?.({ ...note, id, [field]: value })
  }

  const handleContentChange = (value: string) => {
    setContent(value)
    if (showExtended && onSaveContent) {
      onUpdate?.({ ...note, content: value })
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        onSaveContent(note.id, value)
      }, 500)
    } else {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        if (value.trim()) saveField('content', value)
      }, 500)
    }
  }

  if (!isOpen || !note) return null

  const formatDateDisplay = () => {
    if (!startDate) return 'No date'
    const [y, m, d] = startDate.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    const dateStr = dt.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
    if (!startTime) return dateStr
    const [h, min] = startTime.split(':').map(Number)
    const timeStr = new Date(2000, 0, 1, h, min).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit',
    })
    return `${dateStr}, ${timeStr}`
  }

  const persistDateTime = (nextDate: string, nextTime: string | null) => {
    const timeForDb = nextTime ? `${nextTime}:00` : null
    if (showExtended && onSaveDate && note.id) {
      onSaveDate(note.id, nextDate, timeForDb)
    } else {
      saveField('start_date', nextDate)
      saveField('start_time', timeForDb)
    }
  }

  const getNoteTitle = () => {
    if (note.title && note.title.trim()) return note.title
    const firstLine = (note.content || '').split('\n')[0].trim()
    return firstLine || 'Untitled Note'
  }

  // Issues not yet linked to this note
  const availableIssues = allIssues.filter(
    issue => !noteIssues.some(ni => ni.issue_id === issue.id)
  )

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} bare maxWidth="2xl">
      <div className="bg-white rounded-xl shadow-xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="pl-5 pr-3 py-1.5 border-b border-neutral-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-3">
              {showExtended && (
                editingTitle ? (
                  <input
                    type="text"
                    value={title}
                    onChange={e => {
                      setTitle(e.target.value)
                      onUpdate?.({ ...note, title: e.target.value })
                    }}
                    onBlur={() => {
                      setEditingTitle(false)
                      if (title.trim() && onSaveTitle) onSaveTitle(note.id, title.trim())
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        setEditingTitle(false)
                        if (title.trim() && onSaveTitle) onSaveTitle(note.id, title.trim())
                      }
                      if (e.key === 'Escape') {
                        setEditingTitle(false)
                        setTitle(note.title || '')
                      }
                    }}
                    placeholder="Enter title..."
                    autoFocus
                    className="text-lg font-medium text-neutral-900 bg-transparent border-b-2 border-primary-500 outline-none w-full"
                  />
                ) : (
                  <h2
                    className="text-lg font-medium text-neutral-900 truncate cursor-pointer hover:text-primary-600 transition-colors"
                    onClick={() => setEditingTitle(true)}
                    title="Click to edit title"
                  >
                    {getNoteTitle()}
                  </h2>
                )
              )}
              {editingDate ? (
                <div
                  className="flex items-center gap-2"
                  onBlur={e => {
                    const next = e.relatedTarget as Node | null
                    if (next && e.currentTarget.contains(next)) return
                    setEditingDate(false)
                    persistDateTime(startDate, startTime)
                  }}
                >
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => {
                      setStartDate(e.target.value)
                      if (showExtended) onUpdate?.({ ...note, start_date: e.target.value })
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === 'Escape') {
                        setEditingDate(false)
                        if (e.key === 'Enter') persistDateTime(startDate, startTime)
                      }
                    }}
                    autoFocus
                    className="text-sm text-neutral-500 bg-transparent border-b-2 border-primary-500 outline-none"
                  />
                  <input
                    type="time"
                    value={startTime || ''}
                    onChange={e => {
                      const v = e.target.value || null
                      setStartTime(v)
                      if (showExtended) onUpdate?.({ ...note, start_time: v ? `${v}:00` : null })
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === 'Escape') {
                        setEditingDate(false)
                        if (e.key === 'Enter') persistDateTime(startDate, startTime)
                      }
                    }}
                    placeholder="All day"
                    className="text-sm text-neutral-500 bg-transparent border-b-2 border-primary-500 outline-none"
                  />
                </div>
              ) : (
                <p
                  className="text-sm text-neutral-500 cursor-pointer hover:text-primary-600 transition-colors"
                  onClick={() => setEditingDate(true)}
                >
                  {formatDateDisplay()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {saving && <div className="text-sm text-neutral-500">Saving...</div>}
              {showExtended && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="p-1 text-neutral-500 hover:text-neutral-700 transition-colors rounded hover:bg-neutral-100"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </button>

                  {showDropdown && (
                    <div className="absolute right-0 top-8 bg-white border border-neutral-200 rounded-md shadow-lg z-10 min-w-36">
                      {/* Current tags */}
                      {note.tags && note.tags.length > 0 && (
                        <div className="p-1.5 border-b border-neutral-100">
                          <div className="text-xs font-medium text-neutral-600 mb-1">Tags</div>
                          <div className="flex flex-wrap gap-0.5">
                            {note.tags.map((tag: any) => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium rounded"
                                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                              >
                                {tag.name}
                                <button
                                  onClick={() => onRemoveTag?.(note.id, tag.id)}
                                  className="hover:opacity-70"
                                  style={{ color: tag.color }}
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Current aspects */}
                      {note.aspects && note.aspects.length > 0 && (
                        <div className="p-1.5 border-b border-neutral-100">
                          <div className="text-xs font-medium text-neutral-600 mb-1">Aspects</div>
                          <div className="flex flex-wrap gap-0.5">
                            {note.aspects.map((aspect: any) => (
                              <span
                                key={aspect.id}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800"
                              >
                                {aspect.title}
                                <button
                                  onClick={() => onRemoveAspect?.(note.id, aspect.id)}
                                  className="hover:opacity-70 text-green-600"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Add aspect */}
                      {aspects && (
                        <div className="p-1.5 border-b border-neutral-100">
                          <select
                            value={selectedAspectId}
                            onChange={e => {
                              const aspectId = e.target.value
                              if (aspectId) {
                                onAddAspect?.(note.id, aspectId)
                                setSelectedAspectId('')
                              }
                            }}
                            className="w-full text-xs border border-neutral-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          >
                            <option value="">Add aspect...</option>
                            {aspects
                              .filter(a => !note.aspects?.some((na: any) => na.id === a.id))
                              .map(a => (
                                <option key={a.id} value={a.id}>{a.title}</option>
                              ))}
                          </select>
                        </div>
                      )}

                      {/* Add new tag */}
                      {addingTag ? (
                        <div className="flex items-center gap-1 p-1.5 border-b border-neutral-100">
                          <input
                            type="text"
                            value={newTag}
                            onChange={e => setNewTag(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && newTag.trim()) {
                                onAddTag?.(note.id, newTag)
                                setNewTag('')
                                setAddingTag(false)
                              }
                              if (e.key === 'Escape') {
                                setAddingTag(false)
                                setNewTag('')
                              }
                            }}
                            placeholder="Tag name..."
                            autoFocus
                            className="flex-1 px-1.5 py-1 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                          <button
                            onClick={() => {
                              if (newTag.trim()) {
                                onAddTag?.(note.id, newTag)
                                setNewTag('')
                                setAddingTag(false)
                              }
                            }}
                            className="px-1.5 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600"
                          >
                            Add
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingTag(true)}
                          className="flex items-center gap-1.5 w-full px-1.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 transition-colors border-b border-neutral-100"
                        >
                          <Tag className="w-2 h-2" />
                          Add tag
                        </button>
                      )}

                      {/* Delete note */}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(note.id)}
                          className="flex items-center gap-1.5 w-full px-1.5 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-2 h-2" />
                          Delete note
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {!showExtended && onDelete && (
                <button
                  onClick={() => onDelete(note.id)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 text-neutral-500 hover:text-neutral-700 transition-colors rounded hover:bg-neutral-100"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-5 overflow-auto min-h-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => handleContentChange(e.target.value)}
            placeholder="Start writing your note..."
            className="w-full resize-none border-none outline-none text-neutral-900 placeholder-neutral-400 text-base leading-relaxed block overflow-y-auto"
            style={{
              height: '300px',
              ...(showExtended ? { fontFamily: 'system-ui, -apple-system, sans-serif', wordWrap: 'break-word', whiteSpace: 'pre-wrap' } : {}),
            }}
            autoFocus={!title}
          />

          {/* Issues - intensity and name above separator, controls below */}
          {showExtended && noteIssues.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {noteIssues.map((ni, idx) => (
                <div key={ni.id} className="group">
                  {idx === 0 && (
                    <span className="text-[10px] text-neutral-400 mb-0.5 block">Intensity</span>
                  )}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                      const isSelected = n <= ni.intensity
                      const selectedColor = n <= 3 ? 'bg-green-200 text-green-800'
                        : n <= 6 ? 'bg-yellow-200 text-yellow-800'
                        : n <= 8 ? 'bg-orange-200 text-orange-800'
                        : 'bg-red-200 text-red-800'
                      const unselectedColor = 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
                      return (
                        <button
                          key={n}
                          onClick={() => updateIssueIntensity(ni.id, n)}
                          className={`w-5 h-5 text-xs rounded transition-colors ${
                            isSelected ? selectedColor : unselectedColor
                          }`}
                        >
                          {n}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => removeIssueFromNote(ni.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-400 hover:text-red-500 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-sm text-neutral-800 mt-0.5 block">{ni.issue.name}</span>
                </div>
              ))}
            </div>
          )}

          {showExtended && (
            <div className="mt-2 pt-2 border-t border-neutral-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-neutral-700">Issues</h3>
                <button
                  onClick={() => setAddingIssue(!addingIssue)}
                  className="p-0.5 text-neutral-500 hover:text-neutral-700 rounded hover:bg-neutral-100"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Add issue */}
              {addingIssue && (
                <div className="flex items-center gap-2 mt-2">
                  <select
                    value={selectedIssueId}
                    onChange={async e => {
                      const issueId = e.target.value
                      if (issueId) {
                        await addIssueToNote(issueId, 5)
                        setSelectedIssueId('')
                      }
                    }}
                    className="flex-1 text-sm border border-neutral-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">Select existing issue...</option>
                    {availableIssues.map(issue => (
                      <option key={issue.id} value={issue.id}>{issue.name}</option>
                    ))}
                  </select>
                  <span className="text-xs text-neutral-400">or</span>
                  <input
                    type="text"
                    value={newIssueName}
                    onChange={e => setNewIssueName(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && newIssueName.trim()) {
                        const issue = await createNewIssue(newIssueName.trim())
                        if (issue) {
                          await addIssueToNote(issue.id, 5)
                          setNewIssueName('')
                        }
                      }
                      if (e.key === 'Escape') {
                        setAddingIssue(false)
                        setNewIssueName('')
                      }
                    }}
                    placeholder="New issue name..."
                    className="flex-1 text-sm border border-neutral-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalWrapper>
  )
}
