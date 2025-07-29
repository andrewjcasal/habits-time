import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface HabitContextProps {
  habitId: string
  habitName: string
  initialContext?: {
    background: string
    benefits: string
    consequences: string
  }
}

interface HabitContextData {
  background: string
  benefits: string
  consequences: string
}

const HabitContext: React.FC<HabitContextProps> = ({ habitId, habitName, initialContext }) => {
  const [context, setContext] = useState<HabitContextData>(
    initialContext || { background: '', benefits: '', consequences: '' }
  )
  const [saving, setSaving] = useState(false)
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Save context with debounced autosave
  const saveContext = async (newContext: HabitContextData) => {
    try {
      setSaving(true)
      const { error } = await supabase
        .from('habits')
        .update({
          background: newContext.background,
          benefits: newContext.benefits,
          consequences: newContext.consequences,
        })
        .eq('id', habitId)

      if (error) throw error
    } catch (err) {
      console.error('Error saving habit context:', err)
    } finally {
      setSaving(false)
    }
  }

  // Handle content change with autosave
  const handleContentChange = (
    section: 'background' | 'benefits' | 'consequences',
    content: string
  ) => {
    const newContext = { ...context, [section]: content }
    setContext(newContext)

    // Clear existing timeout
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }

    // Trigger autosave after user types a couple letters
    if (content.length >= 2) {
      autosaveTimeoutRef.current = setTimeout(() => {
        saveContext(newContext)
      }, 500) // 500ms delay after 2+ characters
    }
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current)
      }
    }
  }, [])

  const sections = [
    {
      key: 'background' as const,
      label: 'Background',
      placeholder: 'Why is this habit important? What are the benefits and reasons for building this habit?',
    },
    {
      key: 'benefits' as const,
      label: 'Benefits',
      placeholder: 'What positive outcomes and productivity gains have you experienced from this habit?',
    },
    {
      key: 'consequences' as const,
      label: "What Happens When You Don't",
      placeholder: 'What negative consequences or missed opportunities happen when you skip this habit?',
    },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-1.5 space-y-2">
        {sections.map((section) => {
          return (
            <div key={section.key} className="flex flex-col space-y-1">
              <h3 className="text-sm font-medium text-gray-900">{section.label}</h3>
              <textarea
                value={context[section.key]}
                onChange={e => handleContentChange(section.key, e.target.value)}
                placeholder={section.placeholder}
                className="w-full h-32 resize-none border border-gray-200 rounded-md p-1.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              />
            </div>
          )
        })}
      </div>
      {saving && (
        <div className="flex-shrink-0 px-1.5 py-1 text-xs text-gray-500 border-t border-gray-200">
          Saving...
        </div>
      )}
    </div>
  )
}

export default HabitContext
