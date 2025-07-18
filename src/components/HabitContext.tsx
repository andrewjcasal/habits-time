import { useState, useEffect, useRef } from 'react'
import { FileText, Trophy, Info, AlertTriangle } from 'lucide-react'
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
  const [activeSection, setActiveSection] = useState<'background' | 'benefits' | 'consequences'>(
    'background'
  )
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

    // Set new timeout for autosave
    autosaveTimeoutRef.current = setTimeout(() => {
      saveContext(newContext)
    }, 1000) // 1 second delay
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
      icon: Info,
      placeholder:
        'Why is this habit important? What are the benefits and reasons for building this habit?',
    },
    {
      key: 'benefits' as const,
      label: 'Benefits',
      icon: Trophy,
      placeholder:
        'What positive outcomes and productivity gains have you experienced from this habit?',
    },
    {
      key: 'consequences' as const,
      label: "What Happens When You Don't",
      icon: AlertTriangle,
      placeholder:
        'What negative consequences or missed opportunities happen when you skip this habit?',
    },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Section Tabs */}
      <div className="flex border-b border-gray-200 flex-shrink-0">
        {sections.map(section => {
          const Icon = section.icon
          const isActive = activeSection === section.key

          return (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs font-medium transition-colors border-b-2 ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border-blue-500'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-transparent'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{section.label}</span>
            </button>
          )
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 p-3 overflow-hidden">
        {sections.map(section => (
          <div
            key={section.key}
            className={`h-full ${activeSection === section.key ? 'block' : 'hidden'}`}
          >
            <textarea
              value={context[section.key]}
              onChange={e => handleContentChange(section.key, e.target.value)}
              placeholder={section.placeholder}
              className="w-full h-full resize-none border-none outline-none text-gray-900 placeholder-gray-400 text-sm leading-relaxed"
              style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default HabitContext
