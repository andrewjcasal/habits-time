import { createContext, useContext, useState, ReactNode } from 'react'
import { Meeting } from '../types'

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
}

interface ModalActions {
  // Meeting actions
  openMeetingModal: (timeSlot?: { time: string; date: Date }, editing?: Meeting) => void
  closeMeetingModal: () => void
  setNewMeeting: (meeting: any) => void
  handleCreateMeeting: (e: React.FormEvent, updatedMeeting: typeof modalState.newMeeting) => Promise<void>
  handleDeleteMeeting: () => Promise<void>

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
}

interface ModalProviderProps {
  children: ReactNode
  // Inject the actual handlers from Calendar
  onCreateMeeting: (e: React.FormEvent, meeting: any) => Promise<void>
  onDeleteMeeting: () => Promise<void>
}

export const ModalProvider = ({ children, onCreateMeeting, onDeleteMeeting }: ModalProviderProps) => {
  const [modalState, setModalState] = useState<ModalState>(initialModalState)

  const openMeetingModal = (timeSlot?: { time: string; date: Date }, editing?: Meeting) => {
    if (editing) {
      const startTime = new Date(editing.start_time)
      const endTime = new Date(editing.end_time)
      setModalState(prev => ({
        ...prev,
        showMeetingModal: true,
        editingMeeting: editing,
        newMeeting: {
          title: editing.title,
          description: editing.description || '',
          start_time: startTime.toTimeString().slice(0, 5),
          end_time: endTime.toTimeString().slice(0, 5),
          date: startTime.toISOString().split('T')[0],
          location: editing.location || '',
          meeting_type: editing.meeting_type,
          priority: editing.priority,
          category_id: editing.category_id,
        },
        selectedTimeSlot: null,
      }))
    } else if (timeSlot) {
      const [hour, minute] = timeSlot.time.split(':')
      const startTime = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
      
      // Add 15 minutes to start time for single clicks
      const startMinutes = parseInt(hour) * 60 + parseInt(minute)
      const endMinutes = startMinutes + 15
      const endHour = Math.floor(endMinutes / 60)
      const endMinute = endMinutes % 60
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`

      setModalState(prev => ({
        ...prev,
        showMeetingModal: true,
        editingMeeting: null,
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
        ...prev,
        showMeetingModal: true,
        editingMeeting: null,
        selectedTimeSlot: null,
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
  }

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
      ...prev,
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
      ...prev,
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
      ...prev,
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
    handleCreateMeeting: async (e: React.FormEvent, updatedMeeting: any) => {
      // Handle meeting creation here or delegate to a callback
      await onCreateMeeting(e, updatedMeeting)
    },
    handleDeleteMeeting: async () => {
      // Handle meeting deletion here or delegate to a callback
      await onDeleteMeeting()
    },
    openHabitModal,
    closeHabitModal,
    openTaskModal,
    closeTaskModal,
    openSessionModal,
    closeSessionModal,
    closeAllModals,
    addMeetingFromHabit,
    addMeetingFromTask,
  }

  return (
    <ModalContext.Provider value={value}>
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