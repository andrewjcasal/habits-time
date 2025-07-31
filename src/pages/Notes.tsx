import { useState, useEffect, useRef } from 'react'
import { Search, FileText, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import AddButton from '../components/AddButton'
import LoadingSpinner from '../components/LoadingSpinner'

interface Note {
  id: string
  content: string
  created_at: string
  updated_at: string
  start_time: string
  end_time: string
}

const Notes = () => {
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showMobileDetail, setShowMobileDetail] = useState(false)
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch notes from database
  const fetchNotes = async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('habits_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (error) throw error
      setNotes(data || [])
    } catch (err) {
      console.error('Error fetching notes:', err)
    } finally {
      setLoading(false)
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

  // Get note title from content (first line)
  const getNoteTitle = (content: string) => {
    const firstLine = content.split('\n')[0].trim()
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

  // Filter notes based on search
  const filteredNotes = notes.filter(note =>
    note.content.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    fetchNotes()
  }, [user])

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
    <div className="flex h-screen bg-white overflow-hidden max-w-full">
      {/* Left Sidebar - Full width on mobile, fixed width on desktop */}
      <aside
        className={`w-full md:w-80 border-r border-neutral-200 bg-neutral-50 flex flex-col flex-shrink-0 md:flex ${
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
              placeholder="Search notes..."
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
              Notes written here contribute to AI reflection generation and enhance Reddit link suggestions based on your content.
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
                <div className="text-sm font-medium text-neutral-900 mb-0 truncate w-full max-w-full overflow-hidden">
                  {getNoteTitle(note.content)}
                </div>
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
        className={`flex-1 flex flex-col min-w-0 overflow-hidden md:flex ${
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
                  <h2 className="text-lg font-medium text-neutral-900 truncate">
                    {getNoteTitle(selectedNote.content)}
                  </h2>
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
                {saving && (
                  <div className="text-sm text-neutral-500 flex-shrink-0 ml-4">Saving...</div>
                )}
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
