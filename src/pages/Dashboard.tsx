import {
  ArrowRight,
  BookOpen,
  Code,
  Clock,
  Calendar,
  Target,
  Users,
  TrendingUp,
  Layout,
  Briefcase,
  Heart,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

// Components
import { Stat } from "../components/Stat";
import { ProgressRing } from "../components/ProgressRing";

const Dashboard = () => {
  const [stats, setStats] = useState({
    problemsSolved: 0,
    streak: 0,
    interviewsCompleted: 0,
    applicationsSent: 0,
  });

  const [recentActivity, setRecentActivity] = useState<
    Array<{
      type: string;
      title: string;
      timestamp: number;
    }>
  >([]);

  // Fetch stats and activity from localStorage
  useEffect(() => {
    // Get Neetcode progress
    const neetcodeData = localStorage.getItem("neetcode-progress");
    const problems = neetcodeData ? JSON.parse(neetcodeData) : [];
    const problemsSolved = problems.filter((p: any) => p.completed).length;

    // Get streak
    const streakData = localStorage.getItem("streak-data");
    const streak = streakData ? JSON.parse(streakData).currentStreak : 0;

    // Get interview count
    const interviewHistory = localStorage.getItem("interview-history");
    const interviews = interviewHistory ? JSON.parse(interviewHistory) : [];
    const interviewsCompleted = interviews.length;

    // Get application count
    const jobApplications = localStorage.getItem("job-applications");
    const applications = jobApplications ? JSON.parse(jobApplications) : [];
    const applicationsSent = applications.length;

    // Set stats
    setStats({
      problemsSolved,
      streak,
      interviewsCompleted,
      applicationsSent,
    });

    // Get recent activity
    const activity = [
      ...problems
        .filter((p: any) => p.lastAttempted)
        .map((p: any) => ({
          type: "problem",
          title: p.title,
          timestamp: p.lastAttempted,
        })),
      ...interviews.map((i: any) => ({
        type: "interview",
        title: i.title,
        timestamp: i.date,
      })),
      ...applications
        .filter((a: any) => a.dateApplied)
        .map((a: any) => ({
          type: "application",
          title: a.company,
          timestamp: a.dateApplied,
        })),
    ];

    // Sort by timestamp (most recent first) and take the 5 most recent
    const sortedActivity = activity
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);

    setRecentActivity(sortedActivity);
  }, []);

  // Calculate Neetcode 150 progress
  const neetcodeProgress = Math.round((stats.problemsSolved / 150) * 100);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          title="Neetcode Problems"
          value={`${stats.problemsSolved}/150`}
          icon={BookOpen}
          href="/spaced-rep"
          trend={`${neetcodeProgress}% complete`}
        />

        <Stat
          title="Current Streak"
          value={`${stats.streak} days`}
          icon={Clock}
          trend={stats.streak > 0 ? "Keep it up!" : "Start today!"}
        />

        <Stat
          title="Interviews Completed"
          value={stats.interviewsCompleted.toString()}
          icon={Users}
          href="/interview-prep"
          trend={
            stats.interviewsCompleted > 0 ? `Last: 2 days ago` : "Practice now!"
          }
        />

        <Stat
          title="Applications Sent"
          value={stats.applicationsSent.toString()}
          icon={Target}
          href="/job-tracker"
          trend={`${Math.round(stats.applicationsSent * 0.15)} responses`}
        />
      </div>

      {/* Modules Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        <Link
          to="/spaced-rep"
          className="card bg-white hover:shadow-lg transition-shadow group"
        >
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
              <Code className="w-6 h-6 text-primary-600" />
            </div>
            <h3 className="ml-4 font-medium text-lg">Neetcode 150</h3>
          </div>
          <p className="text-neutral-600 mb-4">
            Practice coding interview problems with spaced repetition to
            maximize retention.
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <ProgressRing
                progress={neetcodeProgress}
                size={36}
                strokeWidth={3}
                color="#3B82F6"
              />
              <span className="ml-2 text-sm text-neutral-600">
                {neetcodeProgress}% complete
              </span>
            </div>
            <span className="text-primary-600 group-hover:translate-x-0.5 transition-transform flex items-center">
              Continue <ArrowRight className="ml-1 w-4 h-4" />
            </span>
          </div>
        </Link>

        <Link
          to="/interview-prep"
          className="card bg-white hover:shadow-lg transition-shadow group"
        >
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 rounded-full bg-secondary-100 flex items-center justify-center">
              <Layout className="w-6 h-6 text-secondary-600" />
            </div>
            <h3 className="ml-4 font-medium text-lg">Interview Prep</h3>
          </div>
          <p className="text-neutral-600 mb-4">
            Personalized interview preparation based on job posts. Practice with
            an AI interviewer.
          </p>
          <div className="mt-auto flex justify-end">
            <span className="text-secondary-600 group-hover:translate-x-0.5 transition-transform flex items-center">
              Get started <ArrowRight className="ml-1 w-4 h-4" />
            </span>
          </div>
        </Link>

        <Link
          to="/job-tracker"
          className="card bg-white hover:shadow-lg transition-shadow group"
        >
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 rounded-full bg-accent-100 flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-accent-600" />
            </div>
            <h3 className="ml-4 font-medium text-lg">Job Tracker</h3>
          </div>
          <p className="text-neutral-600 mb-4">
            Track applications and networking contacts. Stay organized in your
            job search.
          </p>
          <div className="mt-auto flex justify-end">
            <span className="text-accent-600 group-hover:translate-x-0.5 transition-transform flex items-center">
              View tracker <ArrowRight className="ml-1 w-4 h-4" />
            </span>
          </div>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="card bg-white mt-6">
        <div className="flex items-center mb-4">
          <h3 className="font-medium text-lg">Recent Activity</h3>
          <TrendingUp className="ml-2 w-4 h-4 text-success-500" />
        </div>

        {recentActivity.length > 0 ? (
          <ul className="space-y-3">
            {recentActivity.map((activity, index) => (
              <li
                key={index}
                className="flex items-center justify-between p-3 rounded-md hover:bg-neutral-50"
              >
                <div className="flex items-center">
                  <span
                    className={`w-2 h-2 rounded-full mr-3 ${
                      activity.type === "problem"
                        ? "bg-primary-500"
                        : activity.type === "interview"
                        ? "bg-secondary-500"
                        : "bg-accent-500"
                    }`}
                  />
                  <div>
                    <p className="font-medium">{activity.title}</p>
                    <p className="text-sm text-neutral-500">
                      {activity.type === "problem"
                        ? "Solved problem"
                        : activity.type === "interview"
                        ? "Completed interview"
                        : "Applied to company"}
                    </p>
                  </div>
                </div>
                <span className="text-sm text-neutral-500">
                  {formatDistanceToNow(new Date(activity.timestamp), {
                    addSuffix: true,
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-6 text-neutral-500">
            <p>
              No recent activity yet. Start using the app to track your
              progress!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
