import { Link } from 'react-router-dom'
import {
  Heart,
  Crown,
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
                Master Your Time with{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                  Smart Calendar
                </span>{' '}
                Scheduling
              </h1>
              <p className="mt-6 text-lg leading-8 text-neutral-600 max-w-2xl mx-auto">
                Intelligently schedule habits, tasks, and meetings in one unified calendar. Track
                billable hours, avoid conflicts, and get AI-powered insights to optimize your daily
                routine.
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
                  {/* Smart Calendar Demo */}
                  <div className="bg-white rounded-lg p-4 shadow-sm border">
                    <div className="flex items-center mb-3">
                      <Calendar className="w-5 h-5 text-blue-500 mr-2" />
                      <span className="font-medium text-sm">Smart Calendar</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-blue-600 font-medium">9:00 AM</span>
                        <span className="bg-blue-100 px-2 py-1 rounded text-blue-800">
                          Morning Exercise
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-purple-600 font-medium">10:00 AM</span>
                        <span className="bg-purple-100 px-2 py-1 rounded text-purple-800">
                          Client Work
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-yellow-600 font-medium">2:00 PM</span>
                        <span className="bg-yellow-100 px-2 py-1 rounded text-yellow-800">
                          Auto-scheduled Task
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-red-600 font-medium">3:30 PM</span>
                        <span className="bg-red-100 px-2 py-1 rounded text-red-800">
                          Team Meeting
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Intelligent Scheduling Demo */}
                  <div className="bg-white rounded-lg p-4 shadow-sm border">
                    <div className="flex items-center mb-3">
                      <Crown className="w-5 h-5 text-green-500 mr-2" />
                      <span className="font-medium text-sm">Smart Scheduling</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-600">Conflict Detection</span>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-600">Auto-rescheduling</span>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-600">Weekend Awareness</span>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-green-600">AI optimizes your schedule</div>
                  </div>

                  {/* Work Tracking Demo */}
                  <div className="bg-white rounded-lg p-4 shadow-sm border">
                    <div className="flex items-center mb-3">
                      <TrendingUp className="w-5 h-5 text-purple-500 mr-2" />
                      <span className="font-medium text-sm">Work Tracking</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-600">Billable Hours</span>
                        <span className="font-medium text-green-600">32/40h</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-600">Revenue Target</span>
                        <span className="font-medium text-purple-600">$2,080</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-600">This Week</span>
                        <span className="text-xs bg-green-100 px-2 py-1 rounded text-green-800">
                          On Track
                        </span>
                      </div>
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
              Everything you need for intelligent time management
            </p>
            <p className="mt-6 text-lg leading-8 text-neutral-600">
              Our platform combines smart calendar scheduling, habit tracking, and work management
              to create a comprehensive productivity system that adapts to your lifestyle.
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              {/* Unified Calendar System */}
              <div className="flex flex-col bg-white rounded-xl p-6 shadow-sm border">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-neutral-900">
                  <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-2 rounded-lg">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  Unified Calendar System
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-neutral-600">
                  <p className="flex-auto">
                    See all your habits, tasks, meetings, and work sessions in one intelligent
                    calendar view. Auto-scheduling prevents conflicts and maximizes your productive
                    time.
                  </p>
                  <div className="mt-6 space-y-2">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-blue-600 mr-2" />
                      <span className="text-sm">Multi-event type display</span>
                    </div>
                    <div className="flex items-center">
                      <Crown className="h-4 w-4 text-blue-600 mr-2" />
                      <span className="text-sm">Smart conflict resolution</span>
                    </div>
                    <div className="flex items-center">
                      <TrendingUp className="h-4 w-4 text-blue-600 mr-2" />
                      <span className="text-sm">Real-time scheduling</span>
                    </div>
                  </div>
                </dd>
              </div>

              {/* Intelligent Task Scheduling */}
              <div className="flex flex-col bg-white rounded-xl p-6 shadow-sm border">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-neutral-900">
                  <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-2 rounded-lg">
                    <Crown className="h-5 w-5 text-white" />
                  </div>
                  Intelligent Task Scheduling
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-neutral-600">
                  <p className="flex-auto">
                    AI automatically schedules your project tasks around habits and meetings.
                    Respects work hours, weekends, and generates billable work placeholders to meet
                    revenue targets.
                  </p>
                  <div className="mt-6 space-y-2">
                    <div className="flex items-center">
                      <Sparkles className="h-4 w-4 text-orange-600 mr-2" />
                      <span className="text-sm">Auto-task placement</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-orange-600 mr-2" />
                      <span className="text-sm">Weekend & work hour awareness</span>
                    </div>
                    <div className="flex items-center">
                      <TrendingUp className="h-4 w-4 text-orange-600 mr-2" />
                      <span className="text-sm">Revenue target tracking</span>
                    </div>
                  </div>
                </dd>
              </div>

              {/* Advanced Habit Management */}
              <div className="flex flex-col bg-white rounded-xl p-6 shadow-sm border">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-neutral-900">
                  <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-2 rounded-lg">
                    <Heart className="h-5 w-5 text-white" />
                  </div>
                  Advanced Habit Management
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-neutral-600">
                  <p className="flex-auto">
                    Smart habit scheduling with pull-back timing, conflict avoidance, and flexible
                    duration management. Skip, reschedule, or adjust habits without breaking your
                    routine.
                  </p>
                  <div className="mt-6 space-y-2">
                    <div className="flex items-center">
                      <Heart className="h-4 w-4 text-green-600 mr-2" />
                      <span className="text-sm">Pull-back scheduling (15min earlier daily)</span>
                    </div>
                    <div className="flex items-center">
                      <BarChart3 className="h-4 w-4 text-green-600 mr-2" />
                      <span className="text-sm">Skip & reschedule options</span>
                    </div>
                    <div className="flex items-center">
                      <TrendingUp className="h-4 w-4 text-green-600 mr-2" />
                      <span className="text-sm">Duration & time overrides</span>
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
              Ready to master your time?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-neutral-600">
              Join professionals and productivity enthusiasts using smart calendar scheduling to
              optimize their daily routines, track billable work, and achieve their goals with
              AI-powered time management.
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
