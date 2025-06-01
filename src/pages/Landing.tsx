import { Link } from 'react-router-dom';
import { Code, Layout, Briefcase, CheckCircle } from 'lucide-react';

const Landing = () => {
  return (
    <div className="relative isolate">
      {/* Hero section */}
      <div className="relative pt-14">
        <div className="py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-6xl">
                Master Your Front-End Interview Prep
              </h1>
              <p className="mt-6 text-lg leading-8 text-neutral-600">
                Practice coding problems, prepare for system design interviews, and track your job search progress—all in one place.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link
                  to="/login"
                  className="btn btn-primary !px-8 !py-3"
                >
                  Get Started
                </Link>
              </div>
            </div>

            {/* Feature section */}
            <div className="mx-auto mt-32 max-w-7xl sm:mt-40">
              <div className="mx-auto max-w-2xl lg:text-center">
                <h2 className="text-base font-semibold leading-7 text-primary-600">
                  Everything You Need
                </h2>
                <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
                  Your All-in-One Interview Preparation Platform
                </p>
                <p className="mt-6 text-lg leading-8 text-neutral-600">
                  FrontPrep helps you prepare for technical interviews with a comprehensive set of tools and features designed specifically for front-end engineers.
                </p>
              </div>

              <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
                <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
                  <div className="flex flex-col">
                    <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-neutral-900">
                      <Code className="h-5 w-5 flex-none text-primary-600" />
                      Neetcode 150
                    </dt>
                    <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-neutral-600">
                      <p className="flex-auto">
                        Practice the most important coding interview problems with our spaced repetition system for optimal retention.
                      </p>
                      <p className="mt-6">
                        <CheckCircle className="h-5 w-5 text-primary-600 inline mr-2" />
                        150 carefully selected problems
                      </p>
                      <p className="mt-2">
                        <CheckCircle className="h-5 w-5 text-primary-600 inline mr-2" />
                        Smart review scheduling
                      </p>
                      <p className="mt-2">
                        <CheckCircle className="h-5 w-5 text-primary-600 inline mr-2" />
                        Progress tracking
                      </p>
                    </dd>
                  </div>

                  <div className="flex flex-col">
                    <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-neutral-900">
                      <Layout className="h-5 w-5 flex-none text-secondary-600" />
                      Interview Practice
                    </dt>
                    <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-neutral-600">
                      <p className="flex-auto">
                        Practice technical interviews with our AI interviewer. Get feedback on your communication and problem-solving skills.
                      </p>
                      <p className="mt-6">
                        <CheckCircle className="h-5 w-5 text-secondary-600 inline mr-2" />
                        Coding interviews
                      </p>
                      <p className="mt-2">
                        <CheckCircle className="h-5 w-5 text-secondary-600 inline mr-2" />
                        System design interviews
                      </p>
                      <p className="mt-2">
                        <CheckCircle className="h-5 w-5 text-secondary-600 inline mr-2" />
                        API design interviews
                      </p>
                    </dd>
                  </div>

                  <div className="flex flex-col">
                    <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-neutral-900">
                      <Briefcase className="h-5 w-5 flex-none text-accent-600" />
                      Job Search Tracker
                    </dt>
                    <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-neutral-600">
                      <p className="flex-auto">
                        Keep track of your job applications, interviews, and networking contacts all in one place.
                      </p>
                      <p className="mt-6">
                        <CheckCircle className="h-5 w-5 text-accent-600 inline mr-2" />
                        Application tracking
                      </p>
                      <p className="mt-2">
                        <CheckCircle className="h-5 w-5 text-accent-600 inline mr-2" />
                        Contact management
                      </p>
                      <p className="mt-2">
                        <CheckCircle className="h-5 w-5 text-accent-600 inline mr-2" />
                        Progress analytics
                      </p>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;