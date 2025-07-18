import { Link } from 'react-router-dom'
import {
  Heart,
  Bot,
  MessageCircle,
  TrendingUp,
  Sparkles,
  Calendar,
  BarChart3,
  BookOpen,
  Users,
  ArrowRight,
} from 'lucide-react'

const Landing = () => {
  return (
    <div className="relative isolate bg-white">
      {/* Hero section */}
      <div className="relative pt-14">
        <div className="py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-6xl">
                Transform Your Daily Habits with{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                  AI-Powered
                </span>{' '}
                Insights
              </h1>
              <p className="mt-6 text-lg leading-8 text-neutral-600 max-w-2xl mx-auto">
                Track your habits, capture daily notes, and get personalized AI-generated
                reflections with curated Reddit insights to fuel your personal growth journey.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link
                  to="/login"
                  className="rounded-md bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:from-blue-500 hover:to-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all duration-200"
                >
                  Start Your Journey
                  <ArrowRight className="ml-2 w-4 h-4 inline" />
                </Link>
                <a
                  href="#features"
                  className="text-sm font-semibold leading-6 text-neutral-900 hover:text-blue-600 transition-colors"
                >
                  Learn more <span aria-hidden="true">→</span>
                </a>
              </div>
            </div>

            {/* Visual Demo */}
            <div className="mt-16 flow-root sm:mt-24">
              <div className="relative rounded-xl bg-neutral-900/5 p-2 ring-1 ring-inset ring-neutral-900/10 lg:rounded-2xl lg:p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Habit Tracking Demo */}
                  <div className="bg-white rounded-lg p-4 shadow-sm border">
                    <div className="flex items-center mb-3">
                      <Heart className="w-5 h-5 text-red-500 mr-2" />
                      <span className="font-medium text-sm">Today's Habits</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-600">Morning Exercise</span>
                        <div className="w-4 h-4 bg-green-500 rounded"></div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-600">Read 30 mins</span>
                        <div className="w-4 h-4 bg-green-500 rounded"></div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-600">Meditation</span>
                        <div className="w-4 h-4 bg-neutral-200 rounded"></div>
                      </div>
                    </div>
                  </div>

                  {/* AI Reflection Demo */}
                  <div className="bg-white rounded-lg p-4 shadow-sm border">
                    <div className="flex items-center mb-3">
                      <Bot className="w-5 h-5 text-blue-500 mr-2" />
                      <span className="font-medium text-sm">AI Reflection</span>
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      "Your consistency with morning exercise this week shows strong commitment.
                      Consider adding a short meditation practice..."
                    </p>
                    <div className="mt-2 text-xs text-blue-600">Generated from your habits</div>
                  </div>

                  {/* Reddit Insights Demo */}
                  <div className="bg-white rounded-lg p-4 shadow-sm border">
                    <div className="flex items-center mb-3">
                      <MessageCircle className="w-5 h-5 text-orange-500 mr-2" />
                      <span className="font-medium text-sm">Reddit Insights</span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-neutral-600">r/getmotivated</div>
                      <div className="text-xs font-medium">"Small habits, big changes"</div>
                      <div className="text-xs text-orange-600">1.2k upvotes</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features section */}
      <div id="features" className="py-24 sm:py-32 bg-neutral-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-blue-600">Powerful Features</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              Everything you need for meaningful habit transformation
            </p>
            <p className="mt-6 text-lg leading-8 text-neutral-600">
              Our platform combines habit tracking, AI insights, and community wisdom to create a
              comprehensive personal growth experience.
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              {/* Smart Habit Tracking */}
              <div className="flex flex-col bg-white rounded-xl p-6 shadow-sm border">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-neutral-900">
                  <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-2 rounded-lg">
                    <Heart className="h-5 w-5 text-white" />
                  </div>
                  Smart Habit Tracking
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-neutral-600">
                  <p className="flex-auto">
                    Track your daily habits with an intuitive interface. Build streaks, visualize
                    progress, and stay motivated with smart notifications.
                  </p>
                  <div className="mt-6 space-y-2">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-green-600 mr-2" />
                      <span className="text-sm">Daily habit logging</span>
                    </div>
                    <div className="flex items-center">
                      <BarChart3 className="h-4 w-4 text-green-600 mr-2" />
                      <span className="text-sm">Progress visualization</span>
                    </div>
                    <div className="flex items-center">
                      <TrendingUp className="h-4 w-4 text-green-600 mr-2" />
                      <span className="text-sm">Streak tracking</span>
                    </div>
                  </div>
                </dd>
              </div>

              {/* AI-Powered Reflections */}
              <div className="flex flex-col bg-white rounded-xl p-6 shadow-sm border">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-neutral-900">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-lg">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  AI-Powered Reflections
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-neutral-600">
                  <p className="flex-auto">
                    Get personalized daily reflections generated from your habit data, notes, and
                    patterns. Discover insights you might have missed.
                  </p>
                  <div className="mt-6 space-y-2">
                    <div className="flex items-center">
                      <Sparkles className="h-4 w-4 text-blue-600 mr-2" />
                      <span className="text-sm">Personalized insights</span>
                    </div>
                    <div className="flex items-center">
                      <BookOpen className="h-4 w-4 text-blue-600 mr-2" />
                      <span className="text-sm">Pattern recognition</span>
                    </div>
                    <div className="flex items-center">
                      <TrendingUp className="h-4 w-4 text-blue-600 mr-2" />
                      <span className="text-sm">Growth recommendations</span>
                    </div>
                  </div>
                </dd>
              </div>

              {/* Community Wisdom */}
              <div className="flex flex-col bg-white rounded-xl p-6 shadow-sm border">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-neutral-900">
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 p-2 rounded-lg">
                    <MessageCircle className="h-5 w-5 text-white" />
                  </div>
                  Community Wisdom
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-neutral-600">
                  <p className="flex-auto">
                    Your AI reflections include curated Reddit posts and community insights related
                    to your habits and goals for extra motivation and tips.
                  </p>
                  <div className="mt-6 space-y-2">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 text-orange-600 mr-2" />
                      <span className="text-sm">Curated Reddit posts</span>
                    </div>
                    <div className="flex items-center">
                      <MessageCircle className="h-4 w-4 text-orange-600 mr-2" />
                      <span className="text-sm">Community tips</span>
                    </div>
                    <div className="flex items-center">
                      <Sparkles className="h-4 w-4 text-orange-600 mr-2" />
                      <span className="text-sm">Motivational content</span>
                    </div>
                  </div>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* CTA section */}
      <div className="bg-white">
        <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              Ready to transform your habits?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-neutral-600">
              Join thousands of people using AI-powered insights to build better habits and create
              lasting positive change in their lives.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                to="/login"
                className="rounded-md bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:from-blue-500 hover:to-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all duration-200"
              >
                Get started for free
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Landing
