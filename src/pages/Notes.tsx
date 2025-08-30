import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, FileText, ArrowLeft, MoreVertical, Tag, X, Trash2, Target } from 'lucide-react'
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
  const [showMobileDetail, setShowMobileDetail] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [addingTag, setAddingTag] = useState(false)
  const [aspects, setAspects] = useState<Aspect[]>([])
  const [selectedAspectId, setSelectedAspectId] = useState<string>('')
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  // Fetch notes from database with tags and aspects
  const fetchNotes = async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('habits_notes')
        .select(
          `
          *,
          note_tags (
            tag_id,
            tags (
              id,
              name,
              color
            )
          ),
          note_aspects (
            aspect_id,
            aspects (
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
        .from('aspects')
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
        .from('habits_notes')
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
      setShowMobileDetail(true)
    } catch (err) {
      console.error('Error creating note:', err)
    }
  }

  // Save note with debounced autosave
  const saveNote = async (noteId: string, content: string) => {
    try {
      setSaving(true)
      const { error } = await supabase
        .from('habits_notes')
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
        // Only extract if substantial content
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

      // Don't update selectedNote during autosave to preserve cursor position
    } catch (err) {
      console.error('Error saving note:', err)
    } finally {
      setSaving(false)
    }
  }

  // Save note title
  const saveNoteTitle = async (noteId: string, title: string) => {
    try {
      setSaving(true)
      const { error } = await supabase
        .from('habits_notes')
        .update({
          title,
          updated_at: new Date().toISOString(),
        })
        .eq('id', noteId)

      if (error) throw error

      // Update local state
      setNotes(prev =>
        prev.map(note =>
          note.id === noteId ? { ...note, title, updated_at: new Date().toISOString() } : note
        )
      )

      // Update selected note
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

      // Check if tag already exists on this note
      if (currentTags.some(tag => tag.name.toLowerCase() === normalizedTagName)) {
        setSaving(false)
        return // Tag already exists on this note
      }

      // First, find or create the tag
      let tag: Tag
      const { data: existingTag, error: findError } = await supabase
        .from('tags')
        .select('*')
        .eq('name', normalizedTagName)
        .maybeSingle()

      if (findError) throw findError

      if (existingTag) {
        tag = existingTag
      } else {
        // Create new tag
        const { data: newTag, error: createError } = await supabase
          .from('tags')
          .insert({ name: normalizedTagName })
          .select()
          .single()

        if (createError) throw createError
        tag = newTag
      }

      // Create the note-tag relationship
      const { error: linkError } = await supabase.from('note_tags').insert({
        note_id: noteId,
        tag_id: tag.id,
      })

      if (linkError) throw linkError

      // Update local state
      const updatedTags = [...currentTags, tag]
      setNotes(prev =>
        prev.map(note =>
          note.id === noteId
            ? { ...note, tags: updatedTags, updated_at: new Date().toISOString() }
            : note
        )
      )

      // Update selected note
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

      // Remove the note-tag relationship
      const { error } = await supabase
        .from('note_tags')
        .delete()
        .eq('note_id', noteId)
        .eq('tag_id', tagId)

      if (error) throw error

      // Update local state
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

      // Update selected note
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
      
      // Check if aspect already exists on this note
      if (currentAspects.some(aspect => aspect.id === aspectId)) {
        setSaving(false)
        return // Aspect already exists on this note
      }

      // Find the aspect details
      const aspect = aspects.find(a => a.id === aspectId)
      if (!aspect) {
        setSaving(false)
        return
      }

      // Create the note-aspect relationship
      const { error: linkError } = await supabase
        .from('note_aspects')
        .insert({
          note_id: noteId,
          aspect_id: aspectId
        })

      if (linkError) throw linkError

      // Update local state
      const updatedAspects = [...currentAspects, aspect]
      setNotes(prev =>
        prev.map(note =>
          note.id === noteId ? { ...note, aspects: updatedAspects, updated_at: new Date().toISOString() } : note
        )
      )

      // Update selected note
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

      // Remove the note-aspect relationship
      const { error } = await supabase
        .from('note_aspects')
        .delete()
        .eq('note_id', noteId)
        .eq('aspect_id', aspectId)

      if (error) throw error

      // Update local state
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

      // Update selected note
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

    // Update selected note immediately for UI responsiveness
    setSelectedNote(prev => (prev ? { ...prev, content } : null))

    // Clear existing timeout
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }

    // Set new timeout for autosave
    autosaveTimeoutRef.current = setTimeout(() => {
      saveNote(selectedNote.id, content)
    }, 500) // 500ms delay
  }

  // Get note title from database or content (first line)
  const getNoteTitle = (note: Note) => {
    if (note.title && note.title.trim()) {
      return note.title
    }
    const firstLine = note.content.split('\n')[0].trim()
    return firstLine || 'Untitled Note'
  }

  // Get note preview (first few words)
  const getNotePreview = (content: string) => {
    const text = content.replace(/[#*`]/g, '').trim()
    const words = text.split(' ').slice(0, 10).join(' ')
    return words || 'No additional text'
  }

  // Handle note selection (mobile-aware)
  const handleNoteSelect = (note: Note) => {
    setSelectedNote(note)
    setShowMobileDetail(true)
  }

  // Handle back to list (mobile only)
  const handleBackToList = () => {
    setShowMobileDetail(false)
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
      const { error } = await supabase.from('habits_notes').delete().eq('id', noteId)

      if (error) throw error

      // Update local state
      setNotes(prev => prev.filter(note => note.id !== noteId))

      // Clear selected note if it was deleted
      if (selectedNote?.id === noteId) {
        setSelectedNote(null)
        setShowMobileDetail(false)
      }

      // Close dropdown
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
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter notes based on search (content, title, tags, and aspects)
  const filteredNotes = notes.filter(note => {
    const searchLower = searchTerm.toLowerCase()
    const titleMatch = note.title?.toLowerCase().includes(searchLower)
    const contentMatch = note.content.toLowerCase().includes(searchLower)
    const tagMatch = note.tags?.some(tag => tag.name.toLowerCase().includes(searchLower))
    const aspectMatch = note.aspects?.some(aspect => aspect.title.toLowerCase().includes(searchLower))

    return titleMatch || contentMatch || tagMatch || aspectMatch
  })

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
        setShowMobileDetail(true) // Show detail on mobile if note is selected
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
    <div className="flex grid grid-cols-5 h-screen bg-white overflow-hidden max-w-full">
      {/* Left Sidebar - Full width on mobile, fixed width on desktop */}
      <aside
        className={`col-span-5 md:col-span-2 border-r border-neutral-200 bg-neutral-50 flex flex-col flex-shrink-0 md:flex ${
          showMobileDetail ? 'hidden' : 'flex'
        }`}
      >
        {/* Header */}
        <div className="p-1 border-b border-neutral-200">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-lg font-semibold text-neutral-900">Notes</h1>
            <AddButton onClick={createNewNote} />
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-1 top-1/2 transform -translate-y-1/2 text-neutral-400 w-2 h-2" />
            <input
              type="text"
              placeholder="Search notes, titles, tags, aspects..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-1 py-1 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Info Banner */}
        <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
          <div className="flex items-start gap-2">
            <FileText className="w-3 h-3 mt-0.5 flex-shrink-0 text-blue-500" />
            <p className="leading-relaxed">
              Notes written here contribute to AI reflection generation and enhance Reddit link
              suggestions based on your content.
            </p>
          </div>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto w-full max-w-full">
          {filteredNotes.length === 0 ? (
            <div className="p-1 text-neutral-500 text-sm text-center">
              {searchTerm ? 'No notes found' : 'No notes yet'}
            </div>
          ) : (
            filteredNotes.map(note => (
              <div
                key={note.id}
                onClick={() => handleNoteSelect(note)}
                className={`p-1.5 border-b border-neutral-100 cursor-pointer hover:bg-neutral-100 transition-colors w-full max-w-full ${
                  selectedNote?.id === note.id ? 'bg-primary-50 border-primary-200' : ''
                }`}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  {note.tags && note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 flex-shrink-0 -ml-0.5">
                      {note.tags.slice(0, 2).map(tag => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center px-1 py-0 text-xs font-medium rounded"
                          style={{
                            backgroundColor: `${tag.color}20`,
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                      {note.tags.length > 2 && (
                        <span className="inline-flex items-center px-1 py-0 text-xs font-medium bg-neutral-100 text-neutral-600 rounded">
                          +{note.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-sm font-medium text-neutral-900 truncate flex-1 min-w-0">
                    {getNoteTitle(note)}
                  </div>
                </div>
                {note.aspects && note.aspects.length > 0 && (
                  <div className="text-xs text-green-700 mb-0.5 font-medium">
                    ASPECTS: {note.aspects.map(aspect => aspect.title.toUpperCase()).join(', ')}
                  </div>
                )}
                <div className="text-xs text-neutral-600 mb-0.5">
                  {new Date(note.updated_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
                <div
                  className="text-xs text-neutral-500 overflow-hidden w-full max-w-full"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as const,
                    wordWrap: 'break-word',
                  }}
                >
                  {getNotePreview(note.content)}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Content - Full width on mobile when showing detail, hidden when showing list on mobile */}
      <main
        className={`col-span-5 md:col-span-3 flex-col min-w-0 overflow-hidden md:flex ${
          showMobileDetail ? 'flex w-full' : 'hidden md:flex md:w-0'
        }`}
      >
        {selectedNote ? (
          <>
            {/* Note Header */}
            <div className="px-1 py-1 border-b border-neutral-200 bg-white flex-shrink-0">
              <div className="flex items-center justify-between">
                {/* Back button - only visible on mobile */}
                <button
                  onClick={handleBackToList}
                  className="md:hidden mr-1 p-0 text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" />
                </button>
                <div className="min-w-0 flex-1">
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
                          // Reset to original title
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
                  <p className="text-sm text-neutral-500">
                    Last updated{' '}
                    {new Date(selectedNote.updated_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
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
                </div>
              </div>
            </div>

            {/* Note Editor */}
            <div className="flex-1 p-1 overflow-auto min-h-0">
              <textarea
                value={selectedNote.content}
                onChange={e => handleContentChange(e.target.value)}
                placeholder="Start writing your note..."
                className="w-full h-full resize-none border-none outline-none text-neutral-900 placeholder-neutral-400 text-base leading-relaxed block"
                style={{
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-500">
            <div className="text-center">
              <div className="mb-4">
                <FileText className="w-16 h-16 mx-auto text-neutral-300" />
              </div>
              <h3 className="text-lg font-medium mb-2">Select a note to start editing</h3>
              <p className="text-sm">Choose a note from the sidebar or create a new one</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default Notes
