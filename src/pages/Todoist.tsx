import { useState, useEffect } from 'react'
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  Plus,
  Calendar,
  ExternalLink,
  Inbox,
  Zap,
  Target,
  Brain,
  MessageCircle,
  Send,
  X,
  Key,
  CheckCircle,
  AlertCircle,
  Link,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSettings } from '../hooks/useSettings'
import LoadingSpinner from '../components/LoadingSpinner'

interface TodoItem {
  id: string
  title: string
  description?: string
  dueDate?: string
  isCompleted: boolean
  priority: 'low' | 'medium' | 'high' | 'urgent'
  createdAt: string
  projectName?: string
  url?: string
  aiCategory?: 'easy' | 'high_priority' | 'normal' | null
  aiReasoning?: string | null
  needsReanalysis?: boolean
}

const Todoist = () => {
  const { settings, updateSettings } = useSettings()
  const [activeTab, setActiveTab] = useState<'overdue' | 'today' | 'inbox'>('overdue')
  const [todayTodos, setTodayTodos] = useState<TodoItem[]>([])
  const [overdueTodos, setOverdueTodos] = useState<TodoItem[]>([])
  const [inboxTodos, setInboxTodos] = useState<TodoItem[]>([])
  const [allTodos, setAllTodos] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<string | null>(null)
  const [analyzingTasks, setAnalyzingTasks] = useState<Set<string>>(new Set())
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [showChatbot, setShowChatbot] = useState(false)
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)

  // Todoist connection state
  const [apiKey, setApiKey] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<
    'checking' | 'connected' | 'disconnected' | 'error'
  >('checking')

  // Check connection status on load
  useEffect(() => {
    if (settings) {
      if (settings.todoist_api_key) {
        setConnectionStatus('connected')
      } else {
        setConnectionStatus('disconnected')
      }
    }
  }, [settings])

  const validateAndSaveApiKey = async (key: string) => {
    setIsConnecting(true)
    try {
      // Test the API key by making a simple request to Todoist
      const response = await fetch('https://api.todoist.com/rest/v2/projects', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      })

      if (!response.ok) {
        throw new Error('Invalid API key')
      }

      // Save the API key to settings
      await updateSettings({ todoist_api_key: key })
      setConnectionStatus('connected')
      setApiKey('')

      // Automatically fetch tasks after successful connection
      fetchTodoist()
    } catch (err) {
      console.error('Error validating API key:', err)
      setConnectionStatus('error')
      throw new Error("Failed to validate API key. Please check that it's correct.")
    } finally {
      setIsConnecting(false)
    }
  }

  const handleConnect = async () => {
    if (!apiKey.trim()) return

    try {
      await validateAndSaveApiKey(apiKey.trim())
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to connect to Todoist')
    }
  }

  const handleDisconnect = async () => {
    try {
      await updateSettings({ todoist_api_key: null })
      setConnectionStatus('disconnected')
      setTodayTodos([])
      setOverdueTodos([])
      setInboxTodos([])
      setAllTodos([])
      setLastFetch(null)
    } catch (err) {
      console.error('Error disconnecting:', err)
      alert('Failed to disconnect from Todoist')
    }
  }

  const fetchTodoist = async () => {
    // Don't fetch if not connected
    if (connectionStatus !== 'connected' || !settings?.todoist_api_key) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      console.log('Fetching Todoist tasks...')

      const { data, error: functionError } = await supabase.functions.invoke('todoist-sync')

      if (functionError) {
        throw functionError
      }

      if (data.error) {
        throw new Error(data.error)
      }

      console.log('Todoist data received:', data)

      // Debug the specific task from API
      const debugTask = data.tasks.all?.find(t => t.id === '9284835213')
      if (debugTask) {
        console.log('=== TASK FROM API ===')
        console.log('API Task ID:', debugTask.id)
        console.log('API Title:', debugTask.title)
        console.log('API Description:', debugTask.description)
        console.log('API AI Category:', debugTask.aiCategory)
      }

      const newTodayTodos = data.tasks.today || []
      const newOverdueTodos = data.tasks.overdue || []
      const newInboxTodos = data.tasks.inbox || []
      const newAllTodos = data.tasks.all || []

      // Check for tasks that need re-analysis (content changed)
      const tasksToReanalyze: TodoItem[] = []

      // For change detection, we need to handle two scenarios:
      // 1. Compare with local state (if we have it)
      // 2. Let the backend handle content hash comparison (database vs current)

      // Create a lookup of all current tasks (might be empty on first load)
      const allCurrentTasks = [...todayTodos, ...overdueTodos, ...inboxTodos, ...allTodos]
      console.log('Total current tasks for lookup:', allCurrentTasks.length)

      if (allCurrentTasks.length > 0) {
        // We have local state - do change detection
        const currentTaskLookup = allCurrentTasks.reduce(
          (acc, task) => {
            acc[task.id] = task
            return acc
          },
          {} as Record<string, TodoItem>
        )

        // Compare with ALL new tasks to find content changes
        newAllTodos.forEach(newTask => {
          const oldTask = currentTaskLookup[newTask.id]

          // Debug specific task
          if (newTask.id === '9284835213') {
            console.log('=== DEBUG TASK 9284835213 ===')
            console.log('Old task exists:', !!oldTask)
            console.log('Old task has aiCategory:', oldTask?.aiCategory)
            console.log('Old title:', oldTask?.title)
            console.log('New title:', newTask.title)
            console.log('Old description:', oldTask?.description)
            console.log('New description:', newTask.description)
            console.log('Title changed:', oldTask?.title !== newTask.title)
            console.log(
              'Description changed:',
              (oldTask.description || '') !== (newTask.description || '')
            )
          }

          if (oldTask && oldTask.aiCategory) {
            // Check if title or description changed
            const titleChanged = oldTask.title !== newTask.title
            const descriptionChanged = (oldTask.description || '') !== (newTask.description || '')

            if (titleChanged || descriptionChanged) {
              console.log(
                `Content changed for task ${newTask.id}: "${oldTask.title}" -> "${newTask.title}"`
              )
              // Task content changed and was previously analyzed - need to re-analyze
              tasksToReanalyze.push({
                ...newTask,
                aiCategory: null, // Clear old analysis
                aiReasoning: null,
              })
            }
          }
        })
      } else {
        console.log('No local state for comparison - will rely on backend content hash detection')
        // On first load or empty state, the backend should handle content hash comparison
        // Any tasks with existing AI categories but different content will need re-analysis
        // This should be handled by the backend content hash logic
      }

      // Apply changes to clear AI data for modified tasks
      const changedTaskIds = new Set(tasksToReanalyze.map(t => t.id))
      const clearAIDataForChangedTasks = (tasks: TodoItem[]) =>
        tasks.map(task =>
          changedTaskIds.has(task.id) ? { ...task, aiCategory: null, aiReasoning: null } : task
        )

      setTodayTodos(clearAIDataForChangedTasks(newTodayTodos))
      setOverdueTodos(clearAIDataForChangedTasks(newOverdueTodos))
      setInboxTodos(clearAIDataForChangedTasks(newInboxTodos))
      setAllTodos(clearAIDataForChangedTasks(newAllTodos))
      setLastFetch(data.meta.fetchedAt)

      // Auto-analyze tasks only from the three main sections (overdue, today, inbox)
      const relevantTasks = [...newOverdueTodos, ...newTodayTodos, ...newInboxTodos]

      // Remove duplicates and filter for unanalyzed tasks
      const uniqueTasks = relevantTasks.filter(
        (task, index, self) => index === self.findIndex(t => t.id === task.id)
      )
      const unanalyzedTasks = uniqueTasks.filter(task => !task.aiCategory)

      // Also include tasks marked for re-analysis by the backend
      const backendMarkedTasks = newAllTodos.filter(task => task.needsReanalysis)

      // Combine unanalyzed tasks with changed tasks that need re-analysis
      const allTasksToAnalyze = [...unanalyzedTasks, ...tasksToReanalyze, ...backendMarkedTasks]

      if (allTasksToAnalyze.length > 0) {
        console.log(
          `Auto-analyzing ${allTasksToAnalyze.length} tasks (${unanalyzedTasks.length} new, ${tasksToReanalyze.length} frontend-detected changes, ${backendMarkedTasks.length} backend-detected changes)...`
        )

        // Analyze tasks immediately without batching for now (we can add batching back later)
        allTasksToAnalyze.forEach((task, index) => {
          console.log(
            `Attempting to analyze task ${index + 1}/${allTasksToAnalyze.length}: ${task.id} - ${
              task.title
            }`
          )
          // Small delay between tasks to avoid overwhelming
          setTimeout(() => {
            analyzeTask(task)
          }, index * 200) // 200ms delay between each task
        })
      }
    } catch (err) {
      console.error('Error fetching Todoist tasks:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTodoist()
  }, [])

  const today = new Date().toISOString().split('T')[0]

  const getFilteredTodos = () => {
    let todos: TodoItem[] = []

    if (activeTab === 'overdue') {
      todos = overdueTodos
    } else if (activeTab === 'today') {
      todos = todayTodos
    } else if (activeTab === 'inbox') {
      todos = inboxTodos
    }

    // Sort to show high priority and easy tasks at the top
    return todos.sort((a, b) => {
      const getPriority = (todo: TodoItem) => {
        if (todo.aiCategory === 'high_priority') return 0
        if (todo.aiCategory === 'easy') return 1
        return 2
      }

      return getPriority(a) - getPriority(b)
    })
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-700 bg-red-100 border-red-300'
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const analyzeTask = async (task: TodoItem) => {
    // Allow re-analysis if task is marked for it or has no category
    if ((task.aiCategory && !task.needsReanalysis) || analyzingTasks.has(task.id)) {
      console.log(
        `Skipping analysis for task ${task.id}: aiCategory=${task.aiCategory}, needsReanalysis=${
          task.needsReanalysis
        }, isAnalyzing=${analyzingTasks.has(task.id)}`
      )
      return
    }

    console.log(`Starting analysis for task ${task.id}: "${task.title}"`)
    setAnalyzingTasks(prev => new Set(prev).add(task.id))

    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        'analyze-todoist-task',
        {
          body: {
            taskId: task.id,
            title: task.title,
            description: task.description || '',
          },
        }
      )

      if (functionError) {
        console.error('Function error for task', task.id, ':', functionError)
        throw functionError
      }

      if (data.error) {
        console.error('Data error for task', task.id, ':', data.error)
        throw new Error(data.error)
      }

      console.log(`Analysis complete for task ${task.id}:`, data)

      // Update task in all arrays
      const updateTask = (todos: TodoItem[]) =>
        todos.map(todo =>
          todo.id === task.id
            ? {
                ...todo,
                aiCategory: data.category,
                aiReasoning: data.reasoning,
                needsReanalysis: false,
              }
            : todo
        )

      setTodayTodos(updateTask)
      setOverdueTodos(updateTask)
      setInboxTodos(updateTask)
      setAllTodos(updateTask)
    } catch (err) {
      console.error('Error analyzing task', task.id, ':', err)
    } finally {
      setAnalyzingTasks(prev => {
        const newSet = new Set(prev)
        newSet.delete(task.id)
        return newSet
      })
    }
  }

  const startChat = (task: TodoItem) => {
    setShowChatbot(true)
    setChatMessages([
      {
        role: 'assistant',
        content: `Hi! I'm here to help you work through "${task.title}". What's got you stuck? I can help break down the task, suggest next steps, or clarify what needs to be done.`,
      },
    ])
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !selectedTaskId || isChatLoading) return

    const selectedTask = filteredTodos.find(t => t.id === selectedTaskId)
    if (!selectedTask) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setIsChatLoading(true)

    // Add user message to chat
    const newMessages = [...chatMessages, { role: 'user' as const, content: userMessage }]
    setChatMessages(newMessages)

    try {
      const { data, error: functionError } = await supabase.functions.invoke('todoist-chat', {
        body: {
          taskId: selectedTask.id,
          taskTitle: selectedTask.title,
          taskDescription: selectedTask.description || '',
          messages: chatMessages,
          userMessage,
          action: 'chat',
        },
      })

      if (functionError) {
        throw functionError
      }

      if (data.error) {
        throw new Error(data.error)
      }

      // Add assistant response
      const assistantMessages = [
        ...newMessages,
        { role: 'assistant' as const, content: data.message },
      ]
      setChatMessages(assistantMessages)

      // Update Todoist description with conversation snippet
      await updateTaskDescriptionWithConversation(selectedTask, userMessage, data.message)

      // Show suggestions if available
      if (data.suggestedTitle || data.suggestedContext) {
        const suggestions = []
        if (data.suggestedTitle) suggestions.push(`New title: "${data.suggestedTitle}"`)
        if (data.suggestedContext) suggestions.push(`Add context: "${data.suggestedContext}"`)

        const suggestionMessage = `💡 I have some suggestions to improve this task:\n\n${suggestions.join(
          '\n\n'
        )}\n\nWould you like me to apply these changes to your Todoist task?`
        setChatMessages([...assistantMessages, { role: 'assistant', content: suggestionMessage }])
      }
    } catch (err) {
      console.error('Error in chat:', err)
      setChatMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ])
    } finally {
      setIsChatLoading(false)
    }
  }

  const updateTaskDescriptionWithConversation = async (
    task: TodoItem,
    userMessage: string,
    assistantMessage: string
  ) => {
    try {
      // Create a conversation snippet
      const timestamp = new Date().toLocaleString()
      const conversationSnippet = `--- AI Chat (${timestamp}) ---\nQ: ${userMessage}\nA: ${assistantMessage}`

      // Prepend to existing description (put conversation at top)
      const existingDescription = task.description || ''
      const newDescription = existingDescription
        ? `${conversationSnippet}\n\n---\n\n${existingDescription}`
        : conversationSnippet

      const { data, error: functionError } = await supabase.functions.invoke('todoist-chat', {
        body: {
          taskId: task.id,
          taskTitle: task.title,
          taskDescription: existingDescription,
          messages: [],
          userMessage: '',
          action: 'update_task',
          newTitle: undefined,
          contextToAdd: undefined,
          newDescription: newDescription,
        },
      })

      if (functionError) {
        throw functionError
      }

      if (data.error) {
        throw new Error(data.error)
      }

      // Update local state
      const updateTask = (todos: TodoItem[]) =>
        todos.map(todo => (todo.id === task.id ? { ...todo, description: newDescription } : todo))

      setTodayTodos(updateTask)
      setOverdueTodos(updateTask)
      setInboxTodos(updateTask)
      setAllTodos(updateTask)

      console.log('✅ Task description updated with conversation in Todoist')
    } catch (err) {
      console.error('Error updating task description with conversation:', err)
      // Don't throw - this shouldn't break the chat flow
    }
  }

  const applyTaskSuggestions = async (newTitle?: string, contextToAdd?: string) => {
    if (!selectedTaskId) return

    const selectedTask = filteredTodos.find(t => t.id === selectedTaskId)
    if (!selectedTask) return

    try {
      const { data, error: functionError } = await supabase.functions.invoke('todoist-chat', {
        body: {
          taskId: selectedTask.id,
          taskTitle: selectedTask.title,
          taskDescription: selectedTask.description || '',
          messages: [],
          userMessage: '',
          action: 'update_task',
          newTitle,
          contextToAdd,
        },
      })

      if (functionError) {
        throw functionError
      }

      if (data.error) {
        throw new Error(data.error)
      }

      // Update local state
      const updatedTaskData = {
        ...selectedTask,
        title: newTitle || selectedTask.title,
        description: contextToAdd
          ? selectedTask.description
            ? `${contextToAdd}\n\n---\n\n${selectedTask.description}`
            : contextToAdd
          : selectedTask.description,
        aiCategory: null, // Clear AI category since content changed
        aiReasoning: null, // Clear AI reasoning since content changed
      }

      const updateTask = (todos: TodoItem[]) =>
        todos.map(todo => (todo.id === selectedTask.id ? updatedTaskData : todo))

      setTodayTodos(updateTask)
      setOverdueTodos(updateTask)
      setInboxTodos(updateTask)
      setAllTodos(updateTask)

      // Immediately re-analyze the updated task
      setTimeout(() => {
        analyzeTask(updatedTaskData)
      }, 500) // Small delay to ensure state has updated

      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '✅ Task updated successfully in Todoist! Re-analyzing with AI...',
        },
      ])
    } catch (err) {
      console.error('Error updating task:', err)
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry, I couldn't update the task. Please try again.",
        },
      ])
    }
  }

  const toggleComplete = (id: string) => {
    // Update local state optimistically
    setTodayTodos(prev =>
      prev.map(todo => (todo.id === id ? { ...todo, isCompleted: !todo.isCompleted } : todo))
    )
    setOverdueTodos(prev =>
      prev.map(todo => (todo.id === id ? { ...todo, isCompleted: !todo.isCompleted } : todo))
    )
    setInboxTodos(prev =>
      prev.map(todo => (todo.id === id ? { ...todo, isCompleted: !todo.isCompleted } : todo))
    )
    setAllTodos(prev =>
      prev.map(todo => (todo.id === id ? { ...todo, isCompleted: !todo.isCompleted } : todo))
    )

    // TODO: Call Todoist API to actually complete the task
    console.log('TODO: Implement task completion via Todoist API for task:', id)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const filteredTodos = getFilteredTodos()
  const overdueCount = overdueTodos.length
  const todayCount = todayTodos.length
  const inboxCount = inboxTodos.length
  const easyCount = allTodos.filter(todo => todo.aiCategory === 'easy').length
  const highPriorityCount = allTodos.filter(todo => todo.aiCategory === 'high_priority').length

  const tabs = [
    {
      key: 'overdue' as const,
      label: 'Overdue',
      icon: AlertTriangle,
      count: overdueCount,
      color: 'text-red-600',
    },
    {
      key: 'today' as const,
      label: 'Today',
      icon: Calendar,
      count: todayCount,
      color: 'text-blue-600',
    },
    {
      key: 'inbox' as const,
      label: 'Inbox',
      icon: Inbox,
      count: inboxCount,
      color: 'text-gray-600',
    },
  ]

  // Show loading while checking connection
  if (connectionStatus === 'checking') {
    return <LoadingSpinner message="Loading Todoist..." />
  }

  // If not connected, show connection screen
  if (connectionStatus === 'disconnected') {
    return (
      <div className="h-screen flex flex-col">
        {/* Connection Content */}
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="max-w-4xl mx-auto p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              {/* Main Content */}
              <div className="text-center lg:text-left">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Connect to Todoist</h2>
                <p className="text-gray-600 mb-4 text-lg">
                  Enter your Todoist API key to get started.
                </p>

                <div className="space-y-3">
                  <div className="flex flex-col gap-2">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder="Enter your Todoist API key"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyPress={e => e.key === 'Enter' && handleConnect()}
                    />
                    <button
                      onClick={handleConnect}
                      disabled={!apiKey.trim() || isConnecting}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 justify-center"
                    >
                      {isConnecting ? (
                        <>
                          <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          Connecting...
                        </>
                      ) : (
                        <>Connect</>
                      )}
                    </button>
                  </div>

                  {connectionStatus === 'error' && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-700">
                        Failed to connect. Please check your API key and try again.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-white p-3 rounded-lg border shadow-sm">
                <p className="text-gray-700 mb-2">How to find your API key:</p>
                <a
                  href="https://app.todoist.com/app/settings/integrations/developer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  Open Todoist Settings
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-2 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {lastFetch && (
              <span className="text-xs text-gray-500">
                Last synced: {new Date(lastFetch).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchTodoist}
              disabled={loading}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Syncing...' : 'Sync'}
            </button>
            <button
              onClick={handleDisconnect}
              className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-2 py-2 text-sm font-medium transition-colors border-b-2 ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border-blue-500'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    isActive ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content - Outlook Style Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Task List - Left Side */}
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
          {error ? (
            <div className="text-center py-12 px-4">
              <AlertTriangle className="w-16 h-16 text-red-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to fetch tasks</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={fetchTodoist}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          ) : loading ? (
            <LoadingSpinner message="Syncing tasks..." fullScreen={false} />
          ) : filteredTodos.length === 0 ? (
            <div className="text-center py-12 px-4">
              <CheckSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {activeTab === 'overdue'
                  ? 'No overdue tasks'
                  : activeTab === 'today'
                    ? 'No tasks for today'
                    : 'Inbox is empty'}
              </h3>
              <p className="text-gray-600">
                {activeTab === 'overdue'
                  ? "Great! You're all caught up with overdue tasks."
                  : activeTab === 'today'
                    ? "You're all set for today, or add some tasks to get started."
                    : 'Your inbox is clean! New tasks will appear here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {filteredTodos.map(todo => (
                <div
                  key={todo.id}
                  onClick={() => setSelectedTaskId(todo.id)}
                  className={`border-b border-gray-200 p-2 transition-all cursor-pointer ${
                    todo.isCompleted ? 'opacity-60' : ''
                  } ${
                    selectedTaskId === todo.id
                      ? 'bg-blue-100 border-l-4 border-l-blue-500'
                      : todo.aiCategory === 'high_priority'
                        ? 'bg-white hover:bg-gray-50 border-l-4 border-l-orange-500'
                        : todo.aiCategory === 'easy'
                          ? 'bg-white hover:bg-gray-50 border-l-4 border-l-green-500'
                          : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <h3
                        className={`text-sm ${
                          todo.isCompleted ? 'line-through text-gray-500' : 'text-gray-900'
                        }`}
                      >
                        {todo.title}
                      </h3>
                      {todo.url && (
                        <a
                          href={todo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                          onClick={e => e.stopPropagation()}
                          title="Open in Todoist"
                        >
                          <ExternalLink className="w-2 h-2" />
                        </a>
                      )}
                      {!todo.aiCategory && !analyzingTasks.has(todo.id) && (
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            analyzeTask(todo)
                          }}
                          className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                          title="Analyze with AI"
                        >
                          <Brain className="w-3 h-3" />
                        </button>
                      )}
                      {analyzingTasks.has(todo.id) && (
                        <div className="w-3 h-3 animate-spin rounded-full border border-blue-600 border-t-transparent flex-shrink-0"></div>
                      )}
                    </div>
                    <span
                      className={`px-1 py-0.5 text-xs rounded border ${getPriorityColor(
                        todo.priority
                      )}`}
                    >
                      {todo.priority}
                    </span>
                  </div>

                  {todo.description && (
                    <p
                      className={`text-xs ${todo.isCompleted ? 'text-gray-400' : 'text-gray-600'}`}
                    >
                      {todo.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                    <div className="flex items-center gap-2">
                      {todo.dueDate && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span
                            className={
                              todo.dueDate < today && !todo.isCompleted
                                ? 'text-red-600 font-medium'
                                : ''
                            }
                          >
                            Due: {formatDate(todo.dueDate)}
                          </span>
                        </div>
                      )}
                      {todo.projectName && (
                        <span className="text-gray-500">📁 {todo.projectName}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Reasoning Panel - Right Side */}
        <div className="w-1/2 bg-gray-50 overflow-y-auto">
          {selectedTaskId ? (
            (() => {
              const selectedTask = filteredTodos.find(t => t.id === selectedTaskId)
              return selectedTask ? (
                <div className="p-4">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-gray-900">
                          {selectedTask.title}
                        </h2>
                        {selectedTask.url && (
                          <a
                            href={selectedTask.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-gray-600"
                            title="Open in Todoist"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => startChat(selectedTask)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        title="Chat with AI assistant"
                      >
                        <MessageCircle className="w-3 h-3" />
                        Chat
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      {selectedTask.aiCategory === 'high_priority' && (
                        <span className="px-2 py-1 text-xs bg-orange-200 text-orange-800 rounded">
                          High Priority
                        </span>
                      )}
                      {selectedTask.aiCategory === 'easy' && (
                        <span className="px-2 py-1 text-xs bg-green-200 text-green-800 rounded">
                          Easy Win
                        </span>
                      )}
                      {selectedTask.aiCategory === 'normal' && (
                        <span className="px-2 py-1 text-xs bg-gray-200 text-gray-800 rounded">
                          Normal
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 text-xs rounded border ${getPriorityColor(
                          selectedTask.priority
                        )}`}
                      >
                        {selectedTask.priority}
                      </span>
                    </div>
                  </div>

                  {selectedTask.description && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-gray-900 mb-1">Description</h3>
                      <p className="text-sm text-gray-600">{selectedTask.description}</p>
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-2">AI Analysis</h3>
                    {selectedTask.aiReasoning ? (
                      <div className="bg-white rounded-lg border p-3">
                        <p className="text-sm text-gray-700">{selectedTask.aiReasoning}</p>
                      </div>
                    ) : analyzingTasks.has(selectedTask.id) ? (
                      <div className="bg-white rounded-lg border p-3 flex items-center gap-2">
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                        <span className="text-sm text-gray-600">Analyzing task...</span>
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg border p-3">
                        <p className="text-sm text-gray-500 mb-2">No AI analysis available</p>
                        <button
                          onClick={() => analyzeTask(selectedTask)}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Analyze with AI
                        </button>
                      </div>
                    )}
                  </div>

                  {selectedTask.dueDate && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-gray-900 mb-1">Due Date</h3>
                      <p
                        className={`text-sm ${
                          selectedTask.dueDate < today && !selectedTask.isCompleted
                            ? 'text-red-600 font-medium'
                            : 'text-gray-600'
                        }`}
                      >
                        {formatDate(selectedTask.dueDate)}
                      </p>
                    </div>
                  )}

                  {selectedTask.projectName && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-gray-900 mb-1">Project</h3>
                      <p className="text-sm text-gray-600">{selectedTask.projectName}</p>
                    </div>
                  )}
                </div>
              ) : null
            })()
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a task</h3>
                <p className="text-gray-600">
                  Click on a task from the list to see its AI analysis and details
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chatbot Modal */}
      {showChatbot && selectedTaskId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-96 h-96 flex flex-col">
            <div className="flex items-center justify-between p-3 border-b">
              <h3 className="font-semibold text-gray-900">AI Assistant</h3>
              <button
                onClick={() => setShowChatbot(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-3 py-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: '0.1s' }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Ask about this task..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isChatLoading}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim() || isChatLoading}
                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Todoist
