import { useState, useEffect } from 'react';
import { supabase, Habit, HabitDailyLog, HabitWithType } from '../lib/supabase';
import { useAuth } from './useAuth';

export function useHabits() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<HabitWithType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHabits = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Use local date instead of UTC date
      const now = new Date();
      const today = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      console.log('Fetching habits for user:', user.id, 'local date:', today, 'UTC would be:', new Date().toISOString().split('T')[0]);

      // Check if we should auto-uncheck habits based on sleep start time
      await checkAndResetHabitsAfterSleep();

      // First, let's check what habits exist for this user
      const { data: allHabits, error: allError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id);
      
      console.log('All habits for user:', allHabits);

      // Also check visible habits
      const { data: visibleHabits, error: visibleError } = await supabase
        .from('habits')
        .select('*')
        .eq('is_visible', true);
      
      console.log('All visible habits:', visibleHabits);

      // Get the most recent sleep start time
      const { data: recentSleep } = await supabase
        .from('habits_time_logs')
        .select('start_time')
        .eq('user_id', user.id)
        .eq('activity_type_id', '951bc26a-a863-4996-8a02-f4da2d148aa9') // sleep activity type
        .order('start_time', { ascending: false })
        .limit(1)
        .single();

      let sleepStartTime: string | null = null;
      if (recentSleep?.start_time) {
        const sleepDate = new Date(recentSleep.start_time);
        sleepStartTime = sleepDate.toTimeString().split(' ')[0]; // Get HH:MM:SS format
        console.log('Most recent sleep start time:', sleepStartTime);
      }

      console.log('sleep start', sleepStartTime)
      
      // Build the query - show all habits but filter daily logs by sleep time
      let query = supabase
        .from('habits')
        .select(`
          *,
          habits_types (*),
          habits_daily_logs!left (
            *
          )
        `)
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .eq('is_visible', true)
        .eq('habits_daily_logs.log_date', today); // Only today's logs for checked status

      // Add sleep time filter to habits_daily_logs if we have a recent sleep time
      if (sleepStartTime) {
        query = query.gte('habits_daily_logs.created_at', new Date(today + 'T' + sleepStartTime).toISOString());
      }

      const { data, error } = await query.order('current_start_time', { ascending: true });

      console.log('Habits with today\'s logs only:', JSON.stringify(data, null, 2));

      console.log('Habits query result:', { data, error });

      if (error) throw error;

      setHabits(data || []);
    } catch (err) {
      console.error('Error fetching habits:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const logHabitCompletion = async (
    habitId: string, 
    isCompleted: boolean,
    actualStartTime?: string,
    actualEndTime?: string,
    notes?: string
  ) => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const habit = habits.find(h => h.id === habitId);
      
      const logData = {
        habit_id: habitId,
        user_id: user.id,
        log_date: today,
        scheduled_start_time: habit?.current_start_time,
        actual_start_time: actualStartTime,
        actual_end_time: actualEndTime,
        is_completed: isCompleted,
        notes: notes,
      };

      const { error } = await supabase
        .from('habits_daily_logs')
        .upsert(logData, {
          onConflict: 'habit_id,user_id,log_date'
        });

      if (error) throw error;

      // Update local state
      setHabits(prevHabits => 
        prevHabits.map(habit => {
          if (habit.id === habitId) {
            const existingLog = habit.habits_daily_logs?.[0];
            const updatedLog = {
              ...existingLog,
              ...logData,
              id: existingLog?.id || '',
              created_at: existingLog?.created_at || new Date().toISOString(),
            };
            
            return {
              ...habit,
              habits_daily_logs: [updatedLog]
            };
          }
          return habit;
        })
      );

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log habit');
    }
  };

  const updateHabitStartTime = async (habitId: string, newTime: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('habits')
        .update({ current_start_time: newTime })
        .eq('id', habitId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setHabits(prevHabits =>
        prevHabits.map(habit =>
          habit.id === habitId 
            ? { ...habit, current_start_time: newTime }
            : habit
        )
      );

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update habit time');
    }
  };

  const updateHabitStartTimes = async () => {
    if (!user) return;

    try {
      const { error } = await supabase.rpc('update_habit_start_times', {
        p_user_id: user.id
      });

      if (error) throw error;

      // Refresh habits to get updated times
      await fetchHabits();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update habit times');
    }
  };

  const checkAndResetHabitsAfterSleep = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get the most recent sleep log
      const { data: sleepLog, error: sleepError } = await supabase
        .from('habits_time_logs')
        .select('start_time, end_time')
        .eq('user_id', user.id)
        .eq('activity_type_id', '951bc26a-a863-4996-8a02-f4da2d148aa9')
        .order('start_time', { ascending: false })
        .limit(1)
        .single();

      // Only reset if we found a sleep log AND it has ended (indicating wake up)
      if (sleepError || !sleepLog || !sleepLog.end_time) {
        console.log('No completed sleep cycle found, not resetting habits');
        return;
      }

      const sleepStartTime = new Date(sleepLog.start_time);
      const sleepEndTime = new Date(sleepLog.end_time);
      const now = new Date();
      
      console.log('Sleep cycle:', sleepStartTime, 'to', sleepEndTime, 'Current time:', now);
      
      // Only reset habits if we've woken up from sleep (past end_time)
      // AND the sleep was from today (started after midnight today)
      const todayStart = new Date(today + 'T00:00:00Z');
      
      if (now > sleepEndTime && sleepStartTime >= todayStart) {
        console.log('Woken up from today\'s sleep, resetting habits');
        // Reset all habit completions for today
        const { error: resetError } = await supabase
          .from('habits_daily_logs')
          .update({ is_completed: false })
          .eq('user_id', user.id)
          .eq('log_date', today);

        if (resetError) {
          console.error('Error resetting habits after sleep:', resetError);
        }
      } else {
        console.log('Still in sleep cycle or sleep was from yesterday, keeping habits as-is');
      }
    } catch (err) {
      console.error('Error checking sleep status:', err);
    }
  };

  useEffect(() => {
    fetchHabits();
  }, [user]);

  return {
    habits,
    loading,
    error,
    logHabitCompletion,
    updateHabitStartTime,
    updateHabitStartTimes,
    refetch: fetchHabits,
  };
}