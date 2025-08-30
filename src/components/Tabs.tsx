import { motion } from 'framer-motion'

interface Tab {
  id: string
  label: string
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
}

export const Tabs = ({ tabs, activeTab, onChange }: TabsProps) => {
  return (
    <div className="border-b border-neutral-200">
      <nav className="flex space-x-8">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              relative py-2 px-1 text-sm font-medium
              ${activeTab === tab.id ? 'text-primary-600' : 'text-neutral-500 hover:text-neutral-900'}
            `}
          >
            <div className="flex items-center">
              {tab.label}
              {typeof tab.count === 'number' && (
                <span
                  className={`ml-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    activeTab === tab.id
                      ? 'bg-primary-100 text-primary-800'
                      : 'bg-neutral-100 text-neutral-800'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </div>

            {activeTab === tab.id && (
              <motion.div
                className="absolute bottom-0 inset-x-0 h-0.5 bg-primary-600"
                layoutId="underline"
              />
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
