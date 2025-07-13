import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js';

serve(async (req) => {
  try {
    const { activity, start_time } = await req.json();
    

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const user_id = "b2610099-4341-47dc-8521-1f94d6ca9830"

    if (!activity) {
      return new Response(JSON.stringify({ error: 'Missing activity_name field' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // First, find or create the activity type
    let { data: activityType, error: activityError } = await supabase
      .from('habits_activity_types')
      .select('id')
      .eq('name', activity)
      .eq('user_id', user_id)
      .single();

    if (activityError && activityError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected if activity doesn't exist
      return new Response(JSON.stringify({ error: 'Failed to find activity type' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If activity type doesn't exist, create it
    if (!activityType) {
      const { data: newActivityType, error: createError } = await supabase
        .from('habits_activity_types')
        .insert([{
          name: activity,
          user_id: user_id
        }])
        .select()
        .single();

      if (createError) {
        return new Response(JSON.stringify({ error: 'Failed to create activity type' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      activityType = newActivityType;
    }

    // Now insert the time log
    const { data: timeLog, error: insertError } = await supabase
      .from('habits_time_logs')
      .insert([{
        activity_type_id: activityType.id,
        user_id: user_id,
        start_time: start_time || new Date().toISOString()
      }])
      .select(`
        id,
        start_time,
        end_time,
        habits_activity_types (
          id,
          name
        )
      `)
      .single();

    console.log('insert', insertError)

    if (insertError) {
      return new Response(JSON.stringify({ error: 'Failed to create time log', details: insertError }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: timeLog 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}); 