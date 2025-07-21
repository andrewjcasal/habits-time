# Calendar Performance Optimizations

## 🎯 **Target Performance Issues**

### 1. **Database Query Optimization**
**Current**: Sequential queries for each project
```typescript
// SLOW: Sequential queries
const allTasksPromises = projectsWithoutSessions.map(async project => {
  const { data } = await supabase.from('tasks').select('*').eq('project_id', project.id)
})
```

**Optimized**: Single batch query
```typescript
// FAST: Single query with IN clause
const projectIds = projectsWithoutSessions.map(p => p.id)
const { data } = await supabase
  .from('tasks')
  .select('*, projects!inner(*)')
  .in('project_id', projectIds)
  .eq('user_id', user.id)
```

### 2. **Pre-computed Time Slots & Conflicts**
**Current**: Real-time conflict detection in loops
```typescript
// SLOW: O(n²) complexity
for (let hour = start; hour < end; hour++) {
  const habitConflicts = habits.filter(habit => { /* complex logic */ })
  const sessionConflicts = sessions.filter(session => { /* complex logic */ })
  const meetingConflicts = meetings.filter(meeting => { /* complex logic */ })
}
```

**Optimized**: Pre-computed conflict maps
```typescript
// FAST: O(n) pre-computation
const conflictMap = useMemo(() => {
  const map = new Map()
  
  // Pre-compute all conflicts once
  habits.forEach(habit => addToConflictMap(map, habit, 'habit'))
  sessions.forEach(session => addToConflictMap(map, session, 'session'))
  meetings.forEach(meeting => addToConflictMap(map, meeting, 'meeting'))
  
  return map
}, [habits, sessions, meetings])
```

### 3. **Memoized Date Calculations**
**Current**: Repeated date parsing
```typescript
// SLOW: Date parsing in every iteration
const meetingStart = new Date(meeting.start_time)
const meetingDateStr = format(meetingStart, 'yyyy-MM-dd')
```

**Optimized**: Pre-computed date objects
```typescript
// FAST: Parse once, reuse
const enhancedMeetings = useMemo(() => 
  meetings.map(meeting => ({
    ...meeting,
    startDate: new Date(meeting.start_time),
    endDate: new Date(meeting.end_time),
    dateStr: format(new Date(meeting.start_time), 'yyyy-MM-dd'),
    startHours: new Date(meeting.start_time).getHours() + new Date(meeting.start_time).getMinutes() / 60
  })), [meetings])
```

### 4. **Worker Thread for Complex Scheduling**
```typescript
// Move heavy task scheduling to Web Worker
const scheduleTasksWorker = useMemo(() => {
  return new Worker(new URL('../workers/taskScheduler.worker.ts', import.meta.url))
}, [])

useEffect(() => {
  scheduleTasksWorker.postMessage({
    tasks: allTasks,
    habits: enhancedHabits,
    sessions: enhancedSessions,
    meetings: enhancedMeetings,
    dateRange: dayColumns.map(col => col.date)
  })
}, [allTasks, enhancedHabits, enhancedSessions, enhancedMeetings])
```

### 5. **Virtualized Time Slots**
```typescript
// Only render visible time slots
const useVirtualizedTimeSlots = (hourSlots, visibleRange) => {
  return useMemo(() => {
    const startIndex = Math.max(0, visibleRange.start - 2)
    const endIndex = Math.min(hourSlots.length, visibleRange.end + 2)
    return hourSlots.slice(startIndex, endIndex)
  }, [hourSlots, visibleRange])
}
```

## 🛠 **Implementation Strategy**

### Phase 1: Quick Wins (30-50% improvement)
1. **Batch database queries** into single requests
2. **Add useMemo** to expensive calculations
3. **Pre-compute date objects** once per data change
4. **Index-based conflict lookup** instead of array filtering

### Phase 2: Structural Changes (50-80% improvement)  
1. **Web Worker** for task scheduling algorithm
2. **Conflict map data structure** for O(1) lookups
3. **Debounced scheduling** to prevent excessive recalculations
4. **Incremental updates** instead of full recalculation

### Phase 3: Advanced Optimizations (80%+ improvement)
1. **Virtual scrolling** for time slots
2. **Background scheduling** with service worker
3. **Cached computation results** in localStorage
4. **Differential updates** when data changes

## 📊 **Expected Performance Gains**

| Optimization | Time Complexity | Performance Gain |
|--------------|----------------|------------------|
| Batch queries | O(1) vs O(n) | 70-90% faster |
| Conflict maps | O(1) vs O(n²) | 80-95% faster |
| Memoized dates | O(1) vs O(n) | 60-80% faster |
| Web Worker | Non-blocking | 90%+ UI responsiveness |
| Virtual scrolling | O(visible) vs O(total) | 95%+ for large datasets |

## 🔧 **Implementation Code Examples**

### Optimized useCalendarData Hook Structure:
```typescript
export const useCalendarData = (windowWidth: number, baseDate: Date) => {
  // 1. Memoized enhanced data
  const enhancedHabits = useMemo(() => enhanceHabitsData(habits), [habits])
  const enhancedMeetings = useMemo(() => enhanceMeetingsData(meetings), [meetings])
  const enhancedSessions = useMemo(() => enhanceSessionsData(sessions), [sessions])
  
  // 2. Pre-computed conflict map
  const conflictMap = useMemo(() => buildConflictMap(
    enhancedHabits, 
    enhancedMeetings, 
    enhancedSessions
  ), [enhancedHabits, enhancedMeetings, enhancedSessions])
  
  // 3. Optimized task scheduling
  const scheduledTasks = useMemo(() => {
    if (!allTasks.length) return new Map()
    return scheduleTasksOptimized(allTasks, conflictMap, dayColumns)
  }, [allTasks, conflictMap, dayColumns])
  
  // 4. Fast time slot lookup
  const getTasksForTimeSlot = useCallback((timeSlot: string, date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd')
    const hour = parseInt(timeSlot.split(':')[0])
    return scheduledTasks.get(`${dateKey}-${hour}`) || []
  }, [scheduledTasks])
  
  return {
    // ... existing returns
    getTasksForTimeSlot,
    conflictMap,
    scheduledTasks
  }
}
```

### Batch Database Query:
```typescript
const fetchAllTasksOptimized = useCallback(async () => {
  if (!projects.length) return
  
  const projectIds = projects
    .filter(p => !sessions.some(s => s.project_id === p.id))
    .map(p => p.id)
    
  if (!projectIds.length) {
    setAllTasks([])
    return
  }
  
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      projects!inner(*)
    `)
    .in('project_id', projectIds)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    
  if (!error && data) {
    setAllTasks(data)
  }
}, [projects, sessions])
```

This optimization strategy should reduce calendar generation time from several seconds to under 500ms for typical datasets.