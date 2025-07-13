import React, { useState, useEffect } from "react";
import {
  Calendar,
  Save,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";

interface Essential {
  id: string;
  activity_type_id: string;
  activity_type_name: string;
  daily_minutes: number;
}

interface DailyOverride {
  id: string;
  user_id: string;
  essential_id: string;
  date: string;
  minutes: number;
  created_at: string;
  updated_at: string;
}

interface DayData {
  date: Date;
  essentials: Array<{
    essential: Essential;
    override?: DailyOverride;
    currentMinutes: number;
  }>;
}

const DailyOverrides = () => {
  const { user } = useAuth();
  const [essentials, setEssentials] = useState<Essential[]>([]);
  const [overrides, setOverrides] = useState<DailyOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [editingValues, setEditingValues] = useState<{ [key: string]: number }>(
    {}
  );

  // Generate the next 5 days
  const days: DayData[] = Array.from({ length: 5 }, (_, i) => {
    const date = addDays(startDate, i);
    const dayEssentials = essentials.map((essential) => {
      const overrideKey = `${essential.id}-${format(date, "yyyy-MM-dd")}`;
      const override = overrides.find(
        (o) =>
          o.essential_id === essential.id && isSameDay(new Date(o.date), date)
      );

      return {
        essential,
        override,
        currentMinutes: override?.minutes ?? essential.daily_minutes,
      };
    });

    return {
      date,
      essentials: dayEssentials,
    };
  });

  useEffect(() => {
    if (user) {
      fetchEssentials();
      fetchOverrides();
    }
  }, [user, startDate]);

  const fetchEssentials = async () => {
    try {
      const { data, error } = await supabase
        .from("essentials")
        .select(
          `
          *,
          activity_types (name)
        `
        )
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedEssentials =
        data?.map((item) => ({
          id: item.id,
          activity_type_id: item.activity_type_id,
          activity_type_name: item.activity_types?.name || "Unknown",
          daily_minutes: item.daily_minutes,
        })) || [];

      setEssentials(formattedEssentials);
    } catch (error) {
      console.error("Error fetching essentials:", error);
    }
  };

  const fetchOverrides = async () => {
    try {
      const endDate = addDays(startDate, 4);

      const { data, error } = await supabase
        .from("habits_daily_overrides")
        .select("*")
        .eq("user_id", user?.id)
        .gte("date", format(startDate, "yyyy-MM-dd"))
        .lte("date", format(endDate, "yyyy-MM-dd"));

      if (error) throw error;
      setOverrides(data || []);
    } catch (error) {
      console.error("Error fetching overrides:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateOverride = async (
    essentialId: string,
    date: Date,
    minutes: number
  ) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const key = `${essentialId}-${dateStr}`;
    setSaving(key);

    try {
      const existingOverride = overrides.find(
        (o) =>
          o.essential_id === essentialId && isSameDay(new Date(o.date), date)
      );

      if (existingOverride) {
        // Update existing override
        const { error } = await supabase
          .from("habits_daily_overrides")
          .update({
            minutes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingOverride.id);

        if (error) throw error;

        // Update local state
        setOverrides(
          overrides.map((o) =>
            o.id === existingOverride.id ? { ...o, minutes } : o
          )
        );
      } else {
        // Create new override
        const { data, error } = await supabase
          .from("habits_daily_overrides")
          .insert({
            user_id: user?.id,
            essential_id: essentialId,
            date: dateStr,
            minutes,
          })
          .select()
          .single();

        if (error) throw error;

        // Add to local state
        setOverrides([...overrides, data]);
      }

      // Clear editing value
      delete editingValues[key];
      setEditingValues({ ...editingValues });
    } catch (error) {
      console.error("Error updating override:", error);
    } finally {
      setSaving(null);
    }
  };

  const resetToDefault = async (essentialId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const key = `${essentialId}-${dateStr}`;
    setSaving(key);

    try {
      const existingOverride = overrides.find(
        (o) =>
          o.essential_id === essentialId && isSameDay(new Date(o.date), date)
      );

      if (existingOverride) {
        // Delete the override
        const { error } = await supabase
          .from("habits_daily_overrides")
          .delete()
          .eq("id", existingOverride.id);

        if (error) throw error;

        // Remove from local state
        setOverrides(overrides.filter((o) => o.id !== existingOverride.id));
      }

      // Clear editing value
      delete editingValues[key];
      setEditingValues({ ...editingValues });
    } catch (error) {
      console.error("Error resetting override:", error);
    } finally {
      setSaving(null);
    }
  };

  const handleInputChange = (
    essentialId: string,
    date: Date,
    value: string
  ) => {
    const key = `${essentialId}-${format(date, "yyyy-MM-dd")}`;
    const minutes = parseInt(value) || 0;
    setEditingValues({
      ...editingValues,
      [key]: minutes,
    });
  };

  const getDisplayValue = (
    essentialId: string,
    date: Date,
    currentMinutes: number
  ) => {
    const key = `${essentialId}-${format(date, "yyyy-MM-dd")}`;
    return editingValues[key] !== undefined
      ? editingValues[key]
      : currentMinutes;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h${mins > 0 ? ` ${mins}m` : ""}`;
    }
    return `${mins}m`;
  };

  const navigateWeek = (direction: "prev" | "next") => {
    const newDate =
      direction === "prev" ? addDays(startDate, -7) : addDays(startDate, 7);
    setStartDate(newDate);
    setEditingValues({});
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Calendar className="w-6 h-6 text-primary-600 mr-3" />
            <h1 className="text-2xl font-bold text-neutral-900">
              Daily Overrides
            </h1>
          </div>
          <p className="text-neutral-600">
            Customize your essential time allocations for specific days. Changes
            override your default settings.
          </p>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-6 bg-white rounded-lg border border-neutral-200 p-4">
          <button
            onClick={() => navigateWeek("prev")}
            className="flex items-center px-3 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous Week
          </button>

          <h2 className="text-lg font-semibold text-neutral-900">
            {format(startDate, "MMM d")} -{" "}
            {format(addDays(startDate, 4), "MMM d, yyyy")}
          </h2>

          <button
            onClick={() => navigateWeek("next")}
            className="flex items-center px-3 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            Next Week
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>

        {essentials.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-neutral-200">
            <Calendar className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 mb-2">
              No essentials found
            </h3>
            <p className="text-neutral-600 mb-4">
              You need to create essentials first before setting daily
              overrides.
            </p>
            <a
              href="/essentials"
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Go to Essentials
            </a>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
            {/* Header Row */}
            <div className="grid grid-cols-6 gap-0 border-b border-neutral-200">
              <div className="p-4 bg-neutral-50 border-r border-neutral-200">
                <h3 className="font-semibold text-neutral-900">Essential</h3>
              </div>
              {days.map((day, index) => (
                <div
                  key={index}
                  className="p-4 bg-neutral-50 text-center border-r border-neutral-200 last:border-r-0"
                >
                  <div className="font-semibold text-neutral-900">
                    {format(day.date, "EEE")}
                  </div>
                  <div className="text-sm text-neutral-600">
                    {format(day.date, "MMM d")}
                  </div>
                </div>
              ))}
            </div>

            {/* Essential Rows */}
            {essentials.map((essential) => (
              <div
                key={essential.id}
                className="grid grid-cols-6 gap-0 border-b border-neutral-200 last:border-b-0"
              >
                <div className="p-4 border-r border-neutral-200 bg-neutral-25">
                  <div className="font-medium text-neutral-900">
                    {essential.activity_type_name}
                  </div>
                  <div className="text-sm text-neutral-600">
                    Default: {formatDuration(essential.daily_minutes)}
                  </div>
                </div>

                {days.map((day, dayIndex) => {
                  const essentialData = day.essentials.find(
                    (e) => e.essential.id === essential.id
                  );
                  if (!essentialData) return null;

                  const key = `${essential.id}-${format(
                    day.date,
                    "yyyy-MM-dd"
                  )}`;
                  const displayValue = getDisplayValue(
                    essential.id,
                    day.date,
                    essentialData.currentMinutes
                  );
                  const hasOverride = !!essentialData.override;
                  const isSavingThis = saving === key;

                  return (
                    <div
                      key={dayIndex}
                      className="p-4 border-r border-neutral-200 last:border-r-0"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="0"
                            value={displayValue}
                            onChange={(e) =>
                              handleInputChange(
                                essential.id,
                                day.date,
                                e.target.value
                              )
                            }
                            className={`w-20 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                              hasOverride
                                ? "border-primary-300 bg-primary-50"
                                : "border-neutral-300"
                            }`}
                          />
                          <span className="text-xs text-neutral-500">min</span>
                        </div>

                        <div className="flex space-x-1">
                          <button
                            onClick={() =>
                              updateOverride(
                                essential.id,
                                day.date,
                                displayValue
                              )
                            }
                            disabled={isSavingThis}
                            className="text-xs px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-neutral-300 transition-colors"
                          >
                            {isSavingThis ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                            ) : (
                              <Save className="w-3 h-3" />
                            )}
                          </button>

                          {hasOverride && (
                            <button
                              onClick={() =>
                                resetToDefault(essential.id, day.date)
                              }
                              disabled={isSavingThis}
                              className="text-xs px-2 py-1 bg-neutral-600 text-white rounded hover:bg-neutral-700 disabled:bg-neutral-300 transition-colors"
                              title="Reset to default"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {hasOverride && (
                          <div className="text-xs text-primary-600 font-medium">
                            Override
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyOverrides;
