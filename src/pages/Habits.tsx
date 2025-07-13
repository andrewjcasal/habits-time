import { useState, useEffect } from "react";
import { Clock, Play, CheckCircle2, Circle, RefreshCw } from "lucide-react";
import { useHabits } from "../hooks/useHabits";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

const Habits = () => {
  const { user } = useAuth();
  const { 
    habits, 
    loading, 
    error, 
    logHabitCompletion, 
    updateHabitStartTime,
    updateHabitStartTimes 
  } = useHabits();

  const [editingHabit, setEditingHabit] = useState<string | null>(null);
  const [tempTime, setTempTime] = useState("");
  const [routineLogs, setRoutineLogs] = useState<any[]>([]);

  const toggleCompletion = async (habitId: string) => {
    const habit = habits.find(h => h.id === habitId);
    const currentLog = habit?.habits_daily_logs?.[0];
    const newCompletionState = !currentLog?.is_completed;
    
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    
    await logHabitCompletion(
      habitId, 
      newCompletionState,
      newCompletionState ? currentTime : undefined,
      newCompletionState ? currentTime : undefined
    );
  };

  const updateTime = async (habitId: string, newTime: string) => {
    await updateHabitStartTime(habitId, newTime);
    setEditingHabit(null);
  };

  const formatTime = (time: string | null) => {
    if (!time) return '9:00 AM';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const fetchRoutineLogs = async () => {
    if (!user) return;

    try {
      // Get sleep logs to determine day boundaries
      const { data: sleepLogs, error: sleepError } = await supabase
        .from('habits_time_logs')
        .select('start_time')
        .eq('user_id', user.id)
        .eq('activity_type_id', '951bc26a-a863-4996-8a02-f4da2d148aa9')
        .order('start_time', { ascending: false })
        .limit(10);

      if (sleepError) throw sleepError;

      // Get routine logs from the last 14 days to account for sleep boundaries
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 14);
      const endDate = new Date();
      
      const { data, error } = await supabase
        .from('habits_daily_logs')
        .select(`
          log_date,
          actual_start_time,
          actual_end_time,
          created_at,
          habits!inner (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .gte('log_date', startDate.toISOString().split('T')[0])
        .lte('log_date', endDate.toISOString().split('T')[0])
        .in('habits.id', ['ad94f045-1f1f-49c6-aef1-578d0013cf9e', '0edf2ca9-b14f-451f-9043-e13cb8daf684'])
        .order('log_date', { ascending: false });

      if (error) throw error;

      // Group logs by sleep cycles instead of calendar days
      const groupedLogs = [];
      const sleepBoundaries = sleepLogs?.map(log => new Date(log.start_time)) || [];
      
      for (let i = 0; i < 7; i++) {
        const currentSleep = sleepBoundaries[i];
        const previousSleep = sleepBoundaries[i + 1];
        
        if (!currentSleep) continue;
        
        // Find logs that occurred between previous sleep and current sleep
        const dayLogs = data?.filter(log => {
          const logDateTime = new Date(log.created_at);
          
          // Must be before current sleep
          if (logDateTime >= currentSleep) return false;
          
          // If there's a previous sleep, must be after that sleep
          if (previousSleep && logDateTime < previousSleep) return false;
          
          return true;
        }) || [];
        
        // Use the day before sleep as the display date
        const displayDate = new Date(currentSleep);
        displayDate.setDate(displayDate.getDate() - 1);
        
        groupedLogs.push({
          sleepDate: currentSleep.toISOString().split('T')[0],
          sleepTime: currentSleep,
          displayDate: displayDate,
          logs: dayLogs
        });
      }

      setRoutineLogs(groupedLogs);
    } catch (err) {
      console.error('Error fetching routine logs:', err);
    }
  };

  useEffect(() => {
    fetchRoutineLogs();
  }, [user]);

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading habits: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">

      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Habits</h1>
          <p className="text-neutral-600">
            Track your daily routines. Each day, habits start 15 minutes earlier if completed on time, or stay the same if not completed.
          </p>
        </div>
        <button
          onClick={updateHabitStartTimes}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Update Times</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {habits.map((habit) => {
          const dailyLog = habit.habits_daily_logs?.[0];
          const isCompleted = dailyLog?.actual_start_time || false;
          
          return (
            <div
              key={habit.id}
              className={`bg-white rounded-lg border p-3 transition-all ${
                isCompleted 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleCompletion(habit.id)}
                    className="flex-shrink-0"
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <Circle className="w-5 h-5 text-neutral-400 hover:text-neutral-600" />
                    )}
                  </button>
                  
                  <div className="min-w-0 flex-1">
                    <h3 className={`font-medium text-sm ${
                      isCompleted ? 'text-green-800' : 'text-neutral-900'
                    }`}>
                      {habit.name}
                    </h3>
                    <div className="flex items-center space-x-1 text-xs text-neutral-600">
                      <Clock className="w-3 h-3" />
                      <span>{habit.duration}m</span>
                      {dailyLog?.actual_start_time && dailyLog?.actual_end_time && (
                        <span className="text-green-600">
                          • {formatTime(dailyLog.actual_start_time)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center">
                  {editingHabit === habit.id ? (
                    <div className="flex items-center space-x-1">
                      <input
                        type="time"
                        value={tempTime}
                        onChange={(e) => setTempTime(e.target.value)}
                        className="px-1 py-1 border border-neutral-300 rounded text-xs w-16"
                        autoFocus
                      />
                      <button
                        onClick={() => updateTime(habit.id, tempTime)}
                        className="px-2 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingHabit(null)}
                        className="px-2 py-1 border border-neutral-300 rounded text-xs hover:bg-neutral-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingHabit(habit.id);
                        setTempTime(habit.current_start_time || '09:00');
                      }}
                      className="flex items-center space-x-1 px-2 py-1 bg-neutral-100 rounded hover:bg-neutral-200 transition-colors"
                    >
                      <Play className="w-3 h-3" />
                      <span className="font-mono text-xs">
                        {formatTime(habit.current_start_time)}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-medium text-blue-900 mb-2">How it works</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• If you complete a habit on time, it starts 15 minutes earlier the next day</li>
          <li>• If you don't complete a habit, it maintains the same start time the next day</li>
          <li>• This encourages consistency - completing on time moves you toward your ideal schedule</li>
          <li>• Click the time to manually adjust when needed</li>
          <li>• Mark habits as complete by clicking the circle</li>
        </ul>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Last 7 Days - Morning & Shutdown Routines</h3>
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-900">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-900">Morning Routine</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-900">Shutdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {routineLogs.map((dayGroup, i) => {
                  const displayDate = dayGroup.displayDate.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  
                  const morningLog = dayGroup.logs.find(log => 
                    log.habits.name === 'Morning Routine'
                  );
                  const shutdownLog = dayGroup.logs.find(log => 
                    log.habits.name === 'Shutdown'
                  );

                  return (
                    <tr key={dayGroup.sleepDate} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 text-sm text-neutral-900">{displayDate}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {morningLog ? formatTime(morningLog.actual_start_time) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {shutdownLog ? formatTime(shutdownLog.actual_start_time) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Habits;