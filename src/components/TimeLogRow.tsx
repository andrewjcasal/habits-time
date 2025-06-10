import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreHorizontal, Edit, ArrowRight, Scissors } from "lucide-react";

interface TimeLog {
  id: string;
  activity_types: {
    id: string;
    name: string;
    is_favorite?: boolean;
  };
  start_time: string;
  end_time: string | null;
  duration?: number;
  categories?: Array<{
    id: string;
    name: string;
    color: string;
    is_favorite?: boolean;
  }>;
}

interface ActivityType {
  id: string;
  name: string;
  is_favorite?: boolean;
}

interface TimeLogRowProps {
  log: TimeLog;
  index: number;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  updating: string | null;
  splitting: string | null;
  activityTypeInput: string;
  filteredActivityTypes: ActivityType[];
  formatTime: (timeString: string) => string;
  formatDuration: (milliseconds: number) => string;
  openSplitModal: (logId: string) => void;
  startEditingActivityType: (logId: string, currentName: string) => void;
  handleActivityTypeInputChange: (value: string) => void;
  selectActivityType: (logId: string, activityTypeName: string) => void;
}

const TimeLogRow: React.FC<TimeLogRowProps> = ({
  log,
  index,
  openMenuId,
  setOpenMenuId,
  updating,
  splitting,
  activityTypeInput,
  filteredActivityTypes,
  formatTime,
  formatDuration,
  openSplitModal,
  startEditingActivityType,
  handleActivityTypeInputChange,
  selectActivityType,
}) => {
  return (
    <motion.div
      key={log.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="pl-2 pr-0.5 py-0.5 hover:bg-neutral-50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <div>
              <h4 className="font-medium text-neutral-900">
                {log.activity_types?.name}
              </h4>
              <div className="flex items-center text-sm text-neutral-600 mt-0.5 gap-0.5">
                <span className="flex items-center">
                  {formatTime(log.start_time)}
                </span>
                {log.end_time && (
                  <>
                    <ArrowRight className="h-2 w-2" />
                    <span className="flex items-center">
                      {formatTime(log.end_time)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-0.5">
          <div className="text-right">
            {log.duration ? (
              <span className="font-semibold text-neutral-900">
                {formatDuration(log.duration)}
              </span>
            ) : (
              <span className="text-warning-600 text-sm font-medium">
                In Progress
              </span>
            )}
          </div>

          {/* Hamburger Menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuId(openMenuId === log.id ? null : log.id);
              }}
              className="p-1 hover:bg-neutral-100 rounded transition-colors"
              disabled={updating === log.id}
            >
              <MoreHorizontal className="h-3 w-3 text-neutral-500" />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {openMenuId === log.id && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-neutral-200 z-50"
                  data-dropdown-menu="true"
                >
                  <div className="p-1">
                    <div className="px-2 py-1 text-xs font-medium text-neutral-600 border-b border-neutral-100 mb-1">
                      Actions
                    </div>

                    {/* Split Log Option */}
                    <button
                      onClick={() => openSplitModal(log.id)}
                      className="w-full text-left px-2 py-1 text-xs rounded hover:bg-neutral-50 transition-colors flex items-center text-neutral-900 mb-1"
                      disabled={splitting === log.id || updating === log.id}
                    >
                      <Scissors className="h-3 w-3 mr-1" />
                      {splitting === log.id ? "Splitting..." : "Split Log"}
                    </button>

                    <div className="px-2 py-1 text-xs font-medium text-neutral-600 border-b border-neutral-100 mb-1 mt-2">
                      Change Activity Type
                    </div>

                    <div className="px-2 py-1">
                      <div className="relative">
                        <input
                          type="text"
                          value={
                            openMenuId === log.id
                              ? activityTypeInput
                              : log.activity_types?.name || ""
                          }
                          onChange={(e) =>
                            handleActivityTypeInputChange(e.target.value)
                          }
                          className="w-full px-2 py-1 text-xs border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                          placeholder="Type activity name..."
                          onFocus={() => {
                            if (openMenuId === log.id) {
                              startEditingActivityType(
                                log.id,
                                log.activity_types?.name || ""
                              );
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && activityTypeInput.trim()) {
                              selectActivityType(
                                log.id,
                                activityTypeInput.trim()
                              );
                            } else if (e.key === "Escape") {
                              setOpenMenuId(null);
                            }
                          }}
                          disabled={updating === log.id || splitting === log.id}
                        />

                        {/* Suggestions dropdown */}
                        {openMenuId === log.id &&
                          filteredActivityTypes.length > 0 && (
                            <div
                              className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded shadow-lg z-10 max-h-32 overflow-y-auto"
                              data-dropdown-menu="true"
                            >
                              {filteredActivityTypes.map((activityType) => (
                                <button
                                  key={activityType.id}
                                  onClick={() =>
                                    selectActivityType(
                                      log.id,
                                      activityType.name
                                    )
                                  }
                                  className="w-full text-left px-2 py-1 text-xs hover:bg-neutral-50 transition-colors"
                                  disabled={updating === log.id}
                                >
                                  {activityType.name}
                                </button>
                              ))}
                            </div>
                          )}

                        {/* No matches found + create new option */}
                        {openMenuId === log.id &&
                          activityTypeInput.trim() &&
                          filteredActivityTypes.length === 0 && (
                            <div
                              className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded shadow-lg z-10"
                              data-dropdown-menu="true"
                            >
                              <button
                                onClick={() =>
                                  selectActivityType(
                                    log.id,
                                    activityTypeInput.trim()
                                  )
                                }
                                className="w-full text-left px-2 py-1 text-xs hover:bg-primary-50 transition-colors text-primary-700"
                                disabled={updating === log.id}
                              >
                                Create "{activityTypeInput.trim()}"
                              </button>
                            </div>
                          )}
                      </div>

                      {openMenuId === log.id && (
                        <div className="flex gap-1 mt-2">
                          <button
                            onClick={() =>
                              activityTypeInput.trim() &&
                              selectActivityType(
                                log.id,
                                activityTypeInput.trim()
                              )
                            }
                            disabled={
                              !activityTypeInput.trim() || updating === log.id
                            }
                            className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-neutral-300 transition-colors"
                          >
                            {updating === log.id ? "Updating..." : "Save"}
                          </button>
                          <button
                            onClick={() => setOpenMenuId(null)}
                            disabled={updating === log.id}
                            className="px-2 py-1 text-xs bg-neutral-100 text-neutral-700 rounded hover:bg-neutral-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TimeLogRow;
