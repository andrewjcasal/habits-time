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

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const isToday =
    format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  return (
    <div className="p-2 max-w-4xl mx-auto">
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
        </div>

        {/* Daily Summary */}
        <div className="mt-2 p-2 bg-neutral-50 rounded-lg">
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
                        <div
                          key={category.name}
                          className="flex items-center justify-between"
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
                className="px-2 py-0.5 hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <div>
                        <h4 className="font-medium text-neutral-900">
                          {log.activity_types?.name}
                        </h4>
                        <div className="flex items-center space-x-1 text-sm text-neutral-600 mt-0.5">
                          <span className="flex items-center">
                            <Play className="h-2 w-2 mr-0.5" />
                            {formatTime(log.start_time)}
                          </span>
                          {log.end_time && (
                            <span className="flex items-center">
                              <Square className="h-2 w-2 mr-0.5" />
                              {formatTime(log.end_time)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
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
                                Change Activity Type
                              </div>
                              <div className="max-h-32 overflow-y-auto">
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
                                    disabled={updating === log.id}
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
    </div>
  );
};

export default TimeTracker;
