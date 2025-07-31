import {
  Sparkles,
  RefreshCw,
  Tag,
  ExternalLink,
  ArrowUp,
  MessageCircle,
  TrendingUp,
  Info,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useBehaviors } from '../hooks/useBehaviors'
import { useReflections } from '../hooks/useReflections'
import { DailyReflection } from '../types'

const Dashboard = () => {
  const { behaviors, loading: behaviorsLoading } = useBehaviors()
  const { generateReflection, getTodaysReflection, loading: reflectionLoading } = useReflections()
  const [todaysReflection, setTodaysReflection] = useState<DailyReflection | null>(null)
  const [generatingReflection, setGeneratingReflection] = useState(false)

  useEffect(() => {
    loadTodaysReflection()
  }, [])

  const loadTodaysReflection = async () => {
    try {
      const reflection = await getTodaysReflection()
      setTodaysReflection(reflection)
    } catch (error) {
      console.error("Error loading today's reflection:", error)
    }
  }


  const getCategoryColor = (category?: string) => {
    const colors = {
      health: 'bg-green-100 text-green-800',
      mindfulness: 'bg-purple-100 text-purple-800',
      productivity: 'bg-blue-100 text-blue-800',
      social: 'bg-orange-100 text-orange-800',
    }
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const groupedBehaviors = behaviors.reduce(
    (acc, behavior) => {
      const category = behavior.category || 'other'
      if (!acc[category]) acc[category] = []
      acc[category].push(behavior)
      return acc
    },
    {} as Record<string, typeof behaviors>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-4">

      {/* Info Banner */}
      <div className="-mx-4 -mt-4 mb-4 px-4 py-2 bg-blue-50 md:mx-0 md:mt-0 md:mb-6 md:px-4 md:py-3 md:bg-blue-50 md:border md:border-blue-100 md:rounded-lg">
        <div className="flex items-start gap-2 md:gap-3">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500 md:w-5 md:h-5" />
          <p className="text-sm text-blue-700 leading-tight md:leading-relaxed">
            Reflections and Reddit posts generate automatically each day based on your completed habits and notes. 
            Navigate to any page to trigger generation when you have new completions.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Reddit Posts - First on mobile, Right Column on desktop (2/3 width) */}
        <div className="w-full md:w-2/3 md:order-2">
          <h2 className="text-xl font-medium text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-3 h-3" />
            From People 1-2 Steps Ahead
          </h2>
          <div className="p-1">
            {todaysReflection?.reddit_links &&
            Array.isArray(todaysReflection.reddit_links) &&
            todaysReflection.reddit_links.length > 0 ? (
              <div className="space-y-2">
                {todaysReflection.reddit_links.map((post, index) => (
                  <div key={index}>
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                    >
                      <div className="flex items-start justify-between">
        <div className="flex items-start text-sm text-gray-600">
                          <div className="flex flex-col items-center gap-0.5 w-6">
                            <ArrowUp className="w-3 h-3" />
                            <span className="text-xs font-medium text-gray-700">{post.upvotes}</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5 w-6">
                            <MessageCircle className="w-3 h-3" />
                            <span className="text-xs font-medium text-gray-700">{post.comments}</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 ml-3">
                          <h4 className="font-medium text-emerald-700 group-hover:text-indigo-600 line-clamp-3 text-base mb-2">
                            {post.title}
                          </h4>
                          <span className="font-medium text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                            r/{post.subreddit}
                          </span>
                        </div>
                        <ExternalLink className="w-3 h-3 mt-1 text-gray-400 group-hover:text-blue-600 flex-shrink-0 ml-2" />
                      </div>
                    </a>
                    {index < todaysReflection.reddit_links.length - 1 && (
                      <div className="mt-2 border-t border-gray-200"></div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Reddit posts yet</h3>
                <p className="text-gray-600">
                  Reddit posts will appear here when your reflection is generated.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Reflection - Second on mobile, Left Column on desktop (1/3 width) */}
        <div className="w-full md:w-1/3 md:order-1">
          <h2 className="text-xl font-medium text-gray-900 mb-4">Today's Reflection</h2>
          <div className="p-1">
            {todaysReflection ? (
              <div>
                <div className="prose prose-sm max-w-none">
                  <div
                    className="text-gray-800 leading-relaxed"
                    style={{
                      fontFamily: 'Georgia, Times, serif',
                      fontSize: '16px',
                      lineHeight: '1.6',
                    }}
                  >
                    {todaysReflection.content.split('\n\n').map((paragraph, index) => (
                      <p key={index} className="mb-3">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Generated on{' '}
                    {new Date(todaysReflection.generated_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Sparkles className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No reflection yet</h3>
                <p className="text-gray-600 text-sm">
                  Complete some habits or write notes to generate your daily reflection.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
