import { useState, useEffect, useCallback, useRef } from 'react'
import { Trash2, Check, Tag, Loader2, AlertCircle, Key, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSettings } from '../hooks/useSettings'

interface TodoistTask {
  id: string
  content: string
  description: string
  labels: string[]
  priority: number
  project_id: string
  due: { date: string; string: string } | null
  parent_id: string | null
}

const TIMER_DURATION = 10

const TodoistTriage = () => {
  const { settings, loading: settingsLoading, updateSettings } = useSettings()
  const [tasks, setTasks] = useState<TodoistTask[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION)
  const [isPaused, setIsPaused] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const currentTask = tasks[currentIndex] || null

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('todoist-triage', {
        body: { action: 'list' },
      })
      if (fnError) {
        // Extract the actual error body - try text first since it may not be JSON
        const errorText = await fnError.context?.text?.().catch(() => null)
        console.error('todoist-triage response:', errorText)
        let errorMsg = fnError.message
        try {
          const parsed = errorText ? JSON.parse(errorText) : null
          errorMsg = parsed?.error || errorMsg
        } catch {
          errorMsg = errorText || errorMsg
        }
        throw new Error(errorMsg)
      }
      if (data?.error) throw new Error(data.error)

      // Backend already filters out recently reviewed tasks
      setTasks(data.tasks || [])
      setCurrentIndex(0)
      setTimeLeft(TIMER_DURATION)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (settings?.todoist_api_key) {
      fetchTasks()
    } else if (!settingsLoading) {
      setLoading(false)
    }
  }, [settings?.todoist_api_key, settingsLoading, fetchTasks])

  // Timer
  useEffect(() => {
    if (loading || !currentTask || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Auto-skip when timer runs out — tag as reviewed
          handleSkip()
          return TIMER_DURATION
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [loading, currentTask, isPaused, currentIndex])

  const invokeAction = async (actionName: string, extra: Record<string, string> = {}) => {
    const { data, error: fnError } = await supabase.functions.invoke('todoist-triage', {
      body: { action: actionName, taskId: currentTask!.id, ...extra },
    })
    if (fnError) {
      const errorText = await fnError.context?.text?.().catch(() => null)
      let errorMsg = fnError.message
      try { errorMsg = errorText ? JSON.parse(errorText).error || errorMsg : errorMsg } catch { errorMsg = errorText || errorMsg }
      throw new Error(errorMsg)
    }
    if (data?.error) throw new Error(data.error)
  }

  const handleAction = async (action: 'complete' | 'delete' | 'clarify') => {
    if (!currentTask || actionInProgress) return
    setActionInProgress(action)

    try {
      if (action === 'complete') {
        await invokeAction('complete')
      } else if (action === 'delete') {
        await invokeAction('delete')
      } else if (action === 'clarify') {
        await invokeAction('add_label', { label: 'clarify' })
      }

      // Remove the task from the list and move to next
      setTasks(prev => prev.filter((_, i) => i !== currentIndex))
      setTimeLeft(TIMER_DURATION)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleSkip = async () => {
    if (!currentTask || actionInProgress) return
    setActionInProgress('skip')
    try {
      await invokeAction('skip')
      setTasks(prev => prev.filter((_, i) => i !== currentIndex))
      setTimeLeft(TIMER_DURATION)
    } catch {
      // If skip label fails, just move on locally
      setCurrentIndex(i => i + 1)
      setTimeLeft(TIMER_DURATION)
    } finally {
      setActionInProgress(null)
    }
  }

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return
    setSavingKey(true)
    try {
      await updateSettings({ todoist_api_key: apiKeyInput.trim() })
      setApiKeyInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key')
    } finally {
      setSavingKey(false)
    }
  }

  const timerPercentage = (timeLeft / TIMER_DURATION) * 100

  // API key setup screen
  if (!settingsLoading && !settings?.todoist_api_key) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-white">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <Key className="w-8 h-8 text-primary-600 mx-auto mb-2" />
            <h2 className="text-xl font-bold text-gray-900">Connect Todoist</h2>
            <p className="text-sm text-gray-500 mt-1">Enter your API token to get started</p>
          </div>
          <input
            type="password"
            value={apiKeyInput}
            onChange={e => setApiKeyInput(e.target.value)}
            placeholder="Todoist API token"
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            onKeyDown={e => e.key === 'Enter' && handleSaveApiKey()}
          />
          <button
            onClick={handleSaveApiKey}
            disabled={savingKey || !apiKeyInput.trim()}
            className="w-full py-2 bg-primary-600 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {savingKey ? 'Saving...' : 'Connect'}
          </button>
        </div>
      </div>
    )
  }

  if (loading || settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-red-600 text-center">{error}</p>
        <button
          onClick={() => { setError(null); fetchTasks() }}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    )
  }

  // All done
  if (!currentTask) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
        <Check className="w-12 h-12 text-green-500" />
        <h2 className="text-xl font-bold text-gray-900">All triaged!</h2>
        <p className="text-gray-500 text-center">
          {tasks.length === 0 ? 'No tasks to triage.' : 'You\'ve gone through all tasks.'}
        </p>
        <button
          onClick={fetchTasks}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg"
        >
          Refresh
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Progress bar */}
      <div className="h-1 bg-neutral-100">
        <div
          className="h-full bg-primary-600 transition-all"
          style={{ width: `${((currentIndex) / tasks.length) * 100}%` }}
        />
      </div>

      {/* Timer bar */}
      <div className="h-1.5 bg-neutral-100">
        <div
          className={`h-full transition-all duration-1000 linear ${
            timeLeft <= 3 ? 'bg-red-500' : 'bg-blue-500'
          }`}
          style={{ width: `${timerPercentage}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-100">
        <span className="text-xs text-neutral-500">
          {currentIndex + 1} / {tasks.length}
        </span>
        <button
          onClick={() => setIsPaused(!isPaused)}
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>
        <span className={`text-xs font-mono ${timeLeft <= 3 ? 'text-red-500 font-bold' : 'text-neutral-500'}`}>
          {timeLeft}s
        </span>
      </div>

      {/* Task content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              {currentTask.content}
            </h1>
            <a
              href={`https://app.todoist.com/app/task/${currentTask.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-primary-600 flex-shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          {currentTask.description && (
            <p className="text-sm text-gray-500">{currentTask.description}</p>
          )}
          {currentTask.due && (
            <p className="text-xs text-blue-600">Due: {currentTask.due.string || currentTask.due.date}</p>
          )}
          {currentTask.labels.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1">
              {currentTask.labels.map(label => (
                <span key={label} className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="p-4 pb-8 space-y-3">
        <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
          <button
            onClick={() => handleAction('delete')}
            disabled={!!actionInProgress}
            className="flex flex-col items-center gap-1.5 py-4 rounded-xl bg-red-50 text-red-600 active:bg-red-100 disabled:opacity-50 transition-colors"
          >
            {actionInProgress === 'delete' ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Trash2 className="w-6 h-6" />
            )}
            <span className="text-xs font-medium">Delete</span>
          </button>

          <button
            onClick={() => handleAction('clarify')}
            disabled={!!actionInProgress}
            className="flex flex-col items-center gap-1.5 py-4 rounded-xl bg-amber-50 text-amber-600 active:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            {actionInProgress === 'clarify' ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Tag className="w-6 h-6" />
            )}
            <span className="text-xs font-medium">@clarify</span>
          </button>

          <button
            onClick={() => handleAction('complete')}
            disabled={!!actionInProgress}
            className="flex flex-col items-center gap-1.5 py-4 rounded-xl bg-green-50 text-green-600 active:bg-green-100 disabled:opacity-50 transition-colors"
          >
            {actionInProgress === 'complete' ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Check className="w-6 h-6" />
            )}
            <span className="text-xs font-medium">Complete</span>
          </button>
        </div>

        {/* Skip button */}
        <div className="text-center">
          <button
            onClick={handleSkip}
            disabled={!!actionInProgress}
            className="text-xs text-neutral-400 hover:text-neutral-600 disabled:opacity-50"
          >
            {actionInProgress === 'skip' ? 'Skipping...' : 'Skip'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default TodoistTriage
