import {
  Sparkles,
  RefreshCw,
  Tag,
  ExternalLink,
  ArrowUp,
  MessageCircle,
  TrendingUp,
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

  const handleGenerateReflection = async () => {
    try {
      setGeneratingReflection(true)
      const reflection = await generateReflection()
      if (reflection) {
        setTodaysReflection(reflection)
      }
    } catch (error) {
      console.error('Error generating reflection:', error)
    } finally {
      setGeneratingReflection(false)
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
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-light text-gray-900 mb-2">Daily Reflection</h1>
        <p className="text-gray-600">Your journey of growth and self-discovery</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Reflection */}
        <div className="lg:col-span-2">
          {/* Generate Button */}
          <div className="mb-4">
            <button
              onClick={handleGenerateReflection}
              disabled={generatingReflection || reflectionLoading}
              className="inline-flex items-center gap-2 px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generatingReflection ? <>Generating...</> : <>Generate Today's Reflection</>}
            </button>
          </div>

          {/* Reflection Content */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            {todaysReflection ? (
              <div>
                <div className="prose prose-lg max-w-none">
                  <div
                    className="text-gray-800 leading-relaxed"
                    style={{
                      fontFamily: 'Georgia, Times, serif',
                      fontSize: '18px',
                      lineHeight: '1.7',
                    }}
                  >
                    {todaysReflection.content.split('\n\n').map((paragraph, index) => (
                      <p key={index} className="mb-4">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
                {/* Reddit Links Section */}
                {todaysReflection.reddit_links &&
                  Array.isArray(todaysReflection.reddit_links) &&
                  todaysReflection.reddit_links.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        From People 1-2 Steps Ahead
                      </h3>
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
                                <div className="flex items-start gap-3 text-sm text-gray-600">
                                  <div className="flex flex-col items-center gap-0.5 w-4">
                                    <ArrowUp className="w-3 h-3" />
                                    <span className="text-sm text-gray-700">{post.upvotes}</span>
                                  </div>
                                  <div className="flex flex-col items-center gap-0.5 w-3">
                                    <MessageCircle className="w-3 h-3" />
                                    <span className="text-sm text-gray-700">{post.comments}</span>
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0 ml-4">
                                  <h4 className="font-medium text-emerald-700 group-hover:text-indigo-600 line-clamp-2">
                                    {post.title}
                                  </h4>
                                  <span className="font-medium text-xs text-gray-600 mt-1 block">
                                    r/{post.subreddit}
                                  </span>
                                </div>
                                <ExternalLink className="w-2 h-2 mt-[2px] text-gray-400 group-hover:text-blue-600 flex-shrink-0 ml-3" />
                              </div>
                            </a>
                            {index < todaysReflection.reddit_links.length - 1 && (
                              <div className="mt-2 border-t border-gray-200"></div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                <div className="mt-3 pt-1 border-t border-gray-200">
                  <p className="text-sm text-gray-500">
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
              <div className="text-center py-12">
                <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No reflection yet</h3>
                <p className="text-gray-600 mb-6">
                  Generate your daily reflection to get personalized insights based on your recent
                  habits and notes.
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
