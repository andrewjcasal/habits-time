import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { MoreVertical, Tag, X, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import AddButton from '../components/AddButton'
import LoadingSpinner from '../components/LoadingSpinner'

interface Tag {
  id: string
  name: string
  color: string
}

interface Aspect {
  id: string
  title: string
}

interface Note {
  id: string
  content: string
  title?: string
  tags?: Tag[]
  aspects?: Aspect[]
  created_at: string
  updated_at: string
  start_time: string
  end_time: string
}

const Notes = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [addingTag, setAddingTag] = useState(false)
  const [aspects, setAspects] = useState<Aspect[]>([])
  const [selectedAspectId, setSelectedAspectId] = useState<string>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const [cardDropdownId, setCardDropdownId] = useState<string | null>(null)
  const cardDropdownRef = useRef<HTMLDivElement | null>(null)
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  // Fetch notes from database with tags and aspects
  const fetchNotes = async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('cassian_habits_notes')
        .select(
          `
          *,
          note_tags:cassian_note_tags (
            tag_id,
            tags:cassian_tags (
              id,
              name,
              color
            )
          ),
          note_aspects:cassian_note_aspects (
            aspect_id,
            aspects:cassian_aspects (
              id,
              title
            )
          )
        `
        )
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (error) throw error

      // Transform the data to flatten tags and aspects
      const notesWithTagsAndAspects = (data || []).map(note => ({
        ...note,
        tags: note.note_tags?.map((nt: any) => nt.tags).filter(Boolean) || [],
        aspects: note.note_aspects?.map((na: any) => na.aspects).filter(Boolean) || [],
      }))

      setNotes(notesWithTagsAndAspects)
    } catch (err) {
      console.error('Error fetching notes:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch aspects from database
  const fetchAspects = async () => {
    try {
      const { data, error } = await supabase
        .from('cassian_aspects')
        .select('*')
        .order('title', { ascending: true })

      if (error) throw error
      setAspects(data || [])
    } catch (err) {
      console.error('Error fetching aspects:', err)
    }
  }

  // Create new note
  const createNewNote = async () => {
    if (!user) return

    try {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('cassian_habits_notes')
        .insert({
          user_id: user.id,
          content: '',
          created_at: now,
          updated_at: now,
          start_time: now,
          end_time: now,
        })
        .select()
        .single()

      if (error) throw error

      const newNote = data as Note
      setNotes(prev => [newNote, ...prev])
      setSelectedNote(newNote)
      setModalOpen(true)
    } catch (err) {
      console.error('Error creating note:', err)
    }
  }

  // Save note with debounced autosave
  const saveNote = async (noteId: string, content: string) => {
    try {
      setSaving(true)
      const { error } = await supabase
        .from('cassian_habits_notes')
        .update({
          content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', noteId)

      if (error) throw error

      // Update local state without affecting selectedNote to preserve cursor
      setNotes(prev =>
        prev.map(note =>
          note.id === noteId ? { ...note, content, updated_at: new Date().toISOString() } : note
        )
      )

      // Extract wins from the note content (async, non-blocking)
      if (user && content.trim().length > 20) {
        supabase.functions
          .invoke('extract-wins', {
            body: {
              noteId,
              noteContent: content,
              userId: user.id,
            },
          })
          .catch(err => console.error('Win extraction failed:', err))
      }
    } catch (err) {
      console.error('Error saving note:', err)
    } finally {
      setSaving(false)
    }
  }

  // Save note title
  // Save note date
  const saveNoteDate = async (noteId: string, dateStr: string) => {
    try {
      setSaving(true)
      const isoDate = new Date(dateStr).toISOString()
      const { error } = await supabase
        .from('cassian_habits_notes')
        .update({ start_time: isoDate })
        .eq('id', noteId)

      if (error) throw error

      setNotes(prev =>
        prev.map(note =>
          note.id === noteId ? { ...note, start_time: isoDate } : note
        )
      )

      if (selectedNote?.id === noteId) {
        setSelectedNote(prev => prev ? { ...prev, start_time: isoDate } : null)
      }
    } catch (err) {
      console.error('Error saving note date:', err)
    } finally {
      setSaving(false)
    }
  }

  const saveNoteTitle = async (noteId: string, title: string) => {
    try {
      setSaving(true)
      const { error } = await supabase
        .from('cassian_habits_notes')
        .update({
          title,
          updated_at: new Date().toISOString(),
        })
        .eq('id', noteId)

      if (error) throw error

      setNotes(prev =>
        prev.map(note =>
          note.id === noteId ? { ...note, title, updated_at: new Date().toISOString() } : note
        )
      )

      if (selectedNote?.id === noteId) {
        setSelectedNote(prev =>
          prev ? { ...prev, title, updated_at: new Date().toISOString() } : null
        )
      }
    } catch (err) {
      console.error('Error saving note title:', err)
    } finally {
      setSaving(false)
    }
  }

  // Add tag to note
  const addTag = async (noteId: string, tagName: string) => {
    if (!tagName.trim()) return

    try {
      setSaving(true)
      const note = notes.find(n => n.id === noteId)
      const currentTags = note?.tags || []
      const normalizedTagName = tagName.trim().toLowerCase()

      if (currentTags.some(tag => tag.name.toLowerCase() === normalizedTagName)) {
        setSaving(false)
        return
      }

      let tag: Tag
      const { data: existingTag, error: findError } = await supabase
        .from('cassian_tags')
        .select('*')
        .eq('name', normalizedTagName)
        .maybeSingle()

      if (findError) throw findError

      if (existingTag) {
        tag = existingTag
      } else {
        const { data: newTag, error: createError } = await supabase
          .from('cassian_tags')
          .insert({ name: normalizedTagName })
          .select()
          .single()

        if (createError) throw createError
        tag = newTag
      }

      const { error: linkError } = await supabase.from('cassian_note_tags').insert({
        note_id: noteId,
        tag_id: tag.id,
      })

      if (linkError) throw linkError

      const updatedTags = [...currentTags, tag]
      setNotes(prev =>
        prev.map(note =>
          note.id === noteId
            ? { ...note, tags: updatedTags, updated_at: new Date().toISOString() }
            : note
        )
      )

      if (selectedNote?.id === noteId) {
        setSelectedNote(prev =>
          prev ? { ...prev, tags: updatedTags, updated_at: new Date().toISOString() } : null
        )
      }
    } catch (err) {
      console.error('Error adding tag:', err)
    } finally {
      setSaving(false)
    }
  }

  // Remove tag from note
  const removeTag = async (noteId: string, tagId: string) => {
    try {
      setSaving(true)

      const { error } = await supabase
        .from('cassian_note_tags')
        .delete()
        .eq('note_id', noteId)
        .eq('tag_id', tagId)

      if (error) throw error

      setNotes(prev =>
        prev.map(note =>
          note.id === noteId
            ? {
                ...note,
                tags: note.tags?.filter(tag => tag.id !== tagId) || [],
                updated_at: new Date().toISOString(),
              }
            : note
        )
      )

      if (selectedNote?.id === noteId) {
        setSelectedNote(prev =>
          prev
            ? {
                ...prev,
                tags: prev.tags?.filter(tag => tag.id !== tagId) || [],
                updated_at: new Date().toISOString(),
              }
            : null
        )
      }
    } catch (err) {
      console.error('Error removing tag:', err)
    } finally {
      setSaving(false)
    }
  }

  // Add aspect to note
  const addAspect = async (noteId: string, aspectId: string) => {
    if (!aspectId) return

    try {
      setSaving(true)
      const note = notes.find(n => n.id === noteId)
      const currentAspects = note?.aspects || []

      if (currentAspects.some(aspect => aspect.id === aspectId)) {
        setSaving(false)
        return
      }

      const aspect = aspects.find(a => a.id === aspectId)
      if (!aspect) {
        setSaving(false)
        return
      }

      const { error: linkError } = await supabase
        .from('cassian_note_aspects')
        .insert({
          note_id: noteId,
          aspect_id: aspectId
        })

      if (linkError) throw linkError

      const updatedAspects = [...currentAspects, aspect]
      setNotes(prev =>
        prev.map(note =>
          note.id === noteId ? { ...note, aspects: updatedAspects, updated_at: new Date().toISOString() } : note
        )
      )

      if (selectedNote?.id === noteId) {
        setSelectedNote(prev => prev ? { ...prev, aspects: updatedAspects, updated_at: new Date().toISOString() } : null)
      }
    } catch (err) {
      console.error('Error adding aspect:', err)
    } finally {
      setSaving(false)
    }
  }

  // Remove aspect from note
  const removeAspect = async (noteId: string, aspectId: string) => {
    try {
      setSaving(true)

      const { error } = await supabase
        .from('cassian_note_aspects')
        .delete()
        .eq('note_id', noteId)
        .eq('aspect_id', aspectId)

      if (error) throw error

      setNotes(prev =>
        prev.map(note =>
          note.id === noteId
            ? {
                ...note,
                aspects: note.aspects?.filter(aspect => aspect.id !== aspectId) || [],
                updated_at: new Date().toISOString()
              }
            : note
        )
      )

      if (selectedNote?.id === noteId) {
        setSelectedNote(prev =>
          prev ? {
            ...prev,
            aspects: prev.aspects?.filter(aspect => aspect.id !== aspectId) || [],
            updated_at: new Date().toISOString()
          } : null
        )
      }
    } catch (err) {
      console.error('Error removing aspect:', err)
    } finally {
      setSaving(false)
    }
  }

  // Handle content change with autosave
  const handleContentChange = (content: string) => {
    if (!selectedNote) return

    setSelectedNote(prev => (prev ? { ...prev, content } : null))

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      saveNote(selectedNote.id, content)
    }, 500)
  }

  // Get note title from database or content (first line)
  const getNoteTitle = (note: Note) => {
    if (note.title && note.title.trim()) {
      return note.title
    }
    const firstLine = note.content.split('\n')[0].trim()
    return firstLine || 'Untitled Note'
  }

  // Get note preview (first few lines of content, excluding title line)
  const getNotePreview = (note: Note) => {
    return note.content.replace(/[#*`]/g, '').trim() || 'No additional text'
  }

  // Handle note selection - open modal
  const handleNoteSelect = (note: Note) => {
    setSelectedNote(note)
    setModalOpen(true)
  }

  // Close modal
  const closeModal = () => {
    // Flush any pending autosave
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
      if (selectedNote) {
        saveNote(selectedNote.id, selectedNote.content)
      }
    }
    setModalOpen(false)
    setSelectedNote(null)
    setEditingTitle(false)
    setEditingDate(false)
    setShowDropdown(false)
    setAddingTag(false)
    setNewTag('')
  }

  // Handle adding new tag
  const handleAddTag = async () => {
    if (!selectedNote || !newTag.trim()) return

    await addTag(selectedNote.id, newTag)
    setNewTag('')
    setAddingTag(false)
  }

  // Delete note
  const deleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      return
    }

    try {
      setSaving(true)
      const { error } = await supabase.from('cassian_habits_notes').delete().eq('id', noteId)

      if (error) throw error

      setNotes(prev => prev.filter(note => note.id !== noteId))

      if (selectedNote?.id === noteId) {
        setModalOpen(false)
        setSelectedNote(null)
      }

      setShowDropdown(false)
    } catch (err) {
      console.error('Error deleting note:', err)
    } finally {
      setSaving(false)
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
        setAddingTag(false)
        setNewTag('')
      }
      if (cardDropdownRef.current && !cardDropdownRef.current.contains(event.target as Node)) {
        setCardDropdownId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter notes based on search
  const filteredNotes = notes.filter(note => {
    const searchLower = searchTerm.toLowerCase()
    const titleMatch = note.title?.toLowerCase().includes(searchLower)
    const contentMatch = note.content.toLowerCase().includes(searchLower)
    const tagMatch = note.tags?.some(tag => tag.name.toLowerCase().includes(searchLower))
    const aspectMatch = note.aspects?.some(aspect => aspect.title.toLowerCase().includes(searchLower))

    return titleMatch || contentMatch || tagMatch || aspectMatch
  })

  // Group filtered notes by month
  const notesByMonth = useMemo(() => {
    const grouped = new Map<string, typeof filteredNotes>()
    filteredNotes.forEach(note => {
      const d = new Date(note.start_time || note.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const arr = grouped.get(key) || []
      arr.push(note)
      grouped.set(key, arr)
    })
    return [...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filteredNotes])

  useEffect(() => {
    fetchNotes()
    fetchAspects()
  }, [user])

  // Handle noteId query parameter
  useEffect(() => {
    const noteId = searchParams.get('noteId')
    if (noteId && notes.length > 0) {
      const note = notes.find(n => n.id === noteId)
      if (note) {
        setSelectedNote(note)
        setModalOpen(true)
      }
    }
  }, [notes, searchParams, setSearchParams])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current)
      }
    }
  }, [])

  if (loading) {
    return <LoadingSpinner message="Loading notes..." />
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search notes, titles, tags, aspects..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
            <AddButton onClick={createNewNote} />
          </div>
        </div>
      </div>

      {/* Card Grid */}
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-6">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 text-sm">
            {searchTerm ? 'No notes found' : 'No notes yet. Create one to get started!'}
          </div>
        ) : (
          <div className="space-y-6">
            {notesByMonth.map(([monthKey, monthNotes]) => {
              const [year, month] = monthKey.split('-').map(Number)
              const monthLabel = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              return (
                <div key={monthKey}>
                  <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-2">{monthLabel}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {monthNotes.map(note => (
              <div
                key={note.id}
                onClick={() => handleNoteSelect(note)}
                className="bg-white border border-neutral-200 rounded-lg p-2 cursor-pointer hover:shadow-md hover:border-neutral-300 transition-all group relative"
              >
                {/* Card dropdown */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="relative" ref={cardDropdownId === note.id ? cardDropdownRef : undefined}>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setCardDropdownId(cardDropdownId === note.id ? null : note.id)
                      }}
                      className="p-1 text-neutral-400 hover:text-neutral-700 rounded hover:bg-neutral-100 transition-colors"
                    >
                      <MoreVertical className="w-3 h-3" />
                    </button>
                    {cardDropdownId === note.id && (
                      <div className="absolute right-0 top-6 bg-white border border-neutral-200 rounded-md shadow-lg z-10 whitespace-nowrap">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setCardDropdownId(null)
                            deleteNote(note.id)
                          }}
                          className="flex items-center gap-1 w-full px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete note
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {note.tags && note.tags.length > 0 && (
                  <div className="absolute -top-2 left-0 flex flex-wrap gap-1">
                    {note.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded shadow-sm"
                        style={{
                          backgroundColor: tag.color,
                          color: '#fff',
                        }}
                      >
                        {tag.name}
                      </span>
                    ))}
                    {note.tags.length > 3 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-neutral-500 text-white rounded shadow-sm">
                        +{note.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}



                {/* Aspects */}
                {note.aspects && note.aspects.length > 0 && (
                  <div className="text-xs text-green-700 mb-1.5 font-medium truncate">
                    {note.aspects.map(aspect => aspect.title).join(', ')}
                  </div>
                )}

                {/* Preview */}
                <p
                  className="text-xs text-neutral-500 mb-2 overflow-hidden"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 6,
                    WebkitBoxOrient: 'vertical' as const,
                    wordWrap: 'break-word',
                  }}
                >
                  {getNotePreview(note)}
                </p>

                {/* Date */}
                <div className="text-xs text-neutral-400">
                  {new Date(note.updated_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Note Modal */}
      {modalOpen && selectedNote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={e => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-neutral-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1 mr-3">
                  {editingTitle ? (
                    <input
                      type="text"
                      value={selectedNote.title || ''}
                      onChange={e =>
                        setSelectedNote(prev => (prev ? { ...prev, title: e.target.value } : null))
                      }
                      onBlur={() => {
                        setEditingTitle(false)
                        if (selectedNote) {
                          const trimmedTitle = selectedNote.title?.trim()
                          if (trimmedTitle) {
                            saveNoteTitle(selectedNote.id, trimmedTitle)
                          }
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          setEditingTitle(false)
                          if (selectedNote) {
                            const trimmedTitle = selectedNote.title?.trim()
                            if (trimmedTitle) {
                              saveNoteTitle(selectedNote.id, trimmedTitle)
                            }
                          }
                        }
                        if (e.key === 'Escape') {
                          setEditingTitle(false)
                          const originalNote = notes.find(n => n.id === selectedNote.id)
                          if (originalNote && selectedNote) {
                            setSelectedNote(prev =>
                              prev ? { ...prev, title: originalNote.title } : null
                            )
                          }
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
                      {getNoteTitle(selectedNote)}
                    </h2>
                  )}
                  {editingDate ? (
                    <input
                      type="datetime-local"
                      value={(() => {
                        const d = new Date(selectedNote.start_time || selectedNote.created_at)
                        const year = d.getFullYear()
                        const month = String(d.getMonth() + 1).padStart(2, '0')
                        const day = String(d.getDate()).padStart(2, '0')
                        const hours = String(d.getHours()).padStart(2, '0')
                        const mins = String(d.getMinutes()).padStart(2, '0')
                        return `${year}-${month}-${day}T${hours}:${mins}`
                      })()}
                      onChange={e => {
                        const val = e.target.value
                        setSelectedNote(prev => prev ? { ...prev, start_time: new Date(val).toISOString() } : null)
                      }}
                      onBlur={() => {
                        setEditingDate(false)
                        if (selectedNote) {
                          saveNoteDate(selectedNote.id, selectedNote.start_time || selectedNote.created_at)
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                          setEditingDate(false)
                          if (e.key === 'Enter' && selectedNote) {
                            saveNoteDate(selectedNote.id, selectedNote.start_time || selectedNote.created_at)
                          }
                        }
                      }}
                      autoFocus
                      className="text-sm text-neutral-500 bg-transparent border-b-2 border-primary-500 outline-none"
                    />
                  ) : (
                    <p
                      className="text-sm text-neutral-500 cursor-pointer hover:text-primary-600 transition-colors"
                      onClick={() => setEditingDate(true)}
                      title="Click to edit date"
                    >
                      {new Date(selectedNote.start_time || selectedNote.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {saving && <div className="text-sm text-neutral-500">Saving...</div>}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="p-1 text-neutral-500 hover:text-neutral-700 transition-colors rounded hover:bg-neutral-100"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {showDropdown && (
                      <div className="absolute right-0 top-8 bg-white border border-neutral-200 rounded-md shadow-lg z-10 min-w-36">
                        {/* Current tags */}
                        {selectedNote.tags && selectedNote.tags.length > 0 && (
                          <div className="p-1.5 border-b border-neutral-100">
                            <div className="text-xs font-medium text-neutral-600 mb-1">Tags</div>
                            <div className="flex flex-wrap gap-0.5">
                              {selectedNote.tags.map(tag => (
                                <span
                                  key={tag.id}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium rounded"
                                  style={{
                                    backgroundColor: `${tag.color}20`,
                                    color: tag.color,
                                  }}
                                >
                                  {tag.name}
                                  <button
                                    onClick={() => removeTag(selectedNote.id, tag.id)}
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
                        {selectedNote.aspects && selectedNote.aspects.length > 0 && (
                          <div className="p-1.5 border-b border-neutral-100">
                            <div className="text-xs font-medium text-neutral-600 mb-1">Aspects</div>
                            <div className="flex flex-wrap gap-0.5">
                              {selectedNote.aspects.map((aspect) => (
                                <span
                                  key={aspect.id}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800"
                                >
                                  {aspect.title}
                                  <button
                                    onClick={() => removeAspect(selectedNote.id, aspect.id)}
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
                        <div className="p-1.5 border-b border-neutral-100">
                          <select
                            value={selectedAspectId}
                            onChange={(e) => {
                              const aspectId = e.target.value
                              if (aspectId && selectedNote) {
                                addAspect(selectedNote.id, aspectId)
                                setSelectedAspectId('')
                              }
                            }}
                            className="w-full text-xs border border-neutral-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          >
                            <option value="">Add aspect...</option>
                            {aspects
                              .filter(aspect =>
                                !selectedNote.aspects?.some(noteAspect => noteAspect.id === aspect.id)
                              )
                              .map(aspect => (
                                <option key={aspect.id} value={aspect.id}>
                                  {aspect.title}
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Add new tag */}
                        {addingTag ? (
                          <div className="flex items-center gap-1 p-1.5 border-b border-neutral-100">
                            <input
                              type="text"
                              value={newTag}
                              onChange={e => setNewTag(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  handleAddTag()
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
                              onClick={handleAddTag}
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
                        <button
                          onClick={() => deleteNote(selectedNote.id)}
                          className="flex items-center gap-1.5 w-full px-1.5 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-2 h-2" />
                          Delete note
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={closeModal}
                    className="p-1 text-neutral-500 hover:text-neutral-700 transition-colors rounded hover:bg-neutral-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Note Editor */}
            <div className="flex-1 p-5 overflow-auto min-h-0">
              <textarea
                value={selectedNote.content}
                onChange={e => handleContentChange(e.target.value)}
                placeholder="Start writing your note..."
                className="w-full h-full min-h-[40vh] resize-none border-none outline-none text-neutral-900 placeholder-neutral-400 text-base leading-relaxed block"
                style={{
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Notes
