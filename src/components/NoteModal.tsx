import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface NoteModalProps {
  note: any
  isOpen: boolean
  onClose: () => void
  onUpdate?: (updatedNote: any) => void
  onDelete?: (noteId: string) => void
}

export default function NoteModal({ note, isOpen, onClose, onUpdate, onDelete }: NoteModalProps) {
  const [title, setTitle] = useState(note?.title || '')
  const [content, setContent] = useState(note?.content || '')
  const [editingDate, setEditingDate] = useState(false)
  const [startTime, setStartTime] = useState(note?.start_time || note?.created_at || '')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (note) {
      setTitle(note.title || '')
      setContent(note.content || '')
      setStartTime(note.start_time || note.created_at || '')
    }
  }, [note?.id])

  const noteIdRef = useRef<string | null>(note?.id || null)

  useEffect(() => {
    noteIdRef.current = note?.id || null
  }, [note?.id])

  const ensureSaved = async (): Promise<string | null> => {
    if (noteIdRef.current) return noteIdRef.current
    // Insert new note to DB
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('cassian_habits_notes')
      .insert({ title, content, start_time: startTime, user_id: user.id })
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
    await supabase.from('cassian_habits_notes').update({ [field]: value }).eq('id', id)
    onUpdate?.({ ...note, id, [field]: value })
  }

  const handleContentChange = (value: string) => {
    setContent(value)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (value.trim()) saveField('content', value)
    }, 500)
  }

  if (!isOpen || !note) return null

  const noteTime = new Date(startTime || note.created_at)
  const localDatetimeValue = (() => {
    const d = noteTime
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${mins}`
  })()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="pl-5 pr-3 py-1.5 border-b border-neutral-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-3">
              {/* <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={() => { if (title.trim()) saveField('title', title.trim()) }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                placeholder="Note title..."
                className="text-lg font-medium text-neutral-900 bg-transparent border-none outline-none w-full placeholder-neutral-400"
              /> */}
              {editingDate ? (
                <input
                  type="datetime-local"
                  value={localDatetimeValue}
                  onChange={e => {
                    const iso = new Date(e.target.value).toISOString()
                    setStartTime(iso)
                  }}
                  onBlur={() => {
                    setEditingDate(false)
                    saveField('start_time', startTime)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'Escape') {
                      setEditingDate(false)
                      if (e.key === 'Enter') saveField('start_time', startTime)
                    }
                  }}
                  autoFocus
                  className="text-sm text-neutral-500 bg-transparent border-b-2 border-primary-500 outline-none"
                />
              ) : (
                <p
                  className="text-sm text-neutral-500 cursor-pointer hover:text-primary-600 transition-colors"
                  onClick={() => setEditingDate(true)}
                >
                  {noteTime.toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit',
                  })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onDelete && (
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
            value={content}
            onChange={e => handleContentChange(e.target.value)}
            placeholder="Start writing your note..."
            className="w-full h-full min-h-[40vh] resize-none border-none outline-none text-neutral-900 placeholder-neutral-400 text-base leading-relaxed block"
            autoFocus={!title}
          />
        </div>
      </div>
    </div>
  )
}
