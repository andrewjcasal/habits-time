import {
  Sparkles,
  RefreshCw,
  Tag,
  ExternalLink,
  ArrowUp,
  MessageCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useBehaviors } from "../hooks/useBehaviors";
import { useReflections } from "../hooks/useReflections";
import { DailyReflection } from "../types";

const Dashboard = () => {
  const { behaviors, loading: behaviorsLoading } = useBehaviors();
  const {
    generateReflection,
    getTodaysReflection,
    loading: reflectionLoading,
  } = useReflections();
  const [todaysReflection, setTodaysReflection] =
    useState<DailyReflection | null>(null);
  const [generatingReflection, setGeneratingReflection] = useState(false);

  useEffect(() => {
    loadTodaysReflection();
  }, []);

  const loadTodaysReflection = async () => {
    try {
      const reflection = await getTodaysReflection();
      setTodaysReflection(reflection);
    } catch (error) {
      console.error("Error loading today's reflection:", error);
    }
  };

  const handleGenerateReflection = async () => {
    try {
      setGeneratingReflection(true);
      const reflection = await generateReflection();
      if (reflection) {
        setTodaysReflection(reflection);
      }
    } catch (error) {
      console.error("Error generating reflection:", error);
    } finally {
      setGeneratingReflection(false);
    }
  };

  const getCategoryColor = (category?: string) => {
    const colors = {
      health: "bg-green-100 text-green-800",
      mindfulness: "bg-purple-100 text-purple-800",
      productivity: "bg-blue-100 text-blue-800",
      social: "bg-orange-100 text-orange-800",
    };
    return (
      colors[category as keyof typeof colors] || "bg-gray-100 text-gray-800"
    );
  };

  const groupedBehaviors = behaviors.reduce((acc, behavior) => {
    const category = behavior.category || "other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(behavior);
    return acc;
  }, {} as Record<string, typeof behaviors>);

  return (
    <div className="max-w-6xl mx-auto px-4 py-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-light text-gray-900 mb-2">
          Daily Reflection
        </h1>
        <p className="text-gray-600">
          Your journey of growth and self-discovery
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Reflection */}
        <div className="lg:col-span-2">
          {/* Generate Button */}
          <div className="mb-4">
            <button
              onClick={handleGenerateReflection}
              disabled={generatingReflection || reflectionLoading}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generatingReflection ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Today's Reflection
                </>
              )}
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
                      fontFamily: "Georgia, Times, serif",
                      fontSize: "18px",
                      lineHeight: "1.7",
                    }}
                  >
                    {todaysReflection.content
                      .split("\n\n")
                      .map((paragraph, index) => (
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
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                        <ExternalLink className="w-5 h-5" />
                        From People 1-2 Steps Ahead
                      </h3>
                      <div className="space-y-3">
                        {todaysReflection.reddit_links.map((post, index) => (
                          <a
                            key={index}
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 group-hover:text-blue-700 line-clamp-2">
                                  {post.title}
                                </h4>
                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                  <span className="font-medium">
                                    r/{post.subreddit}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <ArrowUp className="w-3 h-3" />
                                    {post.upvotes}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <MessageCircle className="w-3 h-3" />
                                    {post.comments}
                                  </div>
                                </div>
                              </div>
                              <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0 ml-3" />
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500">
                    Generated on{" "}
                    {new Date(todaysReflection.generated_at).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No reflection yet
                </h3>
                <p className="text-gray-600 mb-6">
                  Generate your daily reflection to get personalized insights
                  based on your recent habits and notes.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Behaviors */}
        <div className="lg:col-span-1">
          <div className="sticky top-8">
            <h2 className="text-xl font-medium text-gray-900 mb-4">
              Behaviors to Consider
            </h2>

            {behaviorsLoading ? (
              <div className="animate-pulse space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            ) : behaviors.length > 0 ? (
              <div className="space-y-4">
                {Object.entries(groupedBehaviors).map(
                  ([category, categoryBehaviors]) => (
                    <div key={category}>
                      {category !== "other" && (
                        <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-3">
                          {category}
                        </h3>
                      )}
                      <div className="space-y-3">
                        {categoryBehaviors.map((behavior) => (
                          <div
                            key={behavior.id}
                            className="bg-white border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-medium text-gray-900">
                                {behavior.name}
                              </h4>
                              {behavior.category && (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                                    behavior.category
                                  )}`}
                                >
                                  <Tag className="w-3 h-3" />
                                  {behavior.category}
                                </span>
                              )}
                            </div>
                            {behavior.description && (
                              <p className="text-sm text-gray-600">
                                {behavior.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Tag className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">
                  No behaviors available. Add some behaviors to get personalized
                  suggestions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
