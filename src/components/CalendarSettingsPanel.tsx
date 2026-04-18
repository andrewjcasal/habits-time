import { useState, useEffect } from 'react'
import { RefreshCw, CalendarDays, Briefcase, ChevronRight, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ModalWrapper from './ModalWrapper'

interface UserCalendar {
  id: string
  calendar_id: string
  name: string
  color: string | null
  is_enabled: boolean
}

interface ClickUpList {
  id: string
  name: string
  is_enabled: boolean
}

interface ClickUpFolder {
  id: string
  name: string
  lists: ClickUpList[]
}

interface ClickUpSpace {
  id: string
  name: string
  color: string | null
  lists: ClickUpList[] // folderless lists
  folders: ClickUpFolder[]
}

interface ClickUpTeam {
  team_id: string
  team_name: string
  spaces: ClickUpSpace[]
}

interface CalendarSettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  onSync: () => void
}

type NavKey = 'calendars' | 'clickup'

export default function CalendarSettingsPanel({ isOpen, onClose, onSync }: CalendarSettingsPanelProps) {
  const [nav, setNav] = useState<NavKey>('calendars')
  const [calendars, setCalendars] = useState<UserCalendar[]>([])
  const [calendarsLoading, setCalendarsLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [clickupTeams, setClickupTeams] = useState<ClickUpTeam[]>([])
  const [clickupLoading, setClickupLoading] = useState(false)
  const [clickupError, setClickupError] = useState<string | null>(null)
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())
  const [collapsedSpaces, setCollapsedSpaces] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isOpen && nav === 'calendars') fetchCalendars()
    if (isOpen && nav === 'clickup') fetchClickUpSpaces()
  }, [isOpen, nav])

  const fetchCalendars = async () => {
    setCalendarsLoading(true)
    const { data } = await supabase.functions.invoke('google-calendar', {
      body: { action: 'list_calendars' },
    })
    setCalendars(data?.calendars || [])
    setCalendarsLoading(false)
  }

  const fetchClickUpSpaces = async () => {
    setClickupLoading(true)
    setClickupError(null)
    const { data, error } = await supabase.functions.invoke('clickup', {
      body: { action: 'list_spaces' },
    })
    if (error) {
      setClickupError(error.message || 'Failed to load ClickUp spaces')
      setClickupTeams([])
    } else {
      setClickupTeams(data?.teams || [])
    }
    setClickupLoading(false)
  }

  const handleConnect = async () => {
    setConnecting(true)
    const { data } = await supabase.functions.invoke('google-calendar', {
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
      prev.map(c => (c.id === calendar.id ? { ...c, is_enabled: newValue } : c))
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

  // Flip an individual ClickUp list's enabled state. Upsert into
  // cassian_clickup_lists and patch the nested local state by mapping
  // through the tree.
  const handleToggleList = async (
    teamId: string,
    spaceId: string,
    listId: string,
    listName: string,
    nextEnabled: boolean
  ) => {
    setClickupTeams(prev =>
      prev.map(team => {
        if (team.team_id !== teamId) return team
        return {
          ...team,
          spaces: team.spaces.map(space => {
            if (space.id !== spaceId) return space
            return {
              ...space,
              lists: space.lists.map(l =>
                l.id === listId ? { ...l, is_enabled: nextEnabled } : l
              ),
              folders: space.folders.map(folder => ({
                ...folder,
                lists: folder.lists.map(l =>
                  l.id === listId ? { ...l, is_enabled: nextEnabled } : l
                ),
              })),
            }
          }),
        }
      })
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('cassian_clickup_lists')
      .upsert(
        {
          user_id: user.id,
          clickup_list_id: listId,
          clickup_space_id: spaceId,
          clickup_team_id: teamId,
          name: listName,
          is_enabled: nextEnabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,clickup_list_id' }
      )
  }

  const toggleFolderCollapse = (folderId: string) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const toggleSpaceCollapse = (spaceId: string) => {
    setCollapsedSpaces(prev => {
      const next = new Set(prev)
      if (next.has(spaceId)) next.delete(spaceId)
      else next.add(spaceId)
      return next
    })
  }

  const navItems: { key: NavKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'calendars', label: 'Calendars', icon: CalendarDays },
    { key: 'clickup', label: 'ClickUp Spaces', icon: Briefcase },
  ]

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 28,
        height: 16,
        padding: 0,
        border: 0,
        WebkitAppearance: 'none',
        appearance: 'none',
      }}
      className={`relative rounded-full transition-colors flex-shrink-0 cursor-pointer ${
        on ? 'bg-amber-500' : 'bg-neutral-300'
      }`}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 14 : 2,
          width: 12,
          height: 12,
          borderRadius: 9999,
          backgroundColor: '#ffffff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          transition: 'left 150ms ease',
        }}
      />
    </button>
  )

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} bare maxWidth="2xl">
      <div
        className="rounded-xl shadow-xl border flex overflow-hidden"
        style={{
          backgroundColor: '#FDFBF7',
          borderColor: '#E8E2D9',
          fontFamily: "'DM Sans', sans-serif",
          width: 600,
          maxWidth: '100%',
          minHeight: 400,
          maxHeight: '80vh',
        }}
      >
        {/* Left nav */}
        <div
          className="w-44 border-r flex-shrink-0 py-3"
          style={{ borderColor: '#E8E2D9' }}
        >
          <ul className="space-y-0.5 px-2">
            {navItems.map(item => {
              const active = nav === item.key
              const Icon = item.icon
              return (
                <li key={item.key}>
                  <button
                    onClick={() => setNav(item.key)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                      active
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Right pane */}
        <div className="flex-1 min-w-0 flex flex-col">
          {nav === 'calendars' && (
            <>
              <div className="px-4 pt-3 pb-2">
                <h3
                  className="text-base text-neutral-900"
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                >
                  Calendars
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-2">
                {calendarsLoading ? (
                  <p className="text-xs text-neutral-400 py-3 text-center">Loading…</p>
                ) : calendars.length === 0 ? (
                  <div className="py-2">
                    <p className="text-xs text-neutral-500 mb-3">
                      Connect your Google Calendar to see events here.
                    </p>
                    <button
                      onClick={handleConnect}
                      disabled={connecting}
                      className="w-full px-4 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-full hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                    >
                      {connecting ? 'Connecting…' : 'Connect Google Calendar'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
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
                        <Toggle on={calendar.is_enabled} onClick={() => handleToggle(calendar)} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {calendars.length > 0 && (
                <div
                  className="flex items-center gap-2 px-4 py-2 border-t"
                  style={{ borderColor: '#E8E2D9' }}
                >
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-600 hover:text-neutral-900 transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing…' : 'Sync Now'}
                  </button>
                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="ml-auto text-xs text-amber-700 hover:text-amber-800 transition-colors"
                  >
                    {connecting ? 'Connecting…' : '+ Add Calendar'}
                  </button>
                </div>
              )}
            </>
          )}

          {nav === 'clickup' && (
            <>
              <div className="px-4 pt-3 pb-2">
                <h3
                  className="text-base text-neutral-900"
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                >
                  ClickUp Spaces
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Toggle the lists you want auto-scheduled on weekdays 11am–6pm.
                </p>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-3">
                {clickupLoading ? (
                  <p className="text-xs text-neutral-400 py-3 text-center">Loading…</p>
                ) : clickupError ? (
                  <p className="text-xs text-red-600 py-3">{clickupError}</p>
                ) : clickupTeams.length === 0 ? (
                  <p className="text-xs text-neutral-500 py-3">
                    No ClickUp workspaces found. Make sure your API token is saved in Settings.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {clickupTeams.map(team => (
                      <div key={team.team_id}>
                        <div className="text-xs font-semibold text-neutral-800 mb-1">
                          {team.team_name}
                        </div>

                        {team.spaces.length === 0 ? (
                          <p className="text-xs text-neutral-400 pl-3">No spaces</p>
                        ) : (
                          <div className="space-y-1.5">
                            {team.spaces.map(space => {
                              const spaceCollapsed = collapsedSpaces.has(space.id)
                              return (
                                <div key={space.id}>
                                  <button
                                    onClick={() => toggleSpaceCollapse(space.id)}
                                    className="w-full flex items-center gap-1.5 text-xs text-neutral-800 hover:text-neutral-900"
                                  >
                                    {spaceCollapsed ? (
                                      <ChevronRight className="w-3 h-3" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3" />
                                    )}
                                    <div
                                      className="w-2 h-2 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: space.color || '#9CA3AF' }}
                                    />
                                    <span className="truncate">{space.name}</span>
                                  </button>

                                  {!spaceCollapsed && (
                                    <div className="mt-1 pl-5 space-y-1">
                                      {/* Folderless lists */}
                                      {space.lists.map(list => (
                                        <div
                                          key={list.id}
                                          className="flex items-center justify-between py-0.5"
                                        >
                                          <span className="text-xs text-neutral-700 truncate">
                                            {list.name}
                                          </span>
                                          <Toggle
                                            on={list.is_enabled}
                                            onClick={() =>
                                              handleToggleList(
                                                team.team_id,
                                                space.id,
                                                list.id,
                                                list.name,
                                                !list.is_enabled
                                              )
                                            }
                                          />
                                        </div>
                                      ))}

                                      {/* Folders */}
                                      {space.folders.map(folder => {
                                        const folderCollapsed = collapsedFolders.has(folder.id)
                                        return (
                                          <div key={folder.id}>
                                            <button
                                              onClick={() => toggleFolderCollapse(folder.id)}
                                              className="w-full flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900"
                                            >
                                              {folderCollapsed ? (
                                                <ChevronRight className="w-3 h-3" />
                                              ) : (
                                                <ChevronDown className="w-3 h-3" />
                                              )}
                                              <span className="truncate">{folder.name}</span>
                                            </button>
                                            {!folderCollapsed && (
                                              <div className="pl-4 space-y-0.5 mt-0.5">
                                                {folder.lists.map(list => (
                                                  <div
                                                    key={list.id}
                                                    className="flex items-center justify-between py-0.5"
                                                  >
                                                    <span className="text-xs text-neutral-700 truncate">
                                                      {list.name}
                                                    </span>
                                                    <Toggle
                                                      on={list.is_enabled}
                                                      onClick={() =>
                                                        handleToggleList(
                                                          team.team_id,
                                                          space.id,
                                                          list.id,
                                                          list.name,
                                                          !list.is_enabled
                                                        )
                                                      }
                                                    />
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </ModalWrapper>
  )
}
