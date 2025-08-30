import { CheckCircle2, Target, BarChart3 } from 'lucide-react'

type TabType = 'habits' | 'progress' | 'aspects'

interface TabNavigationProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

const TabNavigation = ({ activeTab, onTabChange }: TabNavigationProps) => {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="flex">
        <button
          onClick={() => onTabChange('habits')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'habits'
              ? 'text-blue-700 border-blue-500 bg-blue-50'
              : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Habits
        </button>
        <button
          onClick={() => onTabChange('progress')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'progress'
              ? 'text-blue-700 border-blue-500 bg-blue-50'
              : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Progress
        </button>
        <button
          onClick={() => onTabChange('aspects')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'aspects'
              ? 'text-blue-700 border-blue-500 bg-blue-50'
              : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <Target className="w-4 h-4" />
          Aspects
        </button>
      </div>
    </div>
  )
}

export default TabNavigation