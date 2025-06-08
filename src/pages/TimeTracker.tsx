import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Play,
  Square,
  MoreHorizontal,
  Edit,
  ArrowRight,
  Scissors,
  Copy,
  Check,
} from "lucide-react";
import { format, startOfDay, endOfDay, subDays, addDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";

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

interface CategorySummary {
  name: string;
  color: string;
  totalTime: number;
}

interface ActivityType {
  id: string;
  name: string;
  is_favorite?: boolean;
}

interface FavoriteSummary {
  id: string;
  name: string;
  type: "activity" | "category";
  totalTime: number;
  color?: string;
}

const TimeTracker = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [favoriteCategories, setFavoriteCategories] = useState<
    CategorySummary[]
  >([]);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [splitting, setSplitting] = useState<string | null>(null);
  const [splitModalLog, setSplitModalLog] = useState<TimeLog | null>(null);
  const [splitTime, setSplitTime] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // Calculate total time for the day
  const totalTime = timeLogs.reduce((acc, log) => {
    if (log.end_time) {
      const start = new Date(log.start_time);
      const end = new Date(log.end_time);
      return acc + (end.getTime() - start.getTime());
    }
    return acc;
  }, 0);

  // Calculate category summaries
  const categorySummaries = timeLogs
    .reduce((acc, log) => {
      if (log.end_time && log.categories) {
        const duration =
          new Date(log.end_time).getTime() - new Date(log.start_time).getTime();

        log.categories.forEach((category) => {
          const existing = acc.find((c) => c.name === category.name);
          if (existing) {
            existing.totalTime += duration;
          } else {
            acc.push({
              name: category.name,
              color: category.color,
              totalTime: duration,
            });
          }
        });
      }
      return acc;
    }, [] as CategorySummary[])
    .sort((a, b) => b.totalTime - a.totalTime);

  // Calculate favorite summaries (both activity types and categories)
  const favoriteSummaries = React.useMemo(() => {
    const summaries: FavoriteSummary[] = [];

    // Add favorite activity types
    timeLogs.forEach((log) => {
      if (log.end_time && log.activity_types?.is_favorite) {
        const duration =
          new Date(log.end_time).getTime() - new Date(log.start_time).getTime();
        const existing = summaries.find(
          (s) => s.id === log.activity_types.id && s.type === "activity"
        );

        if (existing) {
          existing.totalTime += duration;
        } else {
          summaries.push({
            id: log.activity_types.id,
            name: log.activity_types.name,
            type: "activity",
            totalTime: duration,
          });
        }
      }
    });

    // Add favorite categories
    timeLogs.forEach((log) => {
      if (log.end_time && log.categories) {
        const duration =
          new Date(log.end_time).getTime() - new Date(log.start_time).getTime();

        log.categories.forEach((category) => {
          if (category.is_favorite) {
            const existing = summaries.find(
              (s) => s.id === category.id && s.type === "category"
            );

            if (existing) {
              existing.totalTime += duration;
            } else {
              summaries.push({
                id: category.id,
                name: category.name,
                type: "category",
                totalTime: duration,
                color: category.color,
              });
            }
          }
        });
      }
    });

    return summaries.sort((a, b) => b.totalTime - a.totalTime);
  }, [timeLogs]);

  // Get logs for a specific category
  const getLogsForCategory = (categoryName: string) => {
    return timeLogs
      .filter((log) =>
        log.categories?.some((category) => category.name === categoryName)
      )
      .sort(
        (a, b) =>
          new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      );
  };

  // Check if category has many logs (for scroll indicator)
  const categoryHasManyLogs = (categoryName: string) => {
    return getLogsForCategory(categoryName).length > 3;
  };

  const copyToClipboard = async () => {
    const dateStr = format(selectedDate, "EEEE, MMMM d, yyyy");
    const isToday =
      format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

    let content = `# Time Tracking Report${isToday ? " (Today)" : ""}\n`;
    content += `**Date:** ${dateStr}\n\n`;

    // Summary Section
    content += `## Summary\n`;
    content += `- **Total Time Logged:** ${formatDuration(totalTime)}\n`;
    content += `- **Number of Logs:** ${timeLogs.length}\n\n`;

    // Category Breakdown
    if (categorySummaries.length > 0) {
      content += `## Time by Category\n`;
      categorySummaries.forEach((category) => {
        content += `- **${category.name}:** ${formatDuration(
          category.totalTime
        )}\n`;
      });
      content += `\n`;
    }

    // Favorites Breakdown
    if (favoriteSummaries.length > 0) {
      content += `## Favorites\n`;
      favoriteSummaries.forEach((favorite) => {
        content += `- **${favorite.name}** (${favorite.type}): ${formatDuration(
          favorite.totalTime
        )}\n`;
      });
      content += `\n`;
    }

    // Individual Logs
    if (timeLogs.length > 0) {
      content += `## Individual Logs\n`;
      timeLogs.forEach((log, index) => {
        content += `${index + 1}. **${log.activity_types?.name}**\n`;
        content += `   - Time: ${formatTime(log.start_time)}`;
        if (log.end_time) {
          content += ` → ${formatTime(log.end_time)}`;
          if (log.duration) {
            content += ` (${formatDuration(log.duration)})`;
          }
        } else {
          content += ` → *In Progress*`;
        }
        content += `\n`;

        // Add categories if available
        if (log.categories && log.categories.length > 0) {
          content += `   - Categories: ${log.categories
            .map((c) => c.name)
            .join(", ")}\n`;
        }
        content += `\n`;
      });
    }

    // Add context for ChatGPT
    content += `---\n`;
    content += `*Please analyze this time tracking data and provide insights about productivity patterns, time allocation, and suggestions for improvement.*`;

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      setError("Failed to copy to clipboard");
    }
  };

  const formatDuration = (milliseconds: number) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatTime = (timeString: string) => {
    return format(new Date(timeString), "h:mm a");
  };

  const fetchActivityTypes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("activity_types")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      setActivityTypes(data || []);
    } catch (err) {
      console.error("Error fetching activity types:", err);
    }
  };

  const updateTimeLogActivityType = async (
    timeLogId: string,
    newActivityTypeId: string
  ) => {
    if (!user) return;

    setUpdating(timeLogId);
    try {
      const { error } = await supabase
        .from("time_logs")
        .update({ activity_type_id: newActivityTypeId })
        .eq("id", timeLogId)
        .eq("user_id", user.id);

      if (error) throw error;

      // Refresh the logs
      await fetchTimeLogs();
      setOpenMenuId(null);
    } catch (err) {
      console.error("Error updating time log:", err);
      setError("Failed to update activity type");
    } finally {
      setUpdating(null);
    }
  };

  const openSplitModal = (timeLogId: string) => {
    const log = timeLogs.find((l) => l.id === timeLogId);
    if (!log || !log.end_time) {
      setError("Cannot split log without an end time");
      return;
    }

    setSplitModalLog(log);
    setOpenMenuId(null);

    // Set default split time to middle
    const startTime = new Date(log.start_time);
    const endTime = new Date(log.end_time);
    const duration = endTime.getTime() - startTime.getTime();
    const midTime = new Date(startTime.getTime() + duration / 2);

    // Format time for input field (HH:MM format)
    const timeString = format(midTime, "HH:mm");
    setSplitTime(timeString);
  };

  const splitTimeLog = async () => {
    if (!user || !splitModalLog) return;

    setSplitting(splitModalLog.id);
    try {
      const startTime = new Date(splitModalLog.start_time);
      const endTime = new Date(splitModalLog.end_time!);

      // Parse the split time and set it to the same date as start time
      const [hours, minutes] = splitTime.split(":").map(Number);
      const splitDateTime = new Date(startTime);
      splitDateTime.setHours(hours, minutes, 0, 0);

      // Validate split time is between start and end
      if (splitDateTime <= startTime || splitDateTime >= endTime) {
        setError("Split time must be between start and end time");
        return;
      }

      // Update the original log to end at split time
      const { error: updateError } = await supabase
        .from("time_logs")
        .update({ end_time: splitDateTime.toISOString() })
        .eq("id", splitModalLog.id)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      // Create a new log for the second part
      const { error: insertError } = await supabase.from("time_logs").insert([
        {
          activity_type_id: splitModalLog.activity_types.id,
          user_id: user.id,
          start_time: splitDateTime.toISOString(),
          end_time: endTime.toISOString(),
        },
      ]);

      if (insertError) throw insertError;

      // Refresh the logs and close modal
      await fetchTimeLogs();
      setSplitModalLog(null);
      setSplitTime("");
    } catch (err) {
      console.error("Error splitting time log:", err);
      setError("Failed to split time log");
    } finally {
      setSplitting(null);
    }
  };

  const fetchTimeLogs = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const startOfSelectedDay = startOfDay(selectedDate);
      const endOfSelectedDay = endOfDay(selectedDate);

      const { data, error } = await supabase
        .from("time_logs")
        .select(
          `
          *,
          activity_types (
            id,
            name,
            is_favorite,
            activity_type_categories (
              categories (
                id,
                name,
                color,
                is_favorite
              )
            )
          )
        `
        )
        .eq("user_id", user.id)
        .gte("start_time", startOfSelectedDay.toISOString())
        .lte("start_time", endOfSelectedDay.toISOString())
        .order("start_time", { ascending: false });

      if (error) {
        throw error;
      }

      // Calculate duration for completed logs and flatten categories
      const logsWithDuration =
        data?.map((log) => ({
          ...log,
          duration: log.end_time
            ? new Date(log.end_time).getTime() -
              new Date(log.start_time).getTime()
            : null,
          categories:
            log.activity_types?.activity_type_categories
              ?.map((atc: any) => atc.categories)
              .filter(Boolean) || [],
        })) || [];

      setTimeLogs(logsWithDuration);
    } catch (err) {
      console.error("Error fetching time logs:", err);
      setError("Failed to load time logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeLogs();
    fetchActivityTypes();
  }, [selectedDate, user]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  const navigateDate = (direction: "prev" | "next") => {
    setSelectedDate((prev) =>
      direction === "prev" ? subDays(prev, 1) : addDays(prev, 1)
    );
  };

  return (
    <div className="p-1 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">
          Time Tracker
        </h1>
      </div>

      {/* Date Navigation */}
      <div className="bg-white rounded-lg border border-neutral-200 p-2 mb-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateDate("prev")}
            className="hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-neutral-600" />
          </button>

          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-neutral-500" />
            <h2 className="text-sm font-semibold text-neutral-900">
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </h2>
          </div>

          <button
            onClick={() => navigateDate("next")}
            className="hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-neutral-600" />
          </button>
          {/* 
          {!isToday && (
            <button onClick={goToToday} className="btn btn-outline text-sm">
              Today
            </button>
          )} */}

          {/* Copy to Clipboard Button */}
          <button
            onClick={copyToClipboard}
            className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors flex items-center text-neutral-600 hover:text-neutral-900"
            title="Copy data for ChatGPT analysis"
          >
            {copied ? (
              <Check className="h-3 w-3 text-success-600" />
            ) : (
              <Copy className="h-3 w-3 text-blue-500" />
            )}
          </button>
        </div>

        {/* Daily Summary */}
        <div className="mt-2 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-600">Total time logged:</span>
            <span className="font-semibold text-neutral-900">
              {formatDuration(totalTime)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm text-neutral-600">Number of logs:</span>
            <span className="font-semibold text-neutral-900">
              {timeLogs.length}
            </span>
          </div>

          {/* Category and Favorites Breakdown */}
          {(categorySummaries.length > 0 || favoriteSummaries.length > 0) && (
            <div className="mt-2 pt-2 border-t border-neutral-200">
              <div className="flex flex-row gap-2">
                {/* Time by Category */}
                {categorySummaries.length > 0 && (
                  <div className="flex flex-col gap-1 w-[54%]">
                    <div className="text-xs font-medium text-neutral-700 mb-1">
                      Time by Category
                    </div>
                    <div className="space-y-1">
                      {categorySummaries.map((category) => (
                        <div key={category.name} className="relative">
                          <div
                            className="flex items-center justify-between cursor-pointer hover:bg-neutral-50 rounded transition-colors"
                            onMouseEnter={() =>
                              setHoveredCategory(category.name)
                            }
                            onMouseLeave={(e) => {
                              // Don't hide if moving to the popover
                              const relatedTarget = e.relatedTarget as Element;
                              if (
                                !relatedTarget?.closest('[data-popover="true"]')
                              ) {
                                setHoveredCategory(null);
                              }
                            }}
                          >
                            <div className="flex items-center space-x-1">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: category.color }}
                              ></div>
                              <span className="text-xs text-neutral-600 truncate">
                                {category.name}
                              </span>
                            </div>
                            <span className="text-xs font-medium text-neutral-900">
                              {formatDuration(category.totalTime)}
                            </span>
                          </div>

                          {/* Category Logs Popover */}
                          <AnimatePresence>
                            {hoveredCategory === category.name && (
                              <motion.div
                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                className="absolute top-full left-0 mt-1 z-50 w-56 bg-white rounded-lg shadow-lg border border-neutral-200 p-2"
                                style={{ zIndex: 1000 }}
                                data-popover="true"
                                onMouseEnter={() =>
                                  setHoveredCategory(category.name)
                                }
                                onMouseLeave={() => setHoveredCategory(null)}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center space-x-1">
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{
                                        backgroundColor: category.color,
                                      }}
                                    ></div>
                                    <div className="text-xs font-medium text-neutral-900">
                                      {category.name} Logs
                                    </div>
                                  </div>
                                  {categoryHasManyLogs(category.name) && (
                                    <div className="text-xs text-neutral-500">
                                      {getLogsForCategory(category.name).length}{" "}
                                      logs
                                    </div>
                                  )}
                                </div>

                                <div className="max-h-32 overflow-y-auto space-y-0.5 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent">
                                  {getLogsForCategory(category.name).map(
                                    (log) => (
                                      <div
                                        key={log.id}
                                        className="p-1.5 bg-neutral-50 rounded text-xs hover:bg-neutral-100 transition-colors"
                                      >
                                        <div className="font-medium text-neutral-900">
                                          {log.activity_types?.name}
                                        </div>
                                        <div className="flex items-center justify-between text-neutral-600 mt-0.5">
                                          <div className="flex items-center gap-0.5">
                                            <span>
                                              {formatTime(log.start_time)}
                                            </span>
                                            {log.end_time && (
                                              <>
                                                <ArrowRight className="h-2 w-2" />
                                                <span>
                                                  {formatTime(log.end_time)}
                                                </span>
                                              </>
                                            )}
                                          </div>
                                          {log.duration && (
                                            <span className="font-medium">
                                              {formatDuration(log.duration)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>

                                {/* Arrow pointing up to category */}
                                <div className="absolute bottom-full left-2">
                                  <div className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-white"></div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Favorites */}
                {favoriteSummaries.length > 0 && (
                  <div className="flex flex-col gap-1 w-[46%]">
                    <div className="text-xs font-medium text-neutral-700 mb-1">
                      Favorites
                    </div>
                    <div className="space-y-1">
                      {favoriteSummaries.map((favorite) => (
                        <div
                          key={`${favorite.type}-${favorite.id}`}
                          className="flex items-center justify-between gap-1"
                        >
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-neutral-600 truncate">
                              {favorite.name}
                            </span>
                          </div>
                          <span className="text-xs font-medium text-neutral-900">
                            {formatDuration(favorite.totalTime)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Time Logs */}
      <div className="bg-white rounded-lg border border-neutral-200">
        <div className="px-2 py-1 border-b border-neutral-200">
          <h3 className="font-semibold text-neutral-900">Time Logs</h3>
        </div>

        <div className="divide-y divide-neutral-200">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="text-neutral-600 mt-2">Loading time logs...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-error-600">{error}</p>
              <button
                onClick={fetchTimeLogs}
                className="mt-2 btn btn-outline text-sm"
              >
                Try Again
              </button>
            </div>
          ) : timeLogs.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-600">No time logs for this date</p>
              <p className="text-sm text-neutral-500 mt-1">
                Start tracking your time to see logs here
              </p>
            </div>
          ) : (
            timeLogs.map((log, index) => (
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
                          >
                            <div className="p-1">
                              <div className="px-2 py-1 text-xs font-medium text-neutral-600 border-b border-neutral-100 mb-1">
                                Actions
                              </div>

                              {/* Split Log Option */}
                              {log.end_time && (
                                <button
                                  onClick={() => openSplitModal(log.id)}
                                  className="w-full text-left px-2 py-1 text-xs rounded hover:bg-neutral-50 transition-colors flex items-center text-neutral-900 mb-1"
                                  disabled={
                                    splitting === log.id || updating === log.id
                                  }
                                >
                                  <Scissors className="h-3 w-3 mr-1" />
                                  {splitting === log.id
                                    ? "Splitting..."
                                    : "Split Log"}
                                </button>
                              )}

                              <div className="px-2 py-1 text-xs font-medium text-neutral-600 border-b border-neutral-100 mb-1 mt-2">
                                Change Activity Type
                              </div>
                              <div className="max-h-24 overflow-y-auto">
                                {activityTypes.map((activityType) => (
                                  <button
                                    key={activityType.id}
                                    onClick={() =>
                                      updateTimeLogActivityType(
                                        log.id,
                                        activityType.id
                                      )
                                    }
                                    className={`w-full text-left px-2 py-1 text-xs rounded hover:bg-neutral-50 transition-colors flex items-center ${
                                      activityType.id === log.activity_types?.id
                                        ? "bg-primary-50 text-primary-700"
                                        : "text-neutral-900"
                                    }`}
                                    disabled={
                                      updating === log.id ||
                                      splitting === log.id
                                    }
                                  >
                                    <Edit className="h-3 w-3 mr-1" />
                                    {activityType.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Split Log Modal */}
      {splitModalLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl w-full max-w-md p-4"
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                Split Time Log
              </h3>
              <div className="p-3 bg-neutral-50 rounded-lg">
                <div className="font-medium text-neutral-900">
                  {splitModalLog.activity_types?.name}
                </div>
                <div className="text-sm text-neutral-600 mt-1">
                  {formatTime(splitModalLog.start_time)} →{" "}
                  {splitModalLog.end_time && formatTime(splitModalLog.end_time)}
                  {splitModalLog.duration && (
                    <span className="ml-2 font-medium">
                      ({formatDuration(splitModalLog.duration)})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Split at time:
              </label>
              <input
                type="time"
                value={splitTime}
                onChange={(e) => setSplitTime(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                min={format(new Date(splitModalLog.start_time), "HH:mm")}
                max={
                  splitModalLog.end_time
                    ? format(new Date(splitModalLog.end_time), "HH:mm")
                    : undefined
                }
              />
              <div className="text-xs text-neutral-500 mt-1">
                Choose a time between {formatTime(splitModalLog.start_time)} and{" "}
                {splitModalLog.end_time && formatTime(splitModalLog.end_time)}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setSplitModalLog(null);
                  setSplitTime("");
                }}
                className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                disabled={splitting === splitModalLog.id}
              >
                Cancel
              </button>
              <button
                onClick={splitTimeLog}
                disabled={splitting === splitModalLog.id || !splitTime}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 rounded-lg transition-colors"
              >
                {splitting === splitModalLog.id ? "Splitting..." : "Split Log"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default TimeTracker;
