import { useState, useEffect } from 'react'
import { Clock, Save, RotateCcw, Key, Calendar, DollarSign } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'

interface SettingsSectionProps {
  icon: React.ComponentType<{ className?: string }>
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

const SettingsSection = ({ icon: Icon, title, description, children }: SettingsSectionProps) => {
  return (
    <div className="p-4">
      <div className="flex items-start gap-4 mb-4">
        <div className="flex items-center gap-1 w-36 flex-shrink-0">
          <Icon className="w-3 h-3 text-neutral-600" />
          <h3 className="text-md text-neutral-900">{title}</h3>
        </div>
        <p className="text-sm text-neutral-600">{description}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

const Settings = () => {
  const { settings, loading, error, updateSettings } = useSettings()
  const [workHoursStart, setWorkHoursStart] = useState('07:00')
  const [workHoursEnd, setWorkHoursEnd] = useState('23:00')
  const [weekEndingDay, setWeekEndingDay] = useState('sunday')
  const [weekEndingTime, setWeekEndingTime] = useState('20:30')
  const [weekEndingTimezone, setWeekEndingTimezone] = useState('America/New_York')
  const [weekendDays, setWeekendDays] = useState<string[]>(['saturday', 'sunday'])
  const [todoistApiKey, setTodoistApiKey] = useState('')
  const [billableHoursEnabled, setBillableHoursEnabled] = useState(false)
  const [defaultHourlyRate, setDefaultHourlyRate] = useState('65.00')
  const [weeklyRevenueTarget, setWeeklyRevenueTarget] = useState('1000.00')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage('')

    try {
      await updateSettings({
        work_hours_start: workHoursStart + ':00',
        work_hours_end: workHoursEnd + ':00',
        week_ending_day: weekEndingDay,
        week_ending_time: weekEndingTime,
        week_ending_timezone: weekEndingTimezone,
        weekend_days: weekendDays,
        todoist_api_key: todoistApiKey,
        billable_hours_enabled: billableHoursEnabled,
        default_hourly_rate: parseFloat(defaultHourlyRate) || 65.00,
        weekly_revenue_target: parseFloat(weeklyRevenueTarget) || 1000.00,
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
    setWorkHoursStart('07:00')
    setWorkHoursEnd('23:00')
    setWeekEndingDay('sunday')
    setWeekEndingTime('20:30')
    setWeekEndingTimezone('America/New_York')
    setWeekendDays(['saturday', 'sunday'])
    setTodoistApiKey('')
    setBillableHoursEnabled(false)
    setDefaultHourlyRate('65.00')
    setWeeklyRevenueTarget('1000.00')
    setSaveMessage('')
  }

  // Load settings when they change
  useEffect(() => {
    if (settings) {
      setWorkHoursStart(settings.work_hours_start.substring(0, 5))
      setWorkHoursEnd(settings.work_hours_end.substring(0, 5))
      setWeekEndingDay(settings.week_ending_day || 'sunday')
      setWeekEndingTime(settings.week_ending_time || '20:30')
      setWeekEndingTimezone(settings.week_ending_timezone || 'America/New_York')
      setWeekendDays(settings.weekend_days || ['saturday', 'sunday'])
      setTodoistApiKey(settings.todoist_api_key || '')
      setBillableHoursEnabled(settings.billable_hours_enabled || false)
      setDefaultHourlyRate((settings.default_hourly_rate || 65.00).toString())
      setWeeklyRevenueTarget((settings.weekly_revenue_target || 1000.00).toString())
    }
  }, [settings])

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto">
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
                icon={Clock}
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

                <p className="text-sm text-blue-800">
                  <strong>Preview:</strong> Tasks can be scheduled between{' '}
                  {new Date(`1970-01-01T${workHoursStart}`).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}{' '}
                  and{' '}
                  {new Date(`1970-01-01T${workHoursEnd}`).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </p>
              </SettingsSection>

              {/* Weekend Days Section */}
              <SettingsSection
                icon={Calendar}
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
                
                <p className="text-sm text-blue-800">
                  <strong>Selected weekend days:</strong> {weekendDays.length > 0 ? weekendDays.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', ') : 'None'}
                </p>
              </SettingsSection>

              {/* Week Ending Section */}
              <SettingsSection
                icon={Calendar}
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

                <p className="text-sm text-blue-800">
                  <strong>Preview:</strong> Your week ends every{' '}
                  {weekEndingDay.charAt(0).toUpperCase() + weekEndingDay.slice(1)} at{' '}
                  {new Date(`1970-01-01T${weekEndingTime}`).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}{' '}
                  {weekEndingTimezone.split('/')[1]?.replace('_', ' ') || weekEndingTimezone}
                </p>
              </SettingsSection>

              {/* Todoist Integration Section */}
              <SettingsSection
                icon={Key}
                title="Todoist Integration"
                description="Connect your Todoist account to sync tasks and projects. You can find your API token in your Todoist settings under Integrations."
              >
                <>
                  <SettingsInput
                    label="API Token"
                    type="password"
                    value={todoistApiKey}
                    onChange={setTodoistApiKey}
                    placeholder="Enter your Todoist API token"
                  />

                  <p className="text-sm text-yellow-800">
                    <strong>Security:</strong> Your API token is stored securely and only used to
                    sync with Todoist.
                  </p>
                </>
              </SettingsSection>

              {/* Billable Hours Section */}
              <SettingsSection
                icon={DollarSign}
                title="Billable Hours"
                description="Configure automatic billable hours tracking and placeholder task generation to meet weekly revenue targets."
              >
                <div className="space-y-4">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={billableHoursEnabled}
                      onChange={(e) => setBillableHoursEnabled(e.target.checked)}
                      className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-neutral-700">
                      Enable billable hours tracking
                    </span>
                  </label>

                  {billableHoursEnabled && (
                    <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-primary-100">
                      <SettingsInput
                        label="Default Hourly Rate ($)"
                        type="number"
                        value={defaultHourlyRate}
                        onChange={setDefaultHourlyRate}
                        placeholder="65.00"
                      />
                      <SettingsInput
                        label="Weekly Revenue Target ($)"
                        type="number"
                        value={weeklyRevenueTarget}
                        onChange={setWeeklyRevenueTarget}
                        placeholder="1000.00"
                      />
                    </div>
                  )}

                  {billableHoursEnabled && (
                    <div className="pl-6 border-l-2 border-primary-100">
                      <p className="text-sm text-blue-800">
                        <strong>Preview:</strong> Target {Math.ceil(parseFloat(weeklyRevenueTarget) / parseFloat(defaultHourlyRate))} hours per week 
                        (${weeklyRevenueTarget} ÷ ${defaultHourlyRate}/hr). 
                        Placeholder tasks will be created if billable hours fall short.
                      </p>
                    </div>
                  )}
                </div>
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
