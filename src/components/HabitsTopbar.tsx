import { Calendar, BarChart3 } from 'lucide-react'

interface HabitsTopbarProps {
  activeTab: 'today' | 'last7days'
  onTabChange: (tab: 'today' | 'last7days') => void
}

const HabitsTopbar = ({ activeTab, onTabChange }: HabitsTopbarProps) => {
  const tabs = [
    {
      key: 'today' as const,
      label: 'Today',
      icon: Calendar,
    },
    {
      key: 'last7days' as const,
      label: 'Last 7 Days',
      icon: BarChart3,
    },
  ]

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="flex">
        {tabs.map(tab => {
          const isActive = activeTab === tab.key
          const Icon = tab.icon

          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex items-center gap-2 px-6 py-1 text-sm font-medium transition-colors border-b-2 ${
                isActive
                  ? 'text-blue-700 border-blue-500 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-transparent'
              }`}
            >
              <Icon className="w-2 h-2" />
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default HabitsTopbar