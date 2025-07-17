import { useState, useEffect, useMemo } from "react";
import { format, addDays } from "date-fns";
import { Plus, X, Clock } from "lucide-react";
import { useHabits } from "../hooks/useHabits";
import { useSessions } from "../hooks/useContracts";
import { useProjects, useTasks } from "../hooks/useProjects";
import { useSettings } from "../hooks/useSettings";
import { useMeetings } from "../hooks/useMeetings";
import { Meeting } from "../types";

const Calendar = () => {
  const [today] = useState(new Date());
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [allTasksLoading, setAllTasksLoading] = useState(true);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ time: string; date: Date } | null>(null);
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    location: '',
    meeting_type: 'general' as Meeting['meeting_type'],
    priority: 'medium' as Meeting['priority']
  });
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const { habits, loading: habitsLoading } = useHabits();
  const { sessions, loading: sessionsLoading } = useSessions();
  const { projects, loading: projectsLoading } = useProjects();
  const { getWorkHoursRange } = useSettings();
  const { meetings, loading: meetingsLoading, addMeeting, updateMeeting } = useMeetings();

  // Listen for window resize
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getDayColumns = () => {
    if (windowWidth > 850) {
      // Show next 5 days
      return Array.from({ length: 5 }, (_, i) => {
        const date = addDays(today, i);
        const label =
          i === 0 ? "Today" : i === 1 ? "Tomorrow" : format(date, "EEE, MMM d");
        return { date, label };
      });
    } else {
      // Show 3 days (original behavior)
      return [
        { date: today, label: "Today" },
        { date: addDays(today, 1), label: "Tomorrow" },
        {
          date: addDays(today, 2),
          label: format(addDays(today, 2), "EEE, MMM d"),
        },
      ];
    }
  };

  const getHourSlots = () => {
    const { end } = getWorkHoursRange();
    const hours = [];

    // Always start at 7am for morning routine, go until work hours end
    for (let i = 7; i <= end; i++) {
      const hour12 = i > 12 ? i - 12 : i === 0 ? 12 : i;
      const ampm = i >= 12 ? "PM" : "AM";
      const hourStr = hour12.toString() + ":00 " + ampm;
      const timeValue = i.toString().padStart(2, "0") + ":00";
      hours.push({ display: hourStr, time: timeValue });
    }

    return hours;
  };

  // Optimized habits cache with rescheduling logic included
  const habitsCache = useMemo(() => {
    if (habitsLoading || !habits.length) {
      return new Map();
    }

    const cache = new Map();
    const hourSlots = getHourSlots();
    const dayColumns = getDayColumns();

    // Pre-compute for all time slots and dates
    hourSlots.forEach((hourSlot) => {
      const slotHour = parseInt(hourSlot.time.split(":")[0]);
      
      dayColumns.forEach((dayColumn) => {
        const dateKey = format(dayColumn.date, "yyyy-MM-dd");
        const cacheKey = `${hourSlot.time}-${dateKey}`;
        
        const habitsForSlot = habits
          .filter(habit => {
            if (!habit.current_start_time) return false;
            
            const habitStartHour = parseInt(habit.current_start_time.split(":")[0]);
            const habitStartMinute = parseInt(habit.current_start_time.split(":")[1]);
            const habitDuration = habit.duration || 0;
            
            // Check for meeting conflicts
            const conflictingMeeting = meetings.find(meeting => {
              const meetingStart = new Date(meeting.start_time);
              const meetingEnd = new Date(meeting.end_time);
              const meetingDateStr = format(meetingStart, "yyyy-MM-dd");
              
              if (meetingDateStr !== dateKey) return false;

              const habitStartInHours = habitStartHour + habitStartMinute / 60;
              const habitEndInHours = habitStartInHours + habitDuration / 60;
              const meetingStartInHours = meetingStart.getHours() + meetingStart.getMinutes() / 60;
              const meetingEndInHours = meetingEnd.getHours() + meetingEnd.getMinutes() / 60;

              return (habitStartInHours < meetingEndInHours && habitEndInHours > meetingStartInHours);
            });

            if (conflictingMeeting) {
              // Calculate rescheduled hour
              const meetingEnd = new Date(conflictingMeeting.end_time);
              let newStartHour = meetingEnd.getHours();
              
              if (meetingEnd.getMinutes() > 30) {
                newStartHour += 1;
              }
              
              return newStartHour === slotHour;
            }
            
            return habitStartHour === slotHour;
          })
          .map(habit => {
            const habitStartHour = parseInt(habit.current_start_time!.split(":")[0]);
            const habitStartMinute = parseInt(habit.current_start_time!.split(":")[1]);
            const habitDuration = habit.duration || 0;
            
            // Check for rescheduling
            const conflictingMeeting = meetings.find(meeting => {
              const meetingStart = new Date(meeting.start_time);
              const meetingEnd = new Date(meeting.end_time);
              const meetingDateStr = format(meetingStart, "yyyy-MM-dd");
              
              if (meetingDateStr !== dateKey) return false;

              const habitStartInHours = habitStartHour + habitStartMinute / 60;
              const habitEndInHours = habitStartInHours + habitDuration / 60;
              const meetingStartInHours = meetingStart.getHours() + meetingStart.getMinutes() / 60;
              const meetingEndInHours = meetingEnd.getHours() + meetingEnd.getMinutes() / 60;

              return (habitStartInHours < meetingEndInHours && habitEndInHours > meetingStartInHours);
            });

            if (conflictingMeeting) {
              const meetingEnd = new Date(conflictingMeeting.end_time);
              let newStartMinute = meetingEnd.getMinutes();
              
              if (meetingEnd.getMinutes() === 0) {
                newStartMinute = 0;
              } else if (meetingEnd.getMinutes() <= 30) {
                newStartMinute = 30;
              } else {
                newStartMinute = 0;
              }
              
              return {
                ...habit,
                topPosition: (newStartMinute / 60) * 100,
                isRescheduled: true
              };
            }
            
            return {
              ...habit,
              topPosition: (habitStartMinute / 60) * 100,
              isRescheduled: false
            };
          });

        cache.set(cacheKey, habitsForSlot);
      });
    });

    return cache;
  }, [habits, habitsLoading, meetings, meetingsLoading]);

  const getHabitsForTimeSlot = (timeSlot: string, date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const cacheKey = `${timeSlot}-${dateKey}`;
    return habitsCache.get(cacheKey) || [];
  };

  // Pre-compute sessions for all time slots and dates to avoid repeated calculations
  const sessionsCache = useMemo(() => {
    if (sessionsLoading || !sessions.length) {
      return new Map();
    }

    const cache = new Map();

    // Process all sessions once and cache them by time slot and date
    sessions.forEach((session) => {
      if (!session.actual_start_time) return;

      const dateStr = session.scheduled_date;
      const sessionStartHour = parseInt(
        session.actual_start_time.split(":")[0]
      );
      const minutes = parseInt(session.actual_start_time.split(":")[1]);
      const timeSlot = sessionStartHour.toString().padStart(2, "0") + ":00";
      const cacheKey = `${timeSlot}-${dateStr}`;

      // Get existing sessions for this slot or create new array
      const existingSessions = cache.get(cacheKey) || [];

      // Add this session with calculated position
      const topPosition = (minutes / 60) * 100;
      existingSessions.push({
        ...session,
        topPosition,
      });

      cache.set(cacheKey, existingSessions);
    });

    return cache;
  }, [sessions, sessionsLoading, getWorkHoursRange]);

  const getSessionsForTimeSlot = (timeSlot: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const cacheKey = `${timeSlot}-${dateStr}`;
    return sessionsCache.get(cacheKey) || [];
  };

  // Get available time blocks for a specific date (with 30-minute precision)
  const getAvailableTimeBlocks = (
    date: Date,
    alreadyScheduledTasks: any[] = []
  ) => {
    const blocks = [];
    const dateStr = format(date, "yyyy-MM-dd");
    const { start, end } = getWorkHoursRange();

    // Work with 30-minute slots within work hours
    for (let hour = start; hour < end; hour++) {
      for (let halfHour = 0; halfHour < 2; halfHour++) {
        const minutes = halfHour * 30;
        const timeInHours = hour + minutes / 60;
        const timeSlot =
          hour.toString().padStart(2, "0") +
          ":" +
          minutes.toString().padStart(2, "0");

        // Check if this 30-minute slot conflicts with any habit's duration (including rescheduled habits)
        const habitConflicts = habits.filter((habit) => {
          if (!habit.current_start_time) return false;
          
          let habitStartHour = parseInt(habit.current_start_time.split(":")[0]);
          let habitStartMinute = parseInt(habit.current_start_time.split(":")[1]);
          const habitDuration = habit.duration || 0; // duration in minutes

          // Check if this habit needs to be rescheduled due to meeting conflict
          const conflictingMeeting = meetings.find(meeting => {
            const meetingStart = new Date(meeting.start_time);
            const meetingEnd = new Date(meeting.end_time);
            const meetingDateStr = format(meetingStart, "yyyy-MM-dd");
            
            if (meetingDateStr !== dateStr) return false;

            const originalHabitStartInHours = habitStartHour + habitStartMinute / 60;
            const originalHabitEndInHours = originalHabitStartInHours + habitDuration / 60;
            const meetingStartInHours = meetingStart.getHours() + meetingStart.getMinutes() / 60;
            const meetingEndInHours = meetingEnd.getHours() + meetingEnd.getMinutes() / 60;

            return (originalHabitStartInHours < meetingEndInHours && originalHabitEndInHours > meetingStartInHours);
          });

          // If habit is rescheduled, use new time
          if (conflictingMeeting) {
            const meetingEnd = new Date(conflictingMeeting.end_time);
            const meetingEndHour = meetingEnd.getHours();
            const meetingEndMinute = meetingEnd.getMinutes();
            
            habitStartHour = meetingEndHour;
            if (meetingEndMinute === 0) {
              habitStartMinute = 0;
            } else if (meetingEndMinute <= 30) {
              habitStartMinute = 30;
            } else {
              habitStartHour += 1;
              habitStartMinute = 0;
            }
          }

          // Convert habit time range to hours (using potentially rescheduled time)
          const habitStartInHours = habitStartHour + habitStartMinute / 60;
          const habitEndInHours = habitStartInHours + habitDuration / 60;

          // Check if this 30-minute slot overlaps with the habit
          return (
            timeInHours < habitEndInHours &&
            timeInHours + 0.5 > habitStartInHours
          );
        });

        // Check for sessions that are running during this 30-minute slot
        const sessionConflicts = sessions.filter((session) => {
          if (!session.actual_start_time || session.scheduled_date !== dateStr)
            return false;

          const sessionStartHour = parseInt(
            session.actual_start_time.split(":")[0]
          );
          const sessionStartMinute = parseInt(
            session.actual_start_time.split(":")[1]
          );
          const sessionDuration = (session.scheduled_hours || 1) * 60; // duration in minutes

          // Convert session time range to hours
          const sessionStartInHours =
            sessionStartHour + sessionStartMinute / 60;
          const sessionEndInHours = sessionStartInHours + sessionDuration / 60;

          // Check if this 30-minute slot overlaps with the session
          return (
            timeInHours < sessionEndInHours &&
            timeInHours + 0.5 > sessionStartInHours
          );
        });

        // Check for meetings that are running during this 30-minute slot
        const meetingConflicts = meetings.filter((meeting) => {
          const meetingStart = new Date(meeting.start_time);
          const meetingEnd = new Date(meeting.end_time);
          const meetingDateStr = format(meetingStart, "yyyy-MM-dd");
          
          if (meetingDateStr !== dateStr) return false;

          // Convert meeting time range to hours
          const meetingStartInHours = meetingStart.getHours() + meetingStart.getMinutes() / 60;
          const meetingEndInHours = meetingEnd.getHours() + meetingEnd.getMinutes() / 60;

          // Check if this 30-minute slot overlaps with the meeting
          return (
            timeInHours < meetingEndInHours &&
            timeInHours + 0.5 > meetingStartInHours
          );
        });

        // Check if this 30-minute slot conflicts with already scheduled tasks
        const scheduledTasksInSlot = alreadyScheduledTasks.filter(
          (task) =>
            format(task.date, "yyyy-MM-dd") === dateStr &&
            task.startTime <= timeInHours &&
            timeInHours < task.startTime + task.estimated_hours
        );

        // A slot is available if there are no conflicts with habits, sessions, meetings, or scheduled tasks
        const available =
          habitConflicts.length === 0 &&
          sessionConflicts.length === 0 &&
          meetingConflicts.length === 0 &&
          scheduledTasksInSlot.length === 0;


        blocks.push({ timeInHours, timeSlot, available });
      }
    }

    return blocks;
  };

  // Break a task into chunks that fit available time blocks (with 30-minute precision)
  const scheduleTaskInAvailableSlots = (
    taskHours: number,
    date: Date,
    taskInfo: any,
    alreadyScheduledTasks: any[] = []
  ) => {
    const availableBlocks = getAvailableTimeBlocks(date, alreadyScheduledTasks);
    console.log("availableBlocks", availableBlocks);
    const scheduledChunks = [];
    let remainingHours = taskHours;

    let currentChunkStart = null;
    let currentChunkHours = 0;

    for (let i = 0; i < availableBlocks.length && remainingHours > 0; i++) {
      const block = availableBlocks[i];

      if (block.available) {
        if (currentChunkStart === null) {
          currentChunkStart = block.timeInHours;
          currentChunkHours = 0;
        }
        currentChunkHours += 0.5; // Each block is 30 minutes = 0.5 hours
      } else {
        // Hit an obstacle, finalize current chunk if any
        if (currentChunkStart !== null && currentChunkHours > 0) {
          const chunkHours = Math.min(currentChunkHours, remainingHours);
          scheduledChunks.push({
            ...taskInfo,
            id: `${taskInfo.id}-chunk-${scheduledChunks.length}`,
            title: `${taskInfo.title}${
              scheduledChunks.length > 0
                ? ` (${scheduledChunks.length + 1})`
                : ""
            }`,
            startTime: currentChunkStart,
            startHour: Math.floor(currentChunkStart), // For display compatibility
            estimated_hours: chunkHours,
            topPosition: 0,
          });
          remainingHours -= chunkHours;
          currentChunkStart = null;
          currentChunkHours = 0;
        }
      }
    }

    console.log("scheduled ch", scheduledChunks);

    // Finalize last chunk if needed
    if (
      currentChunkStart !== null &&
      currentChunkHours > 0 &&
      remainingHours > 0
    ) {
      const chunkHours = Math.min(currentChunkHours, remainingHours);
      scheduledChunks.push({
        ...taskInfo,
        id: `${taskInfo.id}-chunk-${scheduledChunks.length}`,
        title: `${taskInfo.title}${
          scheduledChunks.length > 0 ? ` (${scheduledChunks.length + 1})` : ""
        }`,
        startTime: currentChunkStart,
        startHour: Math.floor(currentChunkStart), // For display compatibility
        estimated_hours: chunkHours,
        topPosition: 0,
      });
    }

    return scheduledChunks;
  };

  // Fetch tasks from all projects without sessions
  useEffect(() => {
    const fetchAllTasks = async () => {
      if (!projectsLoading && projects.length > 0 && !sessionsLoading) {
        setAllTasksLoading(true);

        const projectsWithSessions = new Set(sessions.map((s) => s.project_id));
        const projectsWithoutSessions = projects.filter(
          (p) => !projectsWithSessions.has(p.id)
        );

        if (projectsWithoutSessions.length === 0) {
          console.log("No projects without sessions found");
          setAllTasks([]);
          setAllTasksLoading(false);
          return;
        }

        // Fetch tasks for all projects without sessions
        const allTasksPromises = projectsWithoutSessions.map(
          async (project) => {
            try {
              const { supabase } = await import("../lib/supabase");
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (!user) {
                console.log("No user found");
                return [];
              }

              console.log(
                `Fetching tasks for project: ${project.name} (${project.id})`
              );

              const { data, error } = await supabase
                .from("tasks")
                .select("*")
                .eq("project_id", project.id)
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

              if (error) {
                console.error(
                  "Error fetching tasks for project",
                  project.id,
                  error
                );
                return [];
              }

              // Add project info to each task
              return (data || []).map((task) => ({
                ...task,
                project: project,
              }));
            } catch (error) {
              console.error("Error fetching tasks:", error);
              return [];
            }
          }
        );

        try {
          const allTasksArrays = await Promise.all(allTasksPromises);
          const flattenedTasks = allTasksArrays.flat();
          setAllTasks(flattenedTasks);
        } catch (error) {
          console.error("Error fetching all tasks:", error);
          setAllTasks([]);
        }

        setAllTasksLoading(false);
      }
    };

    fetchAllTasks();
  }, [projects, sessions, projectsLoading, sessionsLoading]);

  // Cache scheduled tasks across all days to avoid re-scheduling
  const [scheduledTasksCache, setScheduledTasksCache] = useState<
    Map<string, any[]>
  >(new Map());
  const [tasksScheduled, setTasksScheduled] = useState(false);

  // Pre-calculate and cache scheduled tasks when tasks are loaded
  useEffect(() => {
    if (
      !allTasksLoading &&
      allTasks.length > 0 &&
      !tasksScheduled &&
      !habitsLoading
    ) {
      // Get unscheduled tasks (tasks without parent and not completed)
      const unscheduledTasks = allTasks.filter(
        (task) =>
          !task.parent_task_id &&
          task.status !== "completed" &&
          task.estimated_hours &&
          task.estimated_hours > 0
      );

      if (unscheduledTasks.length === 0) {
        console.log("No unscheduled tasks found");
        setTasksScheduled(true);
        return;
      }

      // Schedule all unscheduled tasks across available days
      const allDays = getDayColumns();
      let allScheduledChunks: any[] = [];
      let remainingTasks = unscheduledTasks.map(task => ({ ...task, remainingHours: task.estimated_hours }));

      for (const dayColumn of allDays) {
        if (remainingTasks.length === 0) break;

        // Try to schedule ALL remaining tasks on this day before moving to next day
        let scheduledOnThisDay = true;
        while (scheduledOnThisDay && remainingTasks.length > 0) {
          scheduledOnThisDay = false;

          for (let i = 0; i < remainingTasks.length; i++) {
            const task = remainingTasks[i];
            const scheduledChunks = scheduleTaskInAvailableSlots(
              task.remainingHours,
              dayColumn.date,
              {
                ...task,
                isAutoScheduled: true,
              },
              allScheduledChunks
            );
            console.log("scheduled chunks", scheduledChunks);

            if (scheduledChunks.length > 0) {
              // Store chunks with their date
              const chunksWithDate = scheduledChunks.map((chunk) => ({
                ...chunk,
                date: dayColumn.date,
              }));
              allScheduledChunks.push(...chunksWithDate);
              console.log("allscheduledchunks", allScheduledChunks);

              // Update remaining hours for this task
              const totalScheduledHours = scheduledChunks.reduce(
                (sum, chunk) => sum + chunk.estimated_hours,
                0
              );
              task.remainingHours -= totalScheduledHours;

              // Remove this task from remaining tasks if fully scheduled
              if (task.remainingHours <= 0) {
                remainingTasks = remainingTasks.filter((t) => t.id !== task.id);
                scheduledOnThisDay = true; // Continue trying to schedule more tasks on this day
              } else {
                scheduledOnThisDay = true; // Continue trying to schedule more on this day
              }
              break; // Move to next task
            }
          }
        }
      }

      // Cache the results for each date
      const tasksByDate = new Map();
      allScheduledChunks.forEach((chunk) => {
        const chunkDateKey = format(chunk.date, "yyyy-MM-dd");
        if (!tasksByDate.has(chunkDateKey)) {
          tasksByDate.set(chunkDateKey, []);
        }
        tasksByDate.get(chunkDateKey).push(chunk);
      });
      setScheduledTasksCache(tasksByDate);
      setTasksScheduled(true);
    }
  }, [
    allTasks,
    allTasksLoading,
    tasksScheduled,
    habitsLoading,
    getWorkHoursRange,
  ]);

  // Reset task scheduling when tasks change (only when tasks actually change content)
  const tasksContentHash = useMemo(() => {
    return allTasks
      .map((t) => `${t.id}-${t.estimated_hours}-${t.status}`)
      .join(",");
  }, [allTasks]);

  useEffect(() => {
    setTasksScheduled(false);
    setScheduledTasksCache(new Map());
  }, [tasksContentHash]);

  // Pre-compute tasks for all time slots and dates to avoid repeated filtering
  const tasksCache = useMemo(() => {
    if (!tasksScheduled) {
      return new Map();
    }

    const cache = new Map();
    const hourSlots = getHourSlots();
    const dayColumns = getDayColumns();

    // Cache tasks for each combination of time slot and date
    hourSlots.forEach((hourSlot) => {
      dayColumns.forEach((dayColumn) => {
        const dateKey = format(dayColumn.date, "yyyy-MM-dd");
        const cacheKey = `${hourSlot.time}-${dateKey}`;
        const cachedTasks = scheduledTasksCache.get(dateKey) || [];
        const currentHour = parseInt(hourSlot.time.split(":")[0]);

        // Filter tasks that start in this hour slot (supporting fractional hours)
        const filtered = cachedTasks.filter((chunk) => {
          const taskStartHour = chunk.startTime
            ? Math.floor(chunk.startTime)
            : chunk.startHour;
          return taskStartHour === currentHour;
        });

        cache.set(cacheKey, filtered);
      });
    });

    return cache;
  }, [tasksScheduled, scheduledTasksCache, getWorkHoursRange]);

  // Get auto-scheduled tasks for available time slots
  const getTasksForTimeSlot = (timeSlot: string, date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const cacheKey = `${timeSlot}-${dateKey}`;
    return tasksCache.get(cacheKey) || [];
  };


  const dayColumns = useMemo(() => getDayColumns(), [today, windowWidth]);
  const hourSlots = useMemo(() => getHourSlots(), []);
  const gridCols =
    windowWidth > 850 ? "80px 1fr 1fr 1fr 1fr 1fr" : "80px 1fr 1fr 1fr";

  const handleAddMeeting = () => {
    setEditingMeeting(null);
    setNewMeeting({
      title: '',
      description: '',
      start_time: '',
      end_time: '',
      location: '',
      meeting_type: 'general',
      priority: 'medium'
    });
    setShowMeetingModal(true);
    setSelectedTimeSlot(null);
  };

  const handleEditMeeting = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    const startTime = new Date(meeting.start_time);
    const endTime = new Date(meeting.end_time);
    
    setNewMeeting({
      title: meeting.title,
      description: meeting.description || '',
      start_time: startTime.toTimeString().slice(0, 5), // HH:MM format
      end_time: endTime.toTimeString().slice(0, 5), // HH:MM format
      location: meeting.location || '',
      meeting_type: meeting.meeting_type,
      priority: meeting.priority
    });
    setShowMeetingModal(true);
    setSelectedTimeSlot(null);
  };

  const handleTimeSlotClick = (timeSlot: string, date: Date) => {
    setEditingMeeting(null);
    setSelectedTimeSlot({ time: timeSlot, date });
    
    // Pre-fill start time based on selected slot
    const [hour, minute] = timeSlot.split(':');
    const startTime = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    const endHour = parseInt(hour) + 1;
    const endTime = `${endHour.toString().padStart(2, '0')}:${minute.padStart(2, '0')}`;
    
    setNewMeeting({
      title: '',
      description: '',
      start_time: startTime,
      end_time: endTime,
      location: '',
      meeting_type: 'general',
      priority: 'medium'
    });
    setShowMeetingModal(true);
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const baseDate = selectedTimeSlot ? selectedTimeSlot.date : (editingMeeting ? new Date(editingMeeting.start_time) : new Date());
      
      const [startHour, startMinute] = newMeeting.start_time.split(':').map(Number);
      const [endHour, endMinute] = newMeeting.end_time.split(':').map(Number);
      
      const startTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), startHour, startMinute);
      const endTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), endHour, endMinute);

      const meetingData = {
        title: newMeeting.title,
        description: newMeeting.description,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        location: newMeeting.location,
        meeting_type: newMeeting.meeting_type,
        priority: newMeeting.priority,
        status: 'scheduled' as const
      };

      if (editingMeeting) {
        await updateMeeting(editingMeeting.id, meetingData);
      } else {
        await addMeeting(meetingData);
      }

      // Reset form
      setNewMeeting({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        location: '',
        meeting_type: 'general',
        priority: 'medium'
      });
      setShowMeetingModal(false);
      setSelectedTimeSlot(null);
      setEditingMeeting(null);
    } catch (error) {
      console.error('Error saving meeting:', error);
    }
  };

  // Get meetings for a specific time slot
  const getMeetingsForTimeSlot = (timeSlot: string, date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const currentHour = parseInt(timeSlot.split(":")[0]);
    
    return meetings.filter(meeting => {
      const meetingStart = new Date(meeting.start_time);
      const meetingDate = format(meetingStart, "yyyy-MM-dd");
      const meetingHour = meetingStart.getHours();
      
      return meetingDate === dateKey && meetingHour === currentHour;
    });
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Headers - Fixed */}
      <div
        className="grid border-b border-neutral-200"
        style={{ gridTemplateColumns: gridCols }}
      >
        <div className="p-1.5 bg-neutral-100 border-r border-neutral-200 flex items-center justify-center">
          <button
            className="p-1 hover:bg-neutral-200 rounded transition-colors"
            title="Add meeting"
            onClick={handleAddMeeting}
          >
            <Plus className="w-4 h-4 text-neutral-600" />
          </button>
        </div>
        {dayColumns.map((column, columnIndex) => (
          <div
            key={columnIndex}
            className="p-1.5 bg-neutral-50 border-r border-neutral-200 last:border-r-0"
          >
            <h2 className="text-sm font-medium text-neutral-900">
              {column.label}
            </h2>
            <p className="text-xs text-neutral-600">
              {format(column.date, "MMM d, yyyy")}
            </p>
          </div>
        ))}
      </div>

      {/* Calendar Grid - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {hourSlots.map((hour, hourIndex) => (
          <div
            key={hourIndex}
            className="grid border-b border-neutral-100"
            style={{ gridTemplateColumns: gridCols }}
          >
            {/* Time Column */}
            <div className="border-r border-neutral-200 p-1 h-16 bg-neutral-50 flex items-start">
              <div className="font-mono text-neutral-600 text-xs">
                {hour.display}
              </div>
            </div>

            {/* Day Columns */}
            {dayColumns.map((column, columnIndex) => {
              // Use the optimized cache that already includes rescheduling logic
              const habitsInSlot = getHabitsForTimeSlot(hour.time, column.date);
              const sessionsInSlot = getSessionsForTimeSlot(
                hour.time,
                column.date
              );
              const tasksInSlot = tasksScheduled
                ? getTasksForTimeSlot(hour.time, column.date)
                : [];
              const meetingsInSlot = getMeetingsForTimeSlot(hour.time, column.date);

              return (
                <div
                  key={columnIndex}
                  className="border-r border-neutral-200 last:border-r-0 p-0.5 h-16 text-xs hover:bg-neutral-50 relative cursor-pointer"
                  onClick={() => handleTimeSlotClick(hour.time, column.date)}
                >
                  {/* Habits */}
                  {habitsInSlot.map((habit) => {
                    const dailyLog = habit.habits_daily_logs?.[0];
                    const isCompleted = dailyLog?.is_completed || false;
                    const habitHeight = habit.duration
                      ? (habit.duration / 60) * 64
                      : 64; // 64px per hour (h-16 = 64px)
                    const isRescheduled = habit.isRescheduled || false;

                    return (
                      <div
                        key={`habit-${habit.id}`}
                        className={`absolute left-0.5 right-0.5 text-xs p-0.5 rounded border-l-2 flex items-start justify-between ${
                          isCompleted
                            ? "bg-green-50 border-green-400 text-green-800"
                            : "bg-blue-50 border-blue-400 text-blue-800"
                        }`}
                        style={{
                          top: `${habit.topPosition}%`,
                          height: `${habitHeight}px`,
                        }}
                      >
                        <div className="font-medium truncate flex-1 flex items-center">
                          {isRescheduled && <Clock className="w-2.5 h-2.5 mr-1 flex-shrink-0" />}
                          {habit.name}
                        </div>
                        {habit.duration && (
                          <div className="text-xs opacity-75 ml-1 flex-shrink-0">
                            {habit.duration}min
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Sessions */}
                  {sessionsInSlot.map((session) => {
                    const sessionHeight = session.scheduled_hours * 64; // 64px per hour (h-16 = 64px)

                    // Debug Momentum Meals session
                    if (session.projects?.name === "Momentum Meals") {
                      console.log("Momentum Meals session:", {
                        actual_start_time: session.actual_start_time,
                        scheduled_hours: session.scheduled_hours,
                        sessionHeight,
                        topPosition: session.topPosition,
                      });
                    }

                    return (
                      <div
                        key={`session-${session.id}`}
                        className="absolute left-0.5 right-0.5 text-xs p-0.5 rounded border-l-2 flex items-start justify-between bg-purple-50 border-purple-400 text-purple-800"
                        style={{
                          top: `${session.topPosition}%`,
                          height: `${sessionHeight}px`,
                          zIndex: 10,
                        }}
                      >
                        <div className="font-medium truncate flex-1">
                          {session.projects?.name || "Project Session"}
                        </div>
                        <div className="text-xs opacity-75 ml-1 flex-shrink-0">
                          {session.scheduled_hours}h
                        </div>
                      </div>
                    );
                  })}

                  {/* Auto-scheduled Tasks */}
                  {tasksInSlot.map((task) => {
                    const currentHour = parseInt(hour.time.split(":")[0]);
                    const taskStartTime = task.startTime || task.startHour;
                    
                    // Calculate position within the starting hour slot
                    const minutesIntoHour = ((taskStartTime - currentHour) * 60);
                    const topPositionInSlot = (minutesIntoHour / 60) * 100; // percentage within the hour
                    const taskHeight = (task.estimated_hours || 1) * 64; // 64px per hour

                    return (
                      <div
                        key={`task-${task.id}`}
                        className="absolute left-0.5 right-0.5 text-xs p-0.5 rounded border-l-2 flex items-start justify-between bg-orange-50 border-orange-400 text-orange-800 opacity-75"
                        style={{
                          top: `${topPositionInSlot}%`,
                          height: `${taskHeight}px`,
                          zIndex: 5,
                        }}
                      >
                        <div className="font-medium truncate flex-1">
                          {task.title}
                        </div>
                        <div className="text-xs opacity-75 ml-1 flex-shrink-0">
                          {task.estimated_hours}h
                        </div>
                      </div>
                    );
                  })}

                  {/* Meetings */}
                  {meetingsInSlot.map((meeting) => {
                    const meetingStart = new Date(meeting.start_time);
                    const meetingEnd = new Date(meeting.end_time);
                    const currentHour = parseInt(hour.time.split(":")[0]);
                    
                    // Calculate position within the hour slot
                    const minutesIntoHour = meetingStart.getMinutes();
                    const topPositionInSlot = (minutesIntoHour / 60) * 100; // percentage within the hour
                    const meetingDuration = (meetingEnd.getTime() - meetingStart.getTime()) / (1000 * 60); // minutes
                    const meetingHeight = (meetingDuration / 60) * 64; // 64px per hour

                    return (
                      <div
                        key={`meeting-${meeting.id}`}
                        className="absolute left-0.5 right-0.5 text-xs p-0.5 rounded border-l-2 flex items-start justify-between bg-red-50 border-red-400 text-red-800"
                        style={{
                          top: `${topPositionInSlot}%`,
                          height: `${meetingHeight}px`,
                          zIndex: 15,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditMeeting(meeting);
                        }}
                      >
                        <div className="font-medium truncate flex-1">
                          {meeting.title}
                        </div>
                        <div className="text-xs opacity-75 ml-1 flex-shrink-0">
                          {Math.round(meetingDuration)}min
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Meeting Modal */}
      {showMeetingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-neutral-900">
                {editingMeeting ? 'Edit Meeting' : 'Add Meeting'}
              </h2>
              <button
                onClick={() => {
                  setShowMeetingModal(false);
                  setSelectedTimeSlot(null);
                  setEditingMeeting(null);
                }}
                className="text-neutral-500 hover:text-neutral-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateMeeting} className="space-y-3">
              <input
                type="text"
                placeholder="Meeting title"
                value={newMeeting.title}
                onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                required
              />
              
              <textarea
                placeholder="Description (optional)"
                value={newMeeting.description}
                onChange={(e) => setNewMeeting({ ...newMeeting, description: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm resize-none"
                rows={2}
              />
              
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={newMeeting.start_time}
                    onChange={(e) => setNewMeeting({ ...newMeeting, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                    required
                  />
                </div>
                
                <div className="flex-1">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={newMeeting.end_time}
                    onChange={(e) => setNewMeeting({ ...newMeeting, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                    required
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Type
                  </label>
                  <select
                    value={newMeeting.meeting_type}
                    onChange={(e) => setNewMeeting({ ...newMeeting, meeting_type: e.target.value as Meeting['meeting_type'] })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                  >
                    <option value="general">General</option>
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="appointment">Appointment</option>
                  </select>
                </div>
                
                <div className="flex-1">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={newMeeting.priority}
                    onChange={(e) => setNewMeeting({ ...newMeeting, priority: e.target.value as Meeting['priority'] })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              
              <input
                type="text"
                placeholder="Location (optional)"
                value={newMeeting.location}
                onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
              />
              
              {selectedTimeSlot && (
                <div className="text-sm text-neutral-600 bg-neutral-50 p-2 rounded">
                  <strong>Date:</strong> {format(selectedTimeSlot.date, 'MMM d, yyyy')}
                </div>
              )}
              
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowMeetingModal(false);
                    setSelectedTimeSlot(null);
                    setEditingMeeting(null);
                  }}
                  className="px-4 py-2 text-neutral-600 text-sm hover:text-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
                >
                  {editingMeeting ? 'Update Meeting' : 'Create Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
