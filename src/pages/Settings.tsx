import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Save, RotateCcw, DollarSign, Tag, Target, CheckSquare, Sparkles, Layers } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import { getHourRanges } from '../utils/hourRanges'

interface SettingsSectionProps {
  title: string
  description: string
  children: React.ReactNode
}

interface SettingsInputProps {
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

const SettingsInput = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
}: SettingsInputProps) => {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      />
    </div>
  )
}

const SettingsSection = ({ title, description, children }: SettingsSectionProps) => {
  return (
    <div className="p-4 grid grid-cols-4 gap-4">
      <h3 className="col-span-1 text-md text-neutral-900 whitespace-nowrap">{title}</h3>
      <div className="col-span-3 space-y-2">
        <p className="text-sm text-neutral-600">{description}</p>
        {children}
      </div>
    </div>
  )
}

const Settings = () => {
  const { settings, loading, error, updateSettings } = useSettings()
  const [workHoursStart, setWorkHoursStart] = useState('06:00')
  const [workHoursEnd, setWorkHoursEnd] = useState('23:00')
  const [personalHoursStart, setPersonalHoursStart] = useState('19:00')
  const [personalHoursEnd, setPersonalHoursEnd] = useState('23:00')
  const [weekEndingDay, setWeekEndingDay] = useState('sunday')
  const [weekEndingTime, setWeekEndingTime] = useState('20:30')
  const [weekEndingTimezone, setWeekEndingTimezone] = useState('America/New_York')
  const [weekendDays, setWeekendDays] = useState<string[]>(['saturday', 'sunday'])
  const [showWorkHoursBar, setShowWorkHoursBar] = useState(true)
  const [clickupApiKey, setClickupApiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage('')

    try {
      await updateSettings({
        // Keep legacy columns in sync until they're dropped — older
        // read paths still fall back to these.
        work_hours_start: workHoursStart + ':00',
        work_hours_end: workHoursEnd + ':00',
        hour_ranges: {
          work_hours: { start: workHoursStart, end: workHoursEnd },
          personal_hours: { start: personalHoursStart, end: personalHoursEnd },
        },
        week_ending_day: weekEndingDay,
        week_ending_time: weekEndingTime,
        week_ending_timezone: weekEndingTimezone,
        weekend_days: weekendDays,
        clickup_api_key: clickupApiKey.trim() || null,
        metadata: { showWorkHoursBar },
      })

      setSaveMessage('Settings saved successfully!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Error saving settings:', error)
      setSaveMessage('Error saving settings')
      setTimeout(() => setSaveMessage(''), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setWorkHoursStart('06:00')
    setWorkHoursEnd('23:00')
    setPersonalHoursStart('19:00')
    setPersonalHoursEnd('23:00')
    setWeekEndingDay('sunday')
    setWeekEndingTime('20:30')
    setWeekEndingTimezone('America/New_York')
    setWeekendDays(['saturday', 'sunday'])
    setSaveMessage('')
  }

  // Load settings when they change
  useEffect(() => {
    if (settings) {
      const ranges = getHourRanges(settings)
      setWorkHoursStart(ranges.work_hours.start)
      setWorkHoursEnd(ranges.work_hours.end)
      setPersonalHoursStart(ranges.personal_hours.start)
      setPersonalHoursEnd(ranges.personal_hours.end)
      setWeekEndingDay(settings.week_ending_day || 'sunday')
      setWeekEndingTime(settings.week_ending_time || '20:30')
      setWeekEndingTimezone(settings.week_ending_timezone || 'America/New_York')
      setWeekendDays(settings.weekend_days || ['saturday', 'sunday'])
      setShowWorkHoursBar(settings.metadata?.showWorkHoursBar ?? true)
      setClickupApiKey(settings.clickup_api_key || '')
    }
  }, [settings])

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto">
          {/* Secondary pages */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
            {[
              { path: '/categories', label: 'Categories', icon: Tag },
              { path: '/buffers', label: 'Buffers', icon: Target },
              { path: '/todoist', label: 'Todoist Triage', icon: CheckSquare },
              { path: '/reflections', label: 'Reflections', icon: Sparkles },
              { path: '/aspects', label: 'Aspects', icon: Layers },
              { path: '/transactions', label: 'Transactions', icon: DollarSign },
            ].map(item => {
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                >
                  <Icon className="w-3 h-3" />
                  {item.label}
                </Link>
              )
            })}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
              <span className="ml-2 text-neutral-600">Loading settings...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {!loading && (
            <>
              {/* Work Hours Section */}
              <SettingsSection
                title="Work Hours"
                description="Set your work hours range for scheduling non-session project tasks. This affects when tasks can be automatically scheduled in your calendar."
              >
                <div className="grid grid-cols-2 gap-2">
                  <SettingsInput
                    label="Start Time"
                    type="time"
                    value={workHoursStart}
                    onChange={setWorkHoursStart}
                  />
                  <SettingsInput
                    label="End Time"
                    type="time"
                    value={workHoursEnd}
                    onChange={setWorkHoursEnd}
                  />
                </div>
              </SettingsSection>

              {/* Personal Hours Section */}
              <SettingsSection
                title="Personal Hours"
                description="Off-hours window used for scheduling personal tasks (e.g. Todoist) outside of your work hours."
              >
                <div className="grid grid-cols-2 gap-2">
                  <SettingsInput
                    label="Start Time"
                    type="time"
                    value={personalHoursStart}
                    onChange={setPersonalHoursStart}
                  />
                  <SettingsInput
                    label="End Time"
                    type="time"
                    value={personalHoursEnd}
                    onChange={setPersonalHoursEnd}
                  />
                </div>
              </SettingsSection>

              {/* Weekend Days Section */}
              <SettingsSection
                title="Weekend Days"
                description="Select which days are considered weekends and should be excluded from task scheduling."
              >
                <div className="grid grid-cols-4 gap-2">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                    <label key={day} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={weekendDays.includes(day)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setWeekendDays([...weekendDays, day])
                          } else {
                            setWeekendDays(weekendDays.filter(d => d !== day))
                          }
                        }}
                        className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm capitalize">{day}</span>
                    </label>
                  ))}
                </div>
              </SettingsSection>

              {/* Week Ending Section */}
              <SettingsSection
                title="Week Ending"
                description="Configure when your week ends for weekly goals and habits tracking. This determines when weekly progress resets."
              >
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Day</label>
                    <select
                      value={weekEndingDay}
                      onChange={e => setWeekEndingDay(e.target.value)}
                      className="w-full px-2 py-1 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="sunday">Sunday</option>
                      <option value="monday">Monday</option>
                      <option value="tuesday">Tuesday</option>
                      <option value="wednesday">Wednesday</option>
                      <option value="thursday">Thursday</option>
                      <option value="friday">Friday</option>
                      <option value="saturday">Saturday</option>
                    </select>
                  </div>
                  <SettingsInput
                    label="Time"
                    type="time"
                    value={weekEndingTime}
                    onChange={setWeekEndingTime}
                  />
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Timezone
                    </label>
                    <select
                      value={weekEndingTimezone}
                      onChange={e => setWeekEndingTimezone(e.target.value)}
                      className="w-full px-2 py-1 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>
              </SettingsSection>

              {/* Calendar Display Section */}
              <SettingsSection
                title="Calendar Display"
                description="Toggle what appears in the calendar top bar."
              >
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={showWorkHoursBar}
                    onChange={e => setShowWorkHoursBar(e.target.checked)}
                    className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-700">
                    Show work hours, planned/actual, and money in calendar top bar
                  </span>
                </label>
              </SettingsSection>

              <SettingsSection
                title="ClickUp"
                description="Personal API token for ClickUp. Work tasks assigned to you are auto-scheduled on weekdays 11am–6pm. Get a token from your ClickUp account settings → Apps → API Token."
              >
                <SettingsInput
                  label="API Token"
                  type="password"
                  value={clickupApiKey}
                  onChange={setClickupApiKey}
                  placeholder="pk_…"
                />
              </SettingsSection>

              {/* Save Actions */}
              <div className="flex items-center justify-end gap-3">
                {saveMessage && (
                  <span
                    className={`text-sm ${
                      saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {saveMessage}
                  </span>
                )}
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-2 py-1 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50 transition-colors"
                >
                  Reset to Default
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-2 py-1 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default Settings
