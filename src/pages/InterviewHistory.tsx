import { InterviewHistoryRow } from "../components/InterviewHistoryRow";

const InterviewHistory = () => {
  return (
    <>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            Interview History
          </h1>
          <p className="text-sm text-neutral-600">
            Review your interview experiences and preparation status
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200">
          <h3 className="text-lg font-medium text-neutral-900">
            Recent Interviews
          </h3>
          <p className="text-sm text-neutral-600 mt-1">
            Your interview history and preparation status
          </p>
        </div>

        <div className="divide-y divide-neutral-100">
          {/* Citizen Interview */}
          <InterviewHistoryRow
            company="Citizen"
            position="Senior Frontend Engineer"
            interviews={["Behavioral", "API Design", "React UI", "Technical"]}
            readinessScore={85}
          />

          {/* CoStar Interview */}
          <InterviewHistoryRow
            company="CoStar"
            position="Frontend Developer"
            interviews={["React Fundamentals", "Design Patterns"]}
            readinessScore={78}
          />

          {/* Blueprint Interview */}
          <InterviewHistoryRow
            company="Blueprint"
            position="React Developer"
            interviews={["Collaboration", "System Design"]}
            readinessScore={82}
          />
        </div>
      </div>
    </>
  );
};

export default InterviewHistory;
