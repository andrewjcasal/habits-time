import { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { Project } from '../types'

interface NewSessionModalProps {
  isOpen: boolean
  onClose: () => void
  selectedProject: Project | null
  onCreateSessions: (contractName: string, projectId: string, sessionData: any[]) => Promise<void>
}

const NewSessionModal = ({
  isOpen,
  onClose,
  selectedProject,
  onCreateSessions,
}: NewSessionModalProps) => {
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [sessionHours, setSessionHours] = useState<{ [key: string]: number }>({})
  const [contractName, setContractName] = useState('')
  const [modalStep, setModalStep] = useState<'contract' | 'dates' | 'preview'>('contract')

  const generateCalendarDays = useCallback((month: number, year: number) => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const firstDayOfWeek = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    const days = []

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null)
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }

    return days
  }, [])

  const isDateSelected = (date: Date) => {
    return selectedDates.some(d => d.toDateString() === date.toDateString())
  }

  const handleDateToggle = (date: Date) => {
    const dateStr = date.toDateString()
    setSelectedDates(prev => {
      const exists = prev.find(d => d.toDateString() === dateStr)
      if (exists) {
        // Remove from sessionHours when date is deselected
        setSessionHours(prevHours => {
          const newHours = { ...prevHours }
          delete newHours[dateStr]
          return newHours
        })
        return prev.filter(d => d.toDateString() !== dateStr)
      } else {
        // Add default hours when date is selected
        setSessionHours(prevHours => ({
          ...prevHours,
          [dateStr]: 2,
        }))
        return [...prev, date]
      }
    })
  }

  const handleCreateSessions = async () => {
    if (!selectedProject) {
      console.error('No project selected')
      return
    }

    try {
      // Prepare session data
      const sessionData = selectedDates.map(date => ({
        date,
        hours: sessionHours[date.toDateString()] || 2,
      }))

      // Create sessions with contract
      await onCreateSessions(contractName, selectedProject.id, sessionData)

      // Reset form state
      setSelectedDates([])
      setSessionHours({})
      setContractName('')
      setModalStep('contract')
      onClose()
    } catch (error) {
      console.error('Error creating sessions:', error)
    }
  }

  const resetAndClose = () => {
    setSelectedDates([])
    setSessionHours({})
    setContractName('')
    setModalStep('contract')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">Schedule Sessions</h2>
          <button onClick={resetAndClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {modalStep === 'contract' ? (
          <div className="space-y-4">
            <div className="text-sm text-neutral-600 mb-4">
              Enter contract name for these sessions
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Contract name"
                value={contractName}
                onChange={e => setContractName(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                required
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={resetAndClose}
                className="px-4 py-2 text-neutral-600 text-sm hover:text-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={() => setModalStep('dates')}
                disabled={!contractName.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        ) : modalStep === 'dates' ? (
          <div className="space-y-4">
            <div className="text-sm text-neutral-600 mb-4">
              Select multiple dates to schedule sessions
            </div>

            {/* Dual Calendar */}
            <div className="border border-neutral-200 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-6">
                {/* Current Month */}
                {(() => {
                  const today = new Date()
                  const currentMonth = today.getMonth()
                  const currentYear = today.getFullYear()
                  const days = generateCalendarDays(currentMonth, currentYear)
                  const monthNames = [
                    'January',
                    'February',
                    'March',
                    'April',
                    'May',
                    'June',
                    'July',
                    'August',
                    'September',
                    'October',
                    'November',
                    'December',
                  ]

                  return (
                    <div>
                      <div className="text-center mb-4">
                        <h3 className="text-lg font-medium text-neutral-900">
                          {monthNames[currentMonth]} {currentYear}
                        </h3>
                      </div>

                      {/* Day headers */}
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                          <div
                            key={day}
                            className="text-xs font-medium text-neutral-500 text-center py-1"
                          >
                            {day}
                          </div>
                        ))}
                      </div>

                      {/* Calendar days */}
                      <div className="grid grid-cols-7 gap-1">
                        {days.map((date, index) => (
                          <div key={index} className="aspect-square">
                            {date && (
                              <button
                                onClick={() => handleDateToggle(date)}
                                className={`w-full h-full text-sm rounded-md transition-colors ${
                                  isDateSelected(date)
                                    ? 'bg-primary-600 text-white'
                                    : 'hover:bg-neutral-100 text-neutral-700'
                                }`}
                              >
                                {date.getDate()}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Next Month */}
                {(() => {
                  const today = new Date()
                  const nextMonth = today.getMonth() + 1
                  const nextYear = nextMonth > 11 ? today.getFullYear() + 1 : today.getFullYear()
                  const adjustedMonth = nextMonth > 11 ? 0 : nextMonth
                  const days = generateCalendarDays(adjustedMonth, nextYear)
                  const monthNames = [
                    'January',
                    'February',
                    'March',
                    'April',
                    'May',
                    'June',
                    'July',
                    'August',
                    'September',
                    'October',
                    'November',
                    'December',
                  ]

                  return (
                    <div>
                      <div className="text-center mb-4">
                        <h3 className="text-lg font-medium text-neutral-900">
                          {monthNames[adjustedMonth]} {nextYear}
                        </h3>
                      </div>

                      {/* Day headers */}
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                          <div
                            key={day}
                            className="text-xs font-medium text-neutral-500 text-center py-1"
                          >
                            {day}
                          </div>
                        ))}
                      </div>

                      {/* Calendar days */}
                      <div className="grid grid-cols-7 gap-1">
                        {days.map((date, index) => (
                          <div key={index} className="aspect-square">
                            {date && (
                              <button
                                onClick={() => handleDateToggle(date)}
                                className={`w-full h-full text-sm rounded-md transition-colors ${
                                  isDateSelected(date)
                                    ? 'bg-primary-600 text-white'
                                    : 'hover:bg-neutral-100 text-neutral-700'
                                }`}
                              >
                                {date.getDate()}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>

            {selectedDates.length > 0 && (
              <div className="text-sm text-neutral-600">
                {selectedDates.length} date{selectedDates.length > 1 ? 's' : ''} selected
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setModalStep('contract')}
                className="px-4 py-2 text-neutral-600 text-sm hover:text-neutral-800"
              >
                Back
              </button>
              <button
                type="button"
                onClick={resetAndClose}
                className="px-4 py-2 text-neutral-600 text-sm hover:text-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={() => setModalStep('preview')}
                disabled={selectedDates.length === 0}
                className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Preview
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-neutral-600 mb-4">Review sessions to be created</div>

            <div className="bg-neutral-50 p-3 rounded-lg mb-4">
              <div className="text-sm font-medium text-neutral-900">Contract: {contractName}</div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              <div className="space-y-0">
                {selectedDates
                  .sort((a, b) => a.getTime() - b.getTime())
                  .map((date, index) => {
                    const dateStr = date.toDateString()
                    return (
                      <div key={index}>
                        <div className="flex items-center justify-between py-2">
                          <span className="text-sm text-neutral-900">
                            {date.toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={
                                sessionHours[dateStr] !== undefined ? sessionHours[dateStr] : 2
                              }
                              onChange={e => {
                                const inputValue = e.target.value
                                setSessionHours(prev => ({
                                  ...prev,
                                  [dateStr]: inputValue,
                                }))
                              }}
                              onBlur={e => {
                                const numValue = parseFloat(e.target.value)
                                if (isNaN(numValue) || numValue < 0.5) {
                                  setSessionHours(prev => ({
                                    ...prev,
                                    [dateStr]: 0.5,
                                  }))
                                } else {
                                  setSessionHours(prev => ({
                                    ...prev,
                                    [dateStr]: numValue,
                                  }))
                                }
                              }}
                              min="0.5"
                              step="0.5"
                              className="w-16 px-2 py-1 text-sm border border-neutral-300 rounded text-center"
                            />
                            <span className="text-xs text-neutral-500">hours</span>
                          </div>
                        </div>
                        {index < selectedDates.length - 1 && (
                          <div className="border-t border-neutral-200 my-0"></div>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-neutral-200">
              <span className="text-sm text-neutral-600">Total Hours:</span>
              <span className="text-sm font-medium text-neutral-900">
                {selectedDates.reduce((total, date) => {
                  const dateStr = date.toDateString()
                  const hours = sessionHours[dateStr]
                  if (hours === undefined) return total + 2
                  const numHours = typeof hours === 'string' ? parseFloat(hours) : hours
                  return total + (isNaN(numHours) ? 0 : numHours)
                }, 0)}{' '}
                hours
              </span>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setModalStep('dates')}
                className="px-4 py-2 text-neutral-600 text-sm hover:text-neutral-800"
              >
                Back
              </button>
              <button
                type="button"
                onClick={resetAndClose}
                className="px-4 py-2 text-neutral-600 text-sm hover:text-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSessions}
                className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
              >
                Create {selectedDates.length} Session{selectedDates.length > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default NewSessionModal
