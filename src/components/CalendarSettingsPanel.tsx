import { useState, useEffect, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface UserCalendar {
  id: string
  calendar_id: string
  name: string
  color: string | null
  is_enabled: boolean
}

interface CalendarSettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  onSync: () => void
}

export default function CalendarSettingsPanel({ isOpen, onClose, onSync }: CalendarSettingsPanelProps) {
  const [calendars, setCalendars] = useState<UserCalendar[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) fetchCalendars()
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  const fetchCalendars = async () => {
    setLoading(true)
    const { data } = await supabase.functions.invoke('google-calendar', {
      body: { action: 'list_calendars' },
    })
    setCalendars(data?.calendars || [])
    setLoading(false)
  }

  const handleConnect = async () => {
    setConnecting(true)
    const { data, error } = await supabase.functions.invoke('google-calendar', {
      body: {
        action: 'authorize',
        redirectUri: window.location.origin + '/calendar?google_callback=true',
      },
    })
    if (data?.url) {
      window.location.href = data.url
    }
    setConnecting(false)
  }

  const handleToggle = async (calendar: UserCalendar) => {
    const newValue = !calendar.is_enabled
    setCalendars(prev =>
      prev.map(c => c.id === calendar.id ? { ...c, is_enabled: newValue } : c)
    )
    await supabase
      .from('cassian_user_calendars')
      .update({ is_enabled: newValue })
      .eq('id', calendar.id)
  }

  const handleSync = async () => {
    setSyncing(true)
    await onSync()
    setSyncing(false)
  }

  if (!isOpen) return null

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl shadow-lg border overflow-hidden"
      style={{
        backgroundColor: '#FDFBF7',
        borderColor: '#E8E2D9',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <h3
          className="text-sm text-neutral-900"
          style={{ fontFamily: "'DM Serif Display', serif" }}
        >
          Calendars
        </h3>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        {loading ? (
          <p className="text-xs text-neutral-400 py-3 text-center">Loading...</p>
        ) : calendars.length === 0 ? (
          <div className="py-2">
            <p className="text-xs text-neutral-400 mb-3">
              Connect your Google Calendar to see events here.
            </p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full px-4 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-full hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              {connecting ? 'Connecting...' : 'Connect Google Calendar'}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-1.5 mb-3">
              {calendars.map(calendar => (
                <div
                  key={calendar.id}
                  className="flex items-center justify-between py-1"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: calendar.color || '#9CA3AF' }}
                    />
                    <span className="text-xs text-neutral-700 truncate">
                      {calendar.name}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggle(calendar)}
                    className={`relative w-7 h-4 rounded-full transition-colors flex-shrink-0 ${
                      calendar.is_enabled ? 'bg-amber-500' : 'bg-neutral-300'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${
                        calendar.is_enabled ? 'translate-x-3.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: '#E8E2D9' }}>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1 text-xs text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="ml-auto text-xs text-amber-700 hover:text-amber-800 transition-colors"
              >
                {connecting ? 'Connecting...' : '+ Add Calendar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
