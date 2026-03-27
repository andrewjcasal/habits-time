import { Link } from 'react-router-dom'
import { Calendar, Heart, TrendingUp, ArrowRight } from 'lucide-react'
import { posthog } from '../lib/posthog'

const Landing = () => {
  const trackVideoEngagement = () => {
    posthog?.capture('demo_video_engaged', {
      video_type: 'loom',
      video_title: 'Cassian Product Demo',
      location: 'landing_page',
    })
  }

  return (
    <div style={{ backgroundColor: '#FDFBF7', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 lg:px-8 pt-24 pb-20">
        <div className="max-w-3xl">
          <p className="text-sm font-medium tracking-widest uppercase text-amber-700 mb-6">
            For solo workers with chaotic days
          </p>
          <h1
            className="text-5xl sm:text-7xl leading-[1.05] tracking-tight text-neutral-900 mb-8"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            Your calendar wasn't built for the way you actually work.
          </h1>
          <p className="text-lg text-neutral-500 leading-relaxed max-w-xl mb-10">
            A flexible, self-correcting planner that adjusts when life derails.
            Habits, tasks, and meetings in one view that adapts to your energy.
          </p>
          <div className="flex items-center gap-5">
            <Link
              to="/sign-up"
              className="inline-flex items-center px-6 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-full hover:bg-neutral-800 transition-colors"
            >
              Start for free
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              Sign in <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Video */}
      <section id="demo" className="max-w-5xl mx-auto px-6 lg:px-8 pb-24">
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid #E8E2D9' }}
        >
          <div className="p-6 pb-4">
            <p className="text-xs font-medium tracking-widest uppercase text-neutral-400 mb-1">
              Product Tour
            </p>
            <h3
              className="text-xl text-neutral-900"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              See Cassian in action
            </h3>
          </div>
          <div
            className="relative w-full"
            style={{ paddingBottom: '56.25%' }}
            onMouseEnter={trackVideoEngagement}
          >
            <iframe
              src="https://www.loom.com/embed/f48837fc769a4e78bae9e738fef5af56?sid=813c9e15-160a-4823-9801-5634649a0b15"
              frameBorder="0"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
              title="Cassian App Demo"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24" style={{ backgroundColor: '#F7F4EE' }}>
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <p className="text-sm font-medium tracking-widest uppercase text-amber-700 mb-4">
            How it works
          </p>
          <h2
            className="text-3xl sm:text-4xl tracking-tight text-neutral-900 mb-16 max-w-lg"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            Three systems, one calm view.
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Calendar,
                title: 'Unified Calendar',
                description:
                  'Habits, tasks, meetings, and work sessions in one intelligent view. Auto-scheduling prevents conflicts and maximizes your time.',
                color: 'text-amber-700',
                bg: 'bg-amber-50',
              },
              {
                icon: TrendingUp,
                title: 'Smart Scheduling',
                description:
                  'Tasks auto-place around your habits and meetings. Respects work hours, weekends, and adapts when plans change.',
                color: 'text-neutral-700',
                bg: 'bg-neutral-100',
              },
              {
                icon: Heart,
                title: 'Habit Routines',
                description:
                  'Flexible habit timing with pull-back scheduling, skip & reschedule options, and a built-in routine timer for sequenced steps.',
                color: 'text-rose-700',
                bg: 'bg-rose-50',
              },
            ].map((feature) => {
              const Icon = feature.icon
              return (
                <div key={feature.title} className="group">
                  <div className={`w-10 h-10 rounded-xl ${feature.bg} flex items-center justify-center mb-5`}>
                    <Icon className={`w-5 h-5 ${feature.color}`} />
                  </div>
                  <h3
                    className="text-lg text-neutral-900 mb-3"
                    style={{ fontFamily: "'DM Serif Display', serif" }}
                  >
                    {feature.title}
                  </h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 text-center">
          <h2
            className="text-3xl sm:text-5xl tracking-tight text-neutral-900 mb-6"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            Ready to take your time back?
          </h2>
          <p className="text-lg text-neutral-500 max-w-md mx-auto mb-10">
            Join people who stopped fighting their calendar and started working with it.
          </p>
          <div className="flex items-center justify-center gap-5">
            <Link
              to="/sign-up"
              className="inline-flex items-center px-6 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-full hover:bg-neutral-800 transition-colors"
            >
              Get started free
            </Link>
            <Link
              to="/login"
              className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t" style={{ borderColor: '#E8E2D9' }}>
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <p className="text-xs text-neutral-400 text-center">
            Cassian
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Landing
