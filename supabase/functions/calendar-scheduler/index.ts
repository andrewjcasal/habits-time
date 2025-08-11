import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface ScheduleRequest {
  tasksData: any[];
  conflictMaps: any;
  dayColumns: any[];
  workHoursRange: { start: number; end: number };
  userId: string;
  tasksDailyLogsData?: any[];
  weekendDays?: string[];
  userSettings?: any;
  allTasks?: any[];
  scheduledTasksCache?: Map<string, any[]>;
}

interface TimeBlock {
  timeInHours: number;
  timeSlot: string;
  available: boolean;
}

interface ScheduledChunk {
  id: string;
  title: string;
  startTime: number;
  startHour: number;
  estimated_hours: number;
  topPosition: number;
  date: Date;
  isAutoScheduled: boolean;
  [key: string]: any;
}

const sortTasksByPriority = (tasks: any[]) => {
  const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2, 'placeholder': 3 };
  return tasks.sort((a, b) => {
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1;
    return aPriority - bPriority;
  });
};

const getAvailableTimeBlocks = (
  date: Date,
  conflictMaps: any,
  workHoursRange: { start: number; end: number },
  alreadyScheduledTasks: any[] = [],
  weekendDays: string[] = []
): TimeBlock[] => {
  const dateStr = date.toISOString().split('T')[0];
  
  // Skip weekend days for task scheduling
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  if (weekendDays.includes(dayOfWeek)) {
    return [];
  }
  
  const blocks: TimeBlock[] = [];
  const { start, end } = workHoursRange;
  
  for (let hour = start; hour < end; hour++) {
    for (let quarterHour = 0; quarterHour < 4; quarterHour++) {
      const minutes = quarterHour * 15;
      const timeInHours = hour + minutes / 60;
      const timeSlot = hour.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');

      // Use pre-computed conflict maps for O(1) lookups
      const normalizedTime = Math.round(timeInHours * 4) / 4;
      const conflictKey = `${dateStr}-${normalizedTime}`;
      
      const habitConflict = conflictMaps.habitConflicts?.get(conflictKey);
      const sessionConflict = conflictMaps.sessionConflicts?.get(conflictKey);
      const meetingConflict = conflictMaps.meetingConflicts?.get(conflictKey);
      const tasksDailyLogsConflict = conflictMaps.tasksDailyLogsConflicts?.get(conflictKey);
      const bufferConflict = conflictMaps.bufferConflicts?.get(conflictKey);
      
      const scheduledTasksInSlot = alreadyScheduledTasks.filter(
        task =>
          task.date.toISOString().split('T')[0] === dateStr &&
          task.startTime <= timeInHours &&
          timeInHours < task.startTime + task.estimated_hours
      );

      const available = !habitConflict && !sessionConflict && !meetingConflict && 
                       !tasksDailyLogsConflict && !bufferConflict &&
                       scheduledTasksInSlot.length === 0;

      blocks.push({ timeInHours, timeSlot, available });
    }
  }

  return blocks;
};

const scheduleTaskInAvailableSlots = (
  taskHours: number,
  date: Date,
  taskInfo: any,
  conflictMaps: any,
  workHoursRange: { start: number; end: number },
  alreadyScheduledTasks: any[] = [],
  weekendDays: string[] = []
): ScheduledChunk[] => {
  const availableBlocks = getAvailableTimeBlocks(
    date, 
    conflictMaps, 
    workHoursRange, 
    alreadyScheduledTasks, 
    weekendDays
  );
  
  const scheduledChunks: ScheduledChunk[] = [];
  let remainingHours = taskHours;

  let currentChunkStart: number | null = null;
  let currentChunkHours = 0;

  for (let i = 0; i < availableBlocks.length && remainingHours > 0; i++) {
    const block = availableBlocks[i];

    if (block.available) {
      if (currentChunkStart === null) {
        currentChunkStart = block.timeInHours;
        currentChunkHours = 0;
      }
      currentChunkHours += 0.25;
    } else {
      if (currentChunkStart !== null && currentChunkHours > 0) {
        const chunkHours = Math.min(currentChunkHours, remainingHours);
        const { end } = workHoursRange;
        
        // Ensure chunk doesn't extend beyond work hours
        const chunkEndTime = currentChunkStart + chunkHours;
        const adjustedChunkHours = chunkEndTime > end ? end - currentChunkStart : chunkHours;
        
        if (adjustedChunkHours > 0) {
          const chunk: ScheduledChunk = {
            ...taskInfo,
            id: `${taskInfo.id}-chunk-${scheduledChunks.length}`,
            title: `${taskInfo.title}${scheduledChunks.length > 0 ? ` (${scheduledChunks.length + 1})` : ''}`,
            startTime: currentChunkStart,
            startHour: Math.floor(currentChunkStart),
            estimated_hours: adjustedChunkHours,
            topPosition: 0,
            date,
            isAutoScheduled: true
          };
          
          scheduledChunks.push(chunk);
          remainingHours -= adjustedChunkHours;
        }
        currentChunkStart = null;
        currentChunkHours = 0;
      }
    }
  }

  // Handle remaining chunk at end of day
  if (currentChunkStart !== null && currentChunkHours > 0 && remainingHours > 0) {
    const chunkHours = Math.min(currentChunkHours, remainingHours);
    const { end } = workHoursRange;
    
    const chunkEndTime = currentChunkStart + chunkHours;
    const adjustedChunkHours = chunkEndTime > end ? end - currentChunkStart : chunkHours;
    
    if (adjustedChunkHours > 0) {
      const chunk: ScheduledChunk = {
        ...taskInfo,
        id: `${taskInfo.id}-chunk-${scheduledChunks.length}`,
        title: `${taskInfo.title}${scheduledChunks.length > 0 ? ` (${scheduledChunks.length + 1})` : ''}`,
        startTime: currentChunkStart,
        startHour: Math.floor(currentChunkStart),
        estimated_hours: adjustedChunkHours,
        topPosition: 0,
        date,
        isAutoScheduled: true
      };
      
      scheduledChunks.push(chunk);
    }
  }

  return scheduledChunks;
};

const scheduleAllTasks = async (
  tasksData: any[],
  conflictMaps: any,
  dayColumns: any[],
  workHoursRange: { start: number; end: number },
  userId: string,
  tasksDailyLogsData: any[] = [],
  weekendDays: string[] = [],
  userSettings: any = null
) => {
  const unscheduledTasks = tasksData.filter(
    task =>
      !task.parent_task_id &&
      task.status !== 'completed' &&
      task.estimated_hours &&
      task.estimated_hours > 0
  );

  // Calculate completed hours for each task from task daily logs
  const completedHoursByTask = new Map();
  tasksDailyLogsData.forEach(log => {
    if (log.task_id) {
      const completedHours = log.actual_duration || log.scheduled_duration || log.estimated_hours || 0;
      const currentCompleted = completedHoursByTask.get(log.task_id) || 0;
      completedHoursByTask.set(log.task_id, currentCompleted + completedHours);
    }
  });

  // Sort tasks by priority
  let tasksToSchedule = sortTasksByPriority([...unscheduledTasks]);

  // Handle billable hours logic if enabled
  const billableHoursEnabled = userSettings?.billable_hours_enabled || false;
  const TARGET_REVENUE = userSettings?.weekly_revenue_target || 1000;
  const DEFAULT_HOURLY_RATE = userSettings?.default_hourly_rate || 65;

  if (billableHoursEnabled) {
    // Calculate existing billable revenue from remaining tasks
    const existingBillableRevenue = unscheduledTasks.reduce((total, task) => {
      const hourlyRate = task.projects?.hourly_rate || 0;
      if (hourlyRate > 0) {
        const completedHours = completedHoursByTask.get(task.id) || 0;
        const remainingHours = Math.max(0, task.estimated_hours - completedHours);
        return total + (remainingHours * hourlyRate);
      }
      return total;
    }, 0);
    
    // For simplicity, we'll skip the complex completed revenue calculation
    // This would normally require access to all task daily logs
    const completedBillableRevenueThisWeek = 0;
    
    const revenueNeeded = Math.max(0, TARGET_REVENUE - existingBillableRevenue - completedBillableRevenueThisWeek);
    const hoursNeeded = revenueNeeded > 0 ? Math.ceil(revenueNeeded / DEFAULT_HOURLY_RATE) : 0;
    
    if (hoursNeeded > 0) {
      // Generate UUID for placeholder task
      const uuid = crypto.randomUUID();
      
      const placeholderTask = {
        id: uuid,
        title: 'Billable Work',
        estimated_hours: hoursNeeded,
        status: 'todo',
        priority: 'placeholder',
        projects: {
          id: 'placeholder-project',
          name: 'Billable Work',
          hourly_rate: DEFAULT_HOURLY_RATE,
          color: '#10B981'
        },
        isPlaceholder: true
      };
      
      tasksToSchedule.push(placeholderTask);
      tasksToSchedule = sortTasksByPriority(tasksToSchedule);
    }
  }

  if (tasksToSchedule.length === 0) return new Map();

  let allScheduledChunks: ScheduledChunk[] = [];
  let remainingTasks = tasksToSchedule.map(task => {
    const completedHours = completedHoursByTask.get(task.id) || 0;
    const remainingHours = Math.max(0, task.estimated_hours - completedHours);
    
    return {
      ...task,
      remainingHours,
    };
  }).filter(task => task.remainingHours > 0);

  for (const dayColumn of dayColumns) {
    if (remainingTasks.length === 0) break;

    let scheduledOnThisDay = true;
    while (scheduledOnThisDay && remainingTasks.length > 0) {
      scheduledOnThisDay = false;

      for (let i = 0; i < remainingTasks.length; i++) {
        const task = remainingTasks[i];
        const scheduledChunks = scheduleTaskInAvailableSlots(
          task.remainingHours,
          dayColumn.date,
          { ...task, isAutoScheduled: true },
          conflictMaps,
          workHoursRange,
          allScheduledChunks,
          weekendDays
        );

        if (scheduledChunks.length > 0) {
          allScheduledChunks.push(...scheduledChunks);

          const totalScheduledHours = scheduledChunks.reduce(
            (sum, chunk) => sum + chunk.estimated_hours,
            0
          );
          task.remainingHours -= totalScheduledHours;

          if (task.remainingHours <= 0) {
            remainingTasks = remainingTasks.filter(t => t.id !== task.id);
            scheduledOnThisDay = true;
          } else {
            scheduledOnThisDay = true;
          }
          break;
        }
      }
    }
  }

  // Group chunks by date
  const tasksByDate = new Map();
  allScheduledChunks.forEach(chunk => {
    const chunkDateKey = chunk.date.toISOString().split('T')[0];
    if (!tasksByDate.has(chunkDateKey)) {
      tasksByDate.set(chunkDateKey, []);
    }
    tasksByDate.get(chunkDateKey).push(chunk);
  });

  // Persist today's task chunks to database
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayChunks = allScheduledChunks.filter(chunk => 
    chunk.date.toISOString().split('T')[0] === todayStr
  );

  if (todayChunks.length > 0) {
    try {
      // Get Supabase client with environment variables
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Prepare task chunks for database insertion
      const taskChunksData = todayChunks.map(chunk => ({
        user_id: userId,
        task_id: chunk.id.includes('-chunk-') ? chunk.id.split('-chunk-')[0] : chunk.id,
        log_date: todayStr,
        scheduled_start_time: `${Math.floor(chunk.startTime).toString().padStart(2, '0')}:${Math.floor((chunk.startTime % 1) * 60).toString().padStart(2, '0')}`,
        scheduled_duration: chunk.estimated_hours,
        estimated_hours: chunk.estimated_hours
      }));

      // Insert task chunks into tasks_daily_logs
      const { error } = await supabase
        .from('tasks_daily_logs')
        .insert(taskChunksData);

      if (error) {
        console.error('Error persisting task chunks:', error);
      }
    } catch (error) {
      console.error('Error persisting task chunks:', error);
    }
  }

  return tasksByDate;
};

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      tasksData,
      conflictMaps,
      dayColumns,
      workHoursRange,
      userId,
      tasksDailyLogsData = [],
      weekendDays = [],
      userSettings = null
    }: ScheduleRequest = await req.json();

    // Convert day columns dates from strings to Date objects
    const processedDayColumns = dayColumns.map(col => ({
      ...col,
      date: new Date(col.date)
    }));

    // Convert conflict maps from plain objects to Maps
    const processedConflictMaps = {
      habitConflicts: new Map(Object.entries(conflictMaps.habitConflicts || {})),
      sessionConflicts: new Map(Object.entries(conflictMaps.sessionConflicts || {})),
      meetingConflicts: new Map(Object.entries(conflictMaps.meetingConflicts || {})),
      tasksDailyLogsConflicts: new Map(Object.entries(conflictMaps.tasksDailyLogsConflicts || {})),
      bufferConflicts: new Map(Object.entries(conflictMaps.bufferConflicts || {}))
    };

    const result = await scheduleAllTasks(
      tasksData,
      processedConflictMaps,
      processedDayColumns,
      workHoursRange,
      userId,
      tasksDailyLogsData,
      weekendDays,
      userSettings
    );

    // Convert Map to plain object for JSON serialization
    const serializedResult = Object.fromEntries(result);

    return new Response(
      JSON.stringify({ tasksByDate: serializedResult }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error in calendar scheduler:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});