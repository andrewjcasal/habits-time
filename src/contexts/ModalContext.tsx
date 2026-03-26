import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { Meeting } from '../types'
import { useUserContext } from './UserContext'
import { supabase } from '../lib/supabase'
import MeetingModal from '../components/MeetingModal'
import CalendarTaskModal from '../components/CalendarTaskModal'
import HabitModal from '../components/HabitModal'
import SessionEditModal from '../components/SessionEditModal'

interface ModalState {
  // Meeting Modal
  showMeetingModal: boolean
  newMeeting: {
    title: string
    description: string
    start_time: string
    end_time: string
    date: string
    location: string
    meeting_type: Meeting['meeting_type']
    priority: Meeting['priority']
    category_id?: string
  }
  selectedTimeSlot: { time: string; date: Date } | null
  editingMeeting: Meeting | null

  // Habit Modal
  showHabitModal: boolean
  selectedHabit: any | null
  selectedHabitDate: Date | null

  // Task Modal
  showTaskModal: boolean
  selectedTask: any | null

  // Session Modal
  showSessionModal: boolean
  selectedSession: any | null

  // Resize Conflict Dialog
  showResizeConflictDialog: boolean
  resizeConflictingTasks: any[]
  resizeConflictMeeting: any | null
  resizeConflictNewEndTime: Date | null
}

interface ModalActions {
  // Meeting actions
  openMeetingModal: (timeSlot?: { time: string; date: Date; endTime?: string }, editing?: Meeting) => void
  closeMeetingModal: () => void
  setNewMeeting: (meeting: any) => void
  handleSaveMeeting: (e: React.FormEvent, updatedMeeting: typeof modalState.newMeeting, editingMeeting?: Meeting) => Promise<void>
  handleDeleteMeeting: (meeting: Meeting) => Promise<void>

  // Habit actions
  openHabitModal: (habit: any, date: Date) => void
  closeHabitModal: () => void

  // Task actions
  openTaskModal: (task: any) => void
  closeTaskModal: () => void

  // Session actions
  openSessionModal: (session: any) => void
  closeSessionModal: () => void

  // Global close
  closeAllModals: () => void

  // Resize conflict actions
  openResizeConflictDialog: (meeting: any, newEndTime: Date, conflictingTasks: any[]) => void
  closeResizeConflictDialog: () => void
  confirmResizeConflict: (deleteTasks: boolean) => Promise<void>

  // Cross-modal actions
  addMeetingFromHabit: () => void
  addMeetingFromTask: () => void
}

interface ModalContextType extends ModalState, ModalActions {}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

const initialModalState: ModalState = {
  showMeetingModal: false,
  newMeeting: {
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    date: '',
    location: '',
    meeting_type: 'general',
    priority: 'medium',
    category_id: undefined,
  },
  selectedTimeSlot: null,
  editingMeeting: null,
  showHabitModal: false,
  selectedHabit: null,
  selectedHabitDate: null,
  showTaskModal: false,
  selectedTask: null,
  showSessionModal: false,
  selectedSession: null,
  showResizeConflictDialog: false,
  resizeConflictingTasks: [],
  resizeConflictMeeting: null,
  resizeConflictNewEndTime: null,
}

interface ModalProviderProps {
  children: ReactNode
  // Inject the actual handlers from Calendar
  onSaveMeeting: (e: React.FormEvent, meeting: any, editingMeeting?: Meeting) => Promise<void>
  onDeleteMeeting: (meeting: Meeting) => Promise<void>
  onCompleteTask: (task: any) => Promise<void>
  onDeleteTask: (task: any) => Promise<void>
  onHabitTimeChange: (habit: any, date: Date, newTime: string) => Promise<void>
  onHabitSkip: (habit: any, date: Date) => Promise<void>
  onUpdateSession: (sessionId: string, updates: any) => Promise<void>
  onTaskLogCreated: () => void
  onUpdateMeetingEndTime: (meetingId: string, newEndTime: string) => Promise<void>
  onDeleteTaskLog: (logId: string) => Promise<void>
  onRemoveTaskLogFromUI: (logId: string) => void
}

export const ModalProvider = ({ children, onSaveMeeting, onDeleteMeeting, onCompleteTask, onDeleteTask, onHabitTimeChange, onHabitSkip, onUpdateSession, onTaskLogCreated, onUpdateMeetingEndTime, onDeleteTaskLog, onRemoveTaskLogFromUI }: ModalProviderProps) => {
  const { user } = useUserContext()
  const [modalState, setModalState] = useState<ModalState>(initialModalState)
  const [userSettings, setUserSettings] = useState<any>(null)

  // Fetch user settings
  useEffect(() => {
    const fetchUserSettings = async () => {
      if (!user) return

      try {
        const { data: settings, error } = await supabase
          .from('cassian_user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching user settings:', error)
          return
        }

        setUserSettings(settings)
      } catch (error) {
        console.error('Error fetching user settings:', error)
      }
    }

    fetchUserSettings()
  }, [user])

  // Helper function to close all modals and reset their state (memoized)
  const getClosedModalState = useCallback((prevState: ModalState) => ({
    ...prevState,
    showMeetingModal: false,
    showHabitModal: false,
    showTaskModal: false,
    showSessionModal: false,
    selectedTimeSlot: null,
    editingMeeting: null,
    selectedHabit: null,
    selectedHabitDate: null,
    selectedTask: null,
    selectedSession: null,
    showResizeConflictDialog: false,
    resizeConflictingTasks: [],
    resizeConflictMeeting: null,
    resizeConflictNewEndTime: null,
  }), [])

  const openMeetingModal = useCallback((timeSlot?: { time: string; date: Date; endTime?: string }, editing?: Meeting) => {
    if (editing) {
      const startTime = new Date(editing.start_time)
      const endTime = new Date(editing.end_time)
      setModalState(prev => ({
        ...getClosedModalState(prev),
        showMeetingModal: true,
        editingMeeting: editing,
        newMeeting: {
          title: editing.title,
          description: editing.description || '',
          start_time: startTime.toTimeString().slice(0, 5),
          end_time: endTime.toTimeString().slice(0, 5),
          date: userSettings?.week_ending_timezone 
            ? startTime.toLocaleDateString('en-CA', { timeZone: userSettings.week_ending_timezone })
            : startTime.toLocaleDateString('en-CA'),
          location: editing.location || '',
          meeting_type: editing.meeting_type,
          priority: editing.priority,
          category_id: editing.category_id,
        },
      }))
    } else if (timeSlot) {
      const [hour, minute] = timeSlot.time.split(':')
      const startTime = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`

      // Use provided endTime or calculate default 15-minute duration
      let endTime: string
      if (timeSlot.endTime) {
        endTime = timeSlot.endTime
      } else {
        // Add 15 minutes to start time for single clicks
        const startMinutes = parseInt(hour) * 60 + parseInt(minute)
        const endMinutes = startMinutes + 15
        const endHour = Math.floor(endMinutes / 60)
        const endMinute = endMinutes % 60
        endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`
      }

      setModalState(prev => ({
        ...getClosedModalState(prev),
        showMeetingModal: true,
        selectedTimeSlot: timeSlot,
        newMeeting: {
          title: '',
          description: '',
          start_time: startTime,
          end_time: endTime,
          date: timeSlot.date.toISOString().split('T')[0],
          location: '',
          meeting_type: 'general',
          priority: 'medium',
          category_id: undefined,
        },
      }))
    } else {
      setModalState(prev => ({
        ...getClosedModalState(prev),
        showMeetingModal: true,
        newMeeting: {
          title: '',
          description: '',
          start_time: '',
          end_time: '',
          date: new Date().toISOString().split('T')[0],
          location: '',
          meeting_type: 'general',
          priority: 'medium',
          category_id: undefined,
        },
      }))
    }
  }, [getClosedModalState, userSettings])

  const closeMeetingModal = () => {
    setModalState(prev => ({
      ...prev,
      showMeetingModal: false,
      selectedTimeSlot: null,
      editingMeeting: null,
    }))
  }

  const setNewMeeting = (meeting: any) => {
    setModalState(prev => ({
      ...prev,
      newMeeting: meeting,
    }))
  }

  const openHabitModal = (habit: any, date: Date) => {
    setModalState(prev => ({
      ...getClosedModalState(prev),
      showHabitModal: true,
      selectedHabit: habit,
      selectedHabitDate: date,
    }))
  }

  const closeHabitModal = () => {
    setModalState(prev => ({
      ...prev,
      showHabitModal: false,
      selectedHabit: null,
      selectedHabitDate: null,
    }))
  }

  const openTaskModal = (task: any) => {
    setModalState(prev => ({
      ...getClosedModalState(prev),
      showTaskModal: true,
      selectedTask: task,
    }))
  }

  const closeTaskModal = () => {
    setModalState(prev => ({
      ...prev,
      showTaskModal: false,
      selectedTask: null,
    }))
  }

  const openSessionModal = (session: any) => {
    setModalState(prev => ({
      ...getClosedModalState(prev),
      showSessionModal: true,
      selectedSession: session,
    }))
  }

  const closeSessionModal = () => {
    setModalState(prev => ({
      ...prev,
      showSessionModal: false,
      selectedSession: null,
    }))
  }

  const closeAllModals = () => {
    setModalState(initialModalState)
  }

  // Resize conflict actions
  const openResizeConflictDialog = (meeting: any, newEndTime: Date, conflictingTasks: any[]) => {
    setModalState(prev => ({
      ...getClosedModalState(prev),
      showResizeConflictDialog: true,
      resizeConflictMeeting: meeting,
      resizeConflictNewEndTime: newEndTime,
      resizeConflictingTasks: conflictingTasks,
    }))
  }

  const closeResizeConflictDialog = () => {
    setModalState(prev => ({
      ...prev,
      showResizeConflictDialog: false,
      resizeConflictingTasks: [],
      resizeConflictMeeting: null,
      resizeConflictNewEndTime: null,
    }))
  }

  const confirmResizeConflict = async (deleteTasks: boolean) => {
    const { resizeConflictMeeting: meeting, resizeConflictNewEndTime: newEndTime, resizeConflictingTasks: tasks } = modalState
    if (!meeting || !newEndTime) return
    if (deleteTasks) {
      for (const task of tasks) {
        await onDeleteTaskLog(task.id)
        onRemoveTaskLogFromUI(task.id)
      }
    }
    await onUpdateMeetingEndTime(meeting.id, newEndTime.toISOString())
    closeResizeConflictDialog()
  }

  // Cross-modal actions
  const addMeetingFromHabit = () => {
    if (modalState.selectedHabit && modalState.selectedHabitDate) {
      // Close habit modal and open meeting modal with habit context
      const habitTime = modalState.selectedHabit.current_start_time || '09:00'
      const timeSlot = { time: habitTime, date: modalState.selectedHabitDate }
      
      closeHabitModal()
      openMeetingModal(timeSlot)
    }
  }

  const addMeetingFromTask = () => {
    if (modalState.selectedTask) {
      // Extract time from task and open meeting modal
      const taskDate = new Date(modalState.selectedTask.startTime ? modalState.selectedTask.startTime * 60 * 60 * 1000 : Date.now())
      const timeSlot = modalState.selectedTask.startTime ? 
        `${Math.floor(modalState.selectedTask.startTime).toString().padStart(2, '0')}:${((modalState.selectedTask.startTime % 1) * 60).toString().padStart(2, '0')}` :
        '09:00'
      
      closeTaskModal()
      openMeetingModal({ time: timeSlot, date: taskDate })
    }
  }

  const value: ModalContextType = {
    ...modalState,
    openMeetingModal,
    closeMeetingModal,
    setNewMeeting,
    handleSaveMeeting: async (e: React.FormEvent, updatedMeeting: any) => {
      // Handle meeting save (create/update) here or delegate to a callback
      await onSaveMeeting(e, updatedMeeting, modalState.editingMeeting || undefined)
      closeMeetingModal()
    },
    handleDeleteMeeting: async () => {
      // Handle meeting deletion here or delegate to a callback
      if (modalState.editingMeeting) {
        await onDeleteMeeting(modalState.editingMeeting)
        closeMeetingModal()
      }
    },
    openHabitModal,
    closeHabitModal,
    openTaskModal,
    closeTaskModal,
    openSessionModal,
    closeSessionModal,
    closeAllModals,
    openResizeConflictDialog,
    closeResizeConflictDialog,
    confirmResizeConflict,
    addMeetingFromHabit,
    addMeetingFromTask,
  }

  return (
    <ModalContext.Provider value={value}>
      <MeetingModal
        onTaskLogCreated={onTaskLogCreated}
        onBackToTask={modalState.selectedTask ? () => { closeTaskModal(); } : undefined}
      />
      <CalendarTaskModal
        isOpen={modalState.showTaskModal}
        onClose={closeTaskModal}
        task={modalState.selectedTask}
        onComplete={async () => { await onCompleteTask(modalState.selectedTask); closeTaskModal(); }}
        onDelete={async () => { await onDeleteTask(modalState.selectedTask); closeTaskModal(); }}
        onAddMeeting={() => addMeetingFromTask()}
      />
      <HabitModal
        onTimeChange={onHabitTimeChange}
        onSkip={onHabitSkip}
      />
      {modalState.selectedSession && (
        <SessionEditModal
          isOpen={modalState.showSessionModal}
          onClose={closeSessionModal}
          session={modalState.selectedSession}
          onUpdateSession={async (sessionId: string, updates: any) => {
            await onUpdateSession(sessionId, updates);
            closeSessionModal();
          }}
        />
      )}
      {/* Resize conflict dialog */}
      {modalState.showResizeConflictDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-full max-w-sm mx-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-2">Task Conflict</h3>
            <p className="text-xs text-neutral-600 mb-3">
              Extending this meeting overlaps with {modalState.resizeConflictingTasks.length} task{modalState.resizeConflictingTasks.length !== 1 ? 's' : ''}:
            </p>
            <ul className="text-xs text-neutral-700 mb-3 space-y-1">
              {modalState.resizeConflictingTasks.map((task: any, i: number) => (
                <li key={i} className="truncate">• {task.tasks?.title || 'Task'}</li>
              ))}
            </ul>
            <div className="flex gap-2 justify-end">
              <button
                onClick={closeResizeConflictDialog}
                className="px-3 py-1.5 text-xs bg-neutral-200 text-neutral-700 rounded hover:bg-neutral-300"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmResizeConflict(false)}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Extend & Keep Tasks
              </button>
              <button
                onClick={() => confirmResizeConflict(true)}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
              >
                Extend & Delete Tasks
              </button>
            </div>
          </div>
        </div>
      )}
      {children}
    </ModalContext.Provider>
  )
}

export const useModal = () => {
  const context = useContext(ModalContext)
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider')
  }
  return context
}