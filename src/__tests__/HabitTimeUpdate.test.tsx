/**
 * Test for Habit Time Update Issue
 * 
 * This test verifies that when a user updates a habit's time in the "Edit Habit Time" modal,
 * the UI is properly refreshed to show the updated time.
 * 
 * Current Issue: After saving a new time to Supabase, the UI doesn't reflect the change
 * because the habits data isn't being refetched.
 * 
 * Expected Behavior: After saving, refetchHabits should be called to update the UI.
 */

// Testing the habit time update functionality

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id' } }
    })
  },
  from: jest.fn().mockReturnValue({
    upsert: jest.fn().mockResolvedValue({ error: null })
  })
};

// Mock the Calendar component's habit time change handler
jest.mock('../lib/supabase', () => ({
  supabase: mockSupabase
}));

describe('Habit Time Update - Integration Test', () => {
  let mockRefetchHabits: jest.Mock;
  let mockSetTasksScheduled: jest.Mock;
  let mockSetScheduledTasksCache: jest.Mock;

  beforeEach(() => {
    mockRefetchHabits = jest.fn();
    mockSetTasksScheduled = jest.fn();
    mockSetScheduledTasksCache = jest.fn();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  test('FAILING: handleHabitTimeChange should call refetchHabits after successful save', async () => {
    // Create a mock function that simulates the current handleHabitTimeChange implementation
    const handleHabitTimeChangeWithoutRefetch = async (
      habitId: string, 
      date: string, 
      newTime: string
    ) => {
      try {
        const { supabase } = await import('../lib/supabase');
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Insert or update the daily log with the new scheduled start time
        const { error } = await supabase.from('habits_daily_logs').upsert(
          {
            habit_id: habitId,
            user_id: user.id,
            log_date: date,
            scheduled_start_time: newTime,
          },
          {
            onConflict: 'habit_id,user_id,log_date',
          }
        );

        if (error) throw error;

        // Reset task scheduling to recalculate available slots with new habit time
        mockSetTasksScheduled(false);
        mockSetScheduledTasksCache(new Map());

        // BUG: This line is missing - should call refetchHabits here
        // mockRefetchHabits();
      } catch (error) {
        console.error('Error updating habit time:', error);
        throw error;
      }
    };

    // Execute the function
    await handleHabitTimeChangeWithoutRefetch('habit-id', '2025-07-26', '11:15');

    // Verify that the database was updated
    expect(mockSupabase.from).toHaveBeenCalledWith('habits_daily_logs');
    expect(mockSupabase.from().upsert).toHaveBeenCalledWith(
      {
        habit_id: 'habit-id',
        user_id: 'test-user-id',
        log_date: '2025-07-26',
        scheduled_start_time: '11:15',
      },
      {
        onConflict: 'habit_id,user_id,log_date',
      }
    );

    // Verify that task scheduling was reset
    expect(mockSetTasksScheduled).toHaveBeenCalledWith(false);
    expect(mockSetScheduledTasksCache).toHaveBeenCalledWith(expect.any(Map));

    // THIS IS THE FAILING ASSERTION - refetchHabits should be called but currently isn't
    expect(mockRefetchHabits).toHaveBeenCalled();
  });

  test('EXPECTED: handleHabitTimeChange with proper refetch implementation', async () => {
    // This shows how the function SHOULD work with the fix
    const handleHabitTimeChangeWithRefetch = async (
      habitId: string, 
      date: string, 
      newTime: string,
      refetchHabits: () => void
    ) => {
      try {
        const { supabase } = await import('../lib/supabase');
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Insert or update the daily log with the new scheduled start time
        const { error } = await supabase.from('habits_daily_logs').upsert(
          {
            habit_id: habitId,
            user_id: user.id,
            log_date: date,
            scheduled_start_time: newTime,
          },
          {
            onConflict: 'habit_id,user_id,log_date',
          }
        );

        if (error) throw error;

        // Reset task scheduling to recalculate available slots with new habit time
        mockSetTasksScheduled(false);
        mockSetScheduledTasksCache(new Map());

        // FIX: Call refetchHabits to update the UI
        refetchHabits();
      } catch (error) {
        console.error('Error updating habit time:', error);
        throw error;
      }
    };

    // Execute the function with the refetch callback
    await handleHabitTimeChangeWithRefetch('habit-id', '2025-07-26', '11:15', mockRefetchHabits);

    // Verify that refetchHabits was called
    expect(mockRefetchHabits).toHaveBeenCalled();
  });
});