import React from 'react'
import { Calendar, Zap } from 'lucide-react'

interface NetworkingAction {
  id: string
  action_taken: string
  note?: string
  created_at: string
  follow_up_date?: string
  ask_for_intro?: boolean
}

interface NetworkingActionsListProps {
  actions: NetworkingAction[]
}

const NetworkingActionsList: React.FC<NetworkingActionsListProps> = ({ actions }) => {
  // Count intro requests
  const introRequestCount = actions.filter(action => action.ask_for_intro).length

  return (
    <div className="p-2 overflow-y-auto max-h-[60vh]">
      <div className="mb-3">
        <h4 className="text-md font-medium text-neutral-900">
          Networking Actions ({actions.length})
        </h4>
        {introRequestCount > 0 && (
          <p className="text-sm text-neutral-600 mt-1">
            Asked for intro: {introRequestCount} time
            {introRequestCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {actions.length > 0 ? (
        <div className="space-y-2">
          {actions.map(action => (
            <div key={action.id} className="border border-neutral-200 rounded-lg px-1 py-0.5">
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs text-neutral-500 mr-1">
                  {new Date(action.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <div className="flex-1">
                  <p className="text-xs font-medium text-neutral-900">{action.action_taken}</p>
                </div>
              </div>
              {action.note && <p className="text-sm text-neutral-600 mt-1">{action.note}</p>}
              {action.follow_up_date && (
                <div className="flex items-center text-xs text-neutral-500 mt-1">
                  <Calendar className="h-3 w-3 mr-1" />
                  Follow-up: {new Date(action.follow_up_date).toLocaleDateString()}
                </div>
              )}
              {action.ask_for_intro && (
                <div className="flex items-center text-xs text-blue-600 mt-1">
                  <span className="bg-blue-100 px-2 py-0.5 rounded text-xs">Intro Request</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <Zap className="h-10 w-10 text-neutral-300 mx-auto mb-2" />
          <p className="text-neutral-600">No networking actions yet</p>
          <p className="text-sm text-neutral-500 mt-1">
            Actions with this contact will appear here
          </p>
        </div>
      )}
    </div>
  )
}

export default NetworkingActionsList
